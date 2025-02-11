/**
 * This module is responsible for running all test sessions that have not been run yet.
 */
import { and, or, eq, ne, inArray, sql, lt, countDistinct } from 'drizzle-orm';
import { generateText } from 'ai';
import { testsConfig, MAX_TOKENS, MAX_WAIT_TIME } from '../config/index.js';
import { db } from '../database/db.js';
import { schema } from '../database/schema.js';
import { askYesNo } from '../utils/menus.js';
import { providers as llmProviders, wrapModel } from '../llms/index.js';
import { getSectionsFromMarkdownContent, sectionsToAiMessages } from '../utils/markdown.js';
export const runAllTests = async () => {
    console.log('Checking for tests to run...');
    // we query the DB to get all missing tests not yet run
    const { testVersions, testToTagRels, tags, sessions, modelVersions, providers, testToSystemPromptVersionRels, promptVersions, } = schema;
    const modelConfigsWithTemperature = testsConfig.candidates.filter(candidate => candidate.temperature !== undefined);
    const modelsWithTemperatures = new Map(modelConfigsWithTemperature.map(({ provider, model, temperature }) => [`${provider}:${model}`, temperature]));
    const modelConfigsWithTags = testsConfig.candidates.filter(candidate => candidate.requiredTags !== undefined && candidate.requiredTags.length > 0);
    const modelConfigsWithProhibitedTags = testsConfig.candidates.filter(candidate => candidate.prohibitedTags !== undefined && candidate.prohibitedTags.length > 0);
    const missingTests = await db
        .select({
        modelVersionId: modelVersions.id,
        modelVersionCode: modelVersions.providerModelCode,
        providerCode: providers.code,
        testVersionId: testVersions.id,
        testContent: testVersions.content,
        sysPromptVersionId: promptVersions.id,
        sysPromptContent: promptVersions.content,
        sessionsCount: countDistinct(sessions.id),
    })
        .from(modelVersions)
        .innerJoin(providers, and(eq(providers.id, modelVersions.providerId), or(...testsConfig.candidates.map(({ provider, model }) => and(eq(providers.code, provider), eq(modelVersions.providerModelCode, model))))))
        // always true to fetch all possible test combinations (we will filter later - cross joins aren't supported in drizzle-orm as of now)
        .innerJoin(testVersions, and(eq(testVersions.id, testVersions.id), eq(testVersions.active, true)))
        .innerJoin(testToSystemPromptVersionRels, eq(testToSystemPromptVersionRels.testVersionId, testVersions.id))
        .innerJoin(promptVersions, and(eq(promptVersions.id, testToSystemPromptVersionRels.systemPromptVersionId), eq(promptVersions.active, true)))
        .leftJoin(sessions, and(eq(sessions.testVersionId, testVersions.id), eq(sessions.modelVersionId, modelVersions.id), eq(sessions.candidateSysPromptVersionId, promptVersions.id), modelConfigsWithTemperature.length > 0
        ? sql `${sessions.temperature} = CASE
								${sql.join(modelConfigsWithTemperature.map(candidate => sql `WHEN
												${eq(modelVersions.providerModelCode, candidate.model)}
												AND ${eq(providers.code, candidate.provider)}
												THEN ${candidate.temperature}`))}
								ELSE ${testsConfig.candidatesTemperature}
							END`
        : eq(sessions.temperature, testsConfig.candidatesTemperature)))
        // We will need to filter by tags
        .innerJoin(testToTagRels, eq(testToTagRels.testVersionId, testVersions.id))
        .innerJoin(tags, eq(tags.id, testToTagRels.tagId))
        .groupBy(modelVersions.id, testVersions.id, promptVersions.id)
        .having(({ sessionsCount }) => and(
    // Ensure we only get tests that have not been run enough times yet
    lt(sessionsCount, testsConfig.attempts), 
    // Tag inclusions and exclusions must be done here rather than in the INNER JOIN
    // as we need to filter in/out the entire GROUP BY result if any of the grouped rows have the tag(s)
    ...[
        ...(testsConfig.requiredTags1.length > 0
            ? [sql `sum(CASE WHEN ${inArray(tags.name, testsConfig.requiredTags1)} THEN 1 ELSE 0 END) > 0`]
            : []),
        ...(testsConfig.requiredTags2.length > 0
            ? [sql `sum(CASE WHEN ${inArray(tags.name, testsConfig.requiredTags2)} THEN 1 ELSE 0 END) > 0`]
            : []),
        ...(testsConfig.prohibitedTags.length > 0
            ? [sql `sum(CASE WHEN ${inArray(tags.name, testsConfig.prohibitedTags)} THEN 1 ELSE 0 END) = 0`]
            : []),
        // ensure we have all required tags for each model
        ...(modelConfigsWithTags.length > 0
            ? modelConfigsWithTags.map(candidate => sql `sum(CASE WHEN ${or(ne(modelVersions.providerModelCode, candidate.model), ne(providers.code, candidate.provider), inArray(tags.name, candidate.requiredTags))} THEN 1 ELSE 0 END) > 0`)
            : []),
        // ensure we don't have any prohibited tags for each model
        ...(modelConfigsWithProhibitedTags.length > 0
            ? modelConfigsWithProhibitedTags.map(candidate => sql `sum(CASE WHEN ${and(eq(modelVersions.providerModelCode, candidate.model), eq(providers.code, candidate.provider), inArray(tags.name, candidate.prohibitedTags))} THEN 1 ELSE 0 END) = 0`)
            : []),
    ]))
        // ordering by model id is important as Ollama and other local models have some initial load time to consider
        // and switching models regularly can be slow
        .orderBy(modelVersions.id, testVersions.id, promptVersions.id);
    // The total number of missing tests needs to account for the number of attempts
    const totalMissingTests = missingTests.reduce((acc, test) => acc + (testsConfig.attempts - test.sessionsCount), 0);
    if (totalMissingTests === 0) {
        console.log('👌 No missing tests found.');
        return;
    }
    // ask for confirmation
    if (!(await askYesNo(`Are you sure you want to run all ${totalMissingTests} missing tests?`)))
        process.exit(0);
    console.log('Running all missing tests...');
    // For each missing test, we will run the test
    let i = 1;
    for (const test of missingTests) {
        const provider = llmProviders[test.providerCode];
        if (!provider)
            throw new Error(`Provider ${test.providerCode} not found`);
        const model = wrapModel(provider(test.modelVersionCode));
        const temperature = modelsWithTemperatures.get(`${test.providerCode}:${test.modelVersionCode}`) ?? testsConfig.candidatesTemperature;
        // We extract the array of messages
        const sections = getSectionsFromMarkdownContent(test.testContent);
        const messages = sectionsToAiMessages(sections);
        if (messages.length === 0) {
            console.log(`❌ No messages found for test ${test.testVersionId}`);
            break;
        }
        // for each missing attempt
        for (let attempt = test.sessionsCount; attempt < testsConfig.attempts; attempt++) {
            // run the test
            const startTime = Date.now();
            const response = await generateText({
                model,
                system: test.sysPromptContent,
                messages,
                temperature,
                maxTokens: MAX_TOKENS,
                abortSignal: AbortSignal.timeout(MAX_WAIT_TIME),
            });
            const endTime = Date.now();
            // add the response to the DB as a session
            await db.insert(sessions).values({
                testVersionId: test.testVersionId,
                candidateSysPromptVersionId: test.sysPromptVersionId,
                modelVersionId: test.modelVersionId,
                temperature,
                reasoning: response.reasoning?.trim(),
                answer: response.text.trim(),
                completionTokens: response.usage.completionTokens,
                cachedPromptTokensWritten: response.experimental_providerMetadata?.['anthropic']?.['cacheCreationInputTokens'] ?? undefined,
                cachedPromptTokensRead: response.experimental_providerMetadata?.['anthropic']?.['cacheReadInputTokens'] ??
                    response.experimental_providerMetadata?.['openai']?.['cachedPromptTokens'] ??
                    undefined,
                promptTokens: response.usage.promptTokens,
                timeTaken: endTime - startTime,
            });
            console.log(`✅ Completed test [${i} of ${totalMissingTests}] with model ${test.modelVersionCode} in ${
            // round to 2 decimal places
            ((endTime - startTime) / 1000).toFixed(2)}s`);
            i++;
        }
    }
};
