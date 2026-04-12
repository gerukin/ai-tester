/**
 * This module is responsible for running all test sessions that have not been run yet.
 */
import { and, or, eq, ne, inArray, sql, lt, countDistinct } from 'drizzle-orm';
import { generateText, jsonSchema, Output, } from 'ai';
import { schema } from '../database/schema.js';
import { getSectionsFromMarkdownContent, sectionsToAiMessages, getReferencedFiles } from '../utils/markdown.js';
import { ToolDefinition } from './tool-definition.js';
import { getRequiredLanguageModelTokenUsage, getTrimmedReasoningText } from '../utils/ai-sdk.js';
import { getModelCapabilityStatus, getReferencedFileInputCapabilities, logCapabilitySkip, warnIfCapabilitiesUndeclared, } from './capabilities.js';
import { refreshSessionTokenLimitState } from './token-limits.js';
/**
 * Logs the number of skipped tests based on the current attempt and total attempts.
 * @param attempts The total number of attempts for the test.
 * @param attempt The current attempt index.
 * @returns The number of skipped attempts.
 */
const logSkippedTests = (attempts, attempt) => {
    const skippedAttempts = attempts - attempt - 1;
    if (skippedAttempts > 0)
        console.log(`⏭️ Skipping ${skippedAttempts} similar attempt(s)...`);
    return skippedAttempts;
};
const getMissingTests = async (db, testsConfig, registry, envConfig, { log = true } = {}) => {
    if (log)
        console.log('Checking for tests to run...');
    await refreshSessionTokenLimitState(db, envConfig.MAX_TEST_OUTPUT_TOKENS);
    if (testsConfig.candidates.length === 0) {
        console.log('⚠️ No active candidate models are configured.');
        return [];
    }
    // we query the DB to get all missing tests not yet run
    const { testVersions, testToTagRels, tags, sessions, modelVersions, providers, models, testToSystemPromptVersionRels, promptVersions, structuredObjectVersions, toolVersions, testToToolVersionRels, } = schema;
    const modelConfigsWithTemperature = testsConfig.candidates.filter(candidate => candidate.temperature !== undefined);
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
        structuredObjectSchema: structuredObjectVersions.schema,
        toolVersionSchemas: sql `(
				SELECT
					CASE
						WHEN count(*) = 0 THEN NULL
						ELSE json_group_array(${toolVersions.schema})
					END
				FROM ${toolVersions}
				INNER JOIN ${testToToolVersionRels}
					ON ${eq(testToToolVersionRels.toolVersionId, toolVersions.id)}
					AND ${eq(testToToolVersionRels.testVersionId, testVersions.id)}
			)`,
    })
        .from(modelVersions)
        .innerJoin(models, and(eq(models.id, modelVersions.modelId), eq(models.active, true), eq(modelVersions.active, true)))
        .innerJoin(providers, and(eq(providers.id, modelVersions.providerId), eq(providers.active, true), or(...testsConfig.candidates.map(({ provider, model }) => and(eq(providers.code, provider), eq(modelVersions.providerModelCode, model))))))
        // always true to fetch all possible test combinations (we will filter later - cross joins aren't supported in drizzle-orm as of now)
        .innerJoin(testVersions, and(eq(testVersions.id, testVersions.id), eq(testVersions.active, true)))
        // Join the expected structured object version if needed
        .leftJoin(structuredObjectVersions, eq(testVersions.structuredObjectVersionId, structuredObjectVersions.id))
        // Join tool version relationships and tool versions
        .leftJoin(testToToolVersionRels, eq(testToToolVersionRels.testVersionId, testVersions.id))
        .leftJoin(toolVersions, eq(toolVersions.id, testToToolVersionRels.toolVersionId))
        .innerJoin(testToSystemPromptVersionRels, eq(testToSystemPromptVersionRels.testVersionId, testVersions.id))
        .innerJoin(promptVersions, and(eq(promptVersions.id, testToSystemPromptVersionRels.systemPromptVersionId), eq(promptVersions.active, true)))
        .leftJoin(sessions, and(eq(sessions.testVersionId, testVersions.id), eq(sessions.modelVersionId, modelVersions.id), eq(sessions.candidateSysPromptVersionId, promptVersions.id), eq(sessions.active, true), modelConfigsWithTemperature.length > 0
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
    const warnedModelReferences = new Set();
    return missingTests.filter(test => {
        const modelReference = `${test.providerCode}:${test.modelVersionCode}`;
        const modelDefinition = registry.modelsByReference.get(modelReference);
        const files = getReferencedFiles(test.testContent, envConfig.AI_TESTER_TESTS_DIR);
        const outputRequirements = test.structuredObjectSchema
            ? ['structured']
            : test.toolVersionSchemas
                ? ['tools']
                : ['text'];
        const requirements = {
            input: ['text', ...getReferencedFileInputCapabilities(files)],
            output: outputRequirements,
        };
        if (log)
            warnIfCapabilitiesUndeclared(modelDefinition, modelReference, warnedModelReferences);
        const capabilityStatus = getModelCapabilityStatus(modelDefinition, requirements);
        if (capabilityStatus && !capabilityStatus.supported) {
            if (log) {
                logCapabilitySkip('test', modelReference, test.testVersionId, capabilityStatus.missing);
            }
            return false;
        }
        return true;
    });
};
export const runAllTestsWithDeps = async ({ db, testsConfig, registry, confirmRun, getProvider, wrapModel, generateText: generateTextFn, logModelError, envConfig, state, }) => {
    state.startRun();
    const { sessions } = schema;
    const missingTests = await getMissingTests(db, testsConfig, registry, envConfig);
    const modelConfigsWithTemperature = testsConfig.candidates.filter(candidate => candidate.temperature !== undefined);
    const modelsWithTemperatures = new Map(modelConfigsWithTemperature.map(({ provider, model, temperature }) => [`${provider}:${model}`, temperature]));
    // The total number of missing tests needs to account for the number of attempts
    const totalMissingTests = missingTests.reduce((acc, test) => acc + (testsConfig.attempts - test.sessionsCount), 0);
    if (totalMissingTests === 0) {
        console.log('👌 No missing tests found.');
        return;
    }
    // ask for confirmation
    if (!(await confirmRun(`Are you sure you want to run all ${totalMissingTests} missing tests?`)))
        return;
    console.log('Running all missing tests...');
    // For each missing test, we will run the test
    let i = 1;
    for (const test of missingTests) {
        const provider = getProvider(test.providerCode);
        if (!provider)
            throw new Error(`Provider ${test.providerCode} not found`);
        const modelDefinition = registry.modelsByReference.get(`${test.providerCode}:${test.modelVersionCode}`);
        const model = wrapModel(provider(test.modelVersionCode), 'candidate', modelDefinition);
        const temperature = modelsWithTemperatures.get(`${test.providerCode}:${test.modelVersionCode}`) ?? testsConfig.candidatesTemperature;
        // We extract the array of messages
        const sections = getSectionsFromMarkdownContent(test.testContent);
        const files = getReferencedFiles(test.testContent, envConfig.AI_TESTER_TESTS_DIR, false, 'base64');
        const messages = sectionsToAiMessages(sections, false, files);
        if (messages.length === 0) {
            console.log(`❌ No messages found for test ${test.testVersionId}`);
            break;
        }
        // for each missing attempt
        for (let attempt = test.sessionsCount; attempt < testsConfig.attempts; attempt++) {
            // run the test
            const startTime = Date.now();
            let response, answer, reasoning;
            if (test.structuredObjectSchema) {
                // If a structured object schema is present, use structured output.
                try {
                    const structuredResponse = await generateTextFn({
                        model,
                        system: test.sysPromptContent,
                        messages,
                        temperature,
                        output: Output.object({ schema: jsonSchema(test.structuredObjectSchema) }),
                        maxOutputTokens: envConfig.MAX_TEST_OUTPUT_TOKENS,
                        abortSignal: AbortSignal.timeout(envConfig.MAX_WAIT_TIME),
                    });
                    response = structuredResponse;
                }
                catch (err) {
                    logModelError(err, 'test', i, totalMissingTests, test.modelVersionCode);
                    i += logSkippedTests(testsConfig.attempts, attempt);
                    break;
                }
                answer = JSON.stringify(response.output);
            }
            else {
                // Otherwise, use generateText
                // First check if we have tools we can use
                let toolSet = undefined;
                if (test.toolVersionSchemas) {
                    const topArray = JSON.parse(test.toolVersionSchemas);
                    for (const toolVersionSchema of topArray ?? []) {
                        if (!toolSet)
                            toolSet = {};
                        const toolVersion = JSON.parse(toolVersionSchema);
                        // Add subsequent tool version schemas to the existing toolSet
                        toolSet[toolVersion.name] = {
                            inputSchema: jsonSchema(toolVersion.parameters),
                            description: toolVersion.description,
                        };
                    }
                }
                try {
                    response = await generateTextFn({
                        model,
                        system: test.sysPromptContent,
                        messages,
                        temperature,
                        tools: toolSet,
                        maxOutputTokens: envConfig.MAX_TEST_OUTPUT_TOKENS,
                        abortSignal: AbortSignal.timeout(envConfig.MAX_WAIT_TIME),
                    });
                }
                catch (err) {
                    logModelError(err, 'test', i, totalMissingTests, test.modelVersionCode);
                    i += logSkippedTests(testsConfig.attempts, attempt);
                    break;
                }
                // if we called a tool, we need to extract the call(s) as the answer
                if (response.toolCalls?.length > 0) {
                    answer = JSON.stringify(response.toolCalls.map(call => ({ name: call.toolName, arguments: call.input })));
                }
                else {
                    answer = response.text.trim();
                }
            }
            reasoning = getTrimmedReasoningText(response.reasoningText);
            const endTime = Date.now();
            let cachedPromptTokensRead, cachedPromptTokensWritten, completionTokens, promptTokens;
            try {
                ;
                ({
                    cachedPromptTokensRead,
                    cachedPromptTokensWritten,
                    completionTokens,
                    promptTokens,
                } = getRequiredLanguageModelTokenUsage(response.usage));
            }
            catch (err) {
                logModelError(err, 'test', i, totalMissingTests, test.modelVersionCode);
                i += logSkippedTests(testsConfig.attempts, attempt);
                break;
            }
            // add the response to the DB as a session
            await db.insert(sessions).values({
                testVersionId: test.testVersionId,
                candidateSysPromptVersionId: test.sysPromptVersionId,
                modelVersionId: test.modelVersionId,
                temperature,
                reasoning,
                answer,
                completionTokens,
                cachedPromptTokensWritten,
                cachedPromptTokensRead,
                promptTokens,
                timeTaken: endTime - startTime,
                finishReason: response.finishReason ?? null,
                maxOutputTokens: envConfig.MAX_TEST_OUTPUT_TOKENS,
            });
            console.log(`✅ Completed test [${i} of ${totalMissingTests}] with model ${test.modelVersionCode} in ${
            // round to 2 decimal places
            ((endTime - startTime) / 1000).toFixed(2)}s`);
            i++;
        }
    }
    state.endRun();
};
const createDefaultSessionRunnerDeps = async () => {
    const [{ resolveTestsConfig, getFileBackedModelRegistry, envConfig }, { db }, { askYesNo }, { getProvider, wrapModel }, { logModelError }, { state },] = await Promise.all([
        import('../config/index.js'),
        import('../database/db.js'),
        import('../utils/menus.js'),
        import('../llms/index.js'),
        import('../utils/errors.js'),
        import('../utils/state.js'),
    ]);
    return {
        db,
        testsConfig: resolveTestsConfig(),
        registry: getFileBackedModelRegistry(),
        confirmRun: askYesNo,
        getProvider,
        wrapModel,
        generateText,
        logModelError,
        envConfig,
        state,
    };
};
export const countMissingTests = async ({ testsConfig } = {}) => {
    const [{ resolveTestsConfig, getFileBackedModelRegistry, envConfig }, { db }] = await Promise.all([
        import('../config/index.js'),
        import('../database/db.js'),
    ]);
    const resolvedTestsConfig = testsConfig ?? resolveTestsConfig();
    const missingTests = await getMissingTests(db, resolvedTestsConfig, getFileBackedModelRegistry(), envConfig, { log: false });
    return missingTests.reduce((acc, test) => acc + (resolvedTestsConfig.attempts - test.sessionsCount), 0);
};
export const runAllTests = async ({ confirmRun, testsConfig, registry } = {}) => runAllTestsWithDeps({
    ...(await createDefaultSessionRunnerDeps()),
    ...(confirmRun ? { confirmRun } : {}),
    ...(testsConfig ? { testsConfig } : {}),
    ...(registry ? { registry } : {}),
});
