/**
 * This module is responsible for running all session evaluations that have not been run yet.
 */
import { and, or, eq, not, inArray, sql, lt, countDistinct, aliasedTable } from 'drizzle-orm';
import { generateText, Output } from 'ai';
import z from 'zod';
import { schema } from '../database/schema.js';
import { getSectionsFromMarkdownContent, sectionsToAiMessages } from '../utils/markdown.js';
import { getRequiredLanguageModelTokenUsage, getTrimmedReasoningText } from '../utils/ai-sdk.js';
import { getModelCapabilityStatus, logCapabilitySkip, warnIfCapabilitiesUndeclared, } from './capabilities.js';
import { refreshEvaluationTokenLimitState } from './token-limits.js';
import { getConfiguredModelDefinition, getModelDefinitionForVersion, getModelVersionLabel, modelVersionMatchesDefinition, } from './model-definition-filters.js';
const evalSchema = z.object({
    // Note: `.nullable()` is not supported by some providers (like Vertex AI) as it generates an unsupported `anyOf` schema
    feedback: z
        .string()
        .optional()
        .describe('A string containing feedback for the AI candidate, based on the evaluation instructions, if the evaluation is negative. This feedback should be concise and focus on what failed to pass the evaluation.'),
    pass: z
        .boolean()
        .describe("A boolean value indicating whether the AI candidate's response is as expected in the evaluation instructions."),
});
const getMissingEvaluations = async (db, testsConfig, registry, envConfig, { log = true } = {}) => {
    if (log)
        console.log('Checking for evaluations to run...');
    await refreshEvaluationTokenLimitState(db, envConfig.MAX_EVALUATION_OUTPUT_TOKENS);
    if (testsConfig.candidates.length === 0) {
        console.log('⚠️ No active candidate models are configured.');
        return [];
    }
    if (testsConfig.evaluators.length === 0) {
        console.log('⚠️ No active evaluator models are configured.');
        return [];
    }
    // we query the DB to get all missing evaluations not yet run
    const { testVersions, prompts, testToTagRels, testEvaluationInstructionsVersions, testToEvaluationInstructionsRels, tags, sessions, modelVersions, providers, models, promptVersions, sessionEvaluations, } = schema;
    const evaluatorsWithDefinitions = testsConfig.evaluators.map(evaluator => ({
        ...evaluator,
        modelDefinition: getConfiguredModelDefinition(registry, evaluator),
    }));
    const candidatesWithDefinitions = testsConfig.candidates.map(candidate => ({
        ...candidate,
        modelDefinition: getConfiguredModelDefinition(registry, candidate),
    }));
    const modelConfigsWithTemperature = evaluatorsWithDefinitions.filter(evaluator => evaluator.temperature !== undefined);
    const modelConfigsWithTags = evaluatorsWithDefinitions.filter(candidate => candidate.requiredTags !== undefined && candidate.requiredTags.length > 0);
    const modelConfigsWithProhibitedTags = evaluatorsWithDefinitions.filter(candidate => candidate.prohibitedTags !== undefined && candidate.prohibitedTags.length > 0);
    const candidateModelConfigsWithTemperature = candidatesWithDefinitions.filter(candidate => candidate.temperature !== undefined);
    const candidateModelConfigsWithTags = candidatesWithDefinitions.filter(candidate => candidate.requiredTags !== undefined && candidate.requiredTags.length > 0);
    const candidateModelConfigsWithProhibitedTags = candidatesWithDefinitions.filter(candidate => candidate.prohibitedTags !== undefined && candidate.prohibitedTags.length > 0);
    const candidateModelVersionAlias = aliasedTable(modelVersions, 'candidate_model_version_alias');
    const candidateProviderAlias = aliasedTable(providers, 'candidate_provider_alias');
    const candidateModelAlias = aliasedTable(models, 'candidate_model_alias');
    const evaluatorModelAlias = aliasedTable(models, 'evaluator_model_alias');
    const testSysPromptAlias = aliasedTable(promptVersions, 'test_sys_prompt_alias');
    const missingEvaluations = await db
        .select({
        modelVersionId: modelVersions.id,
        modelVersionCode: modelVersions.providerModelCode,
        modelVersionExtraIdentifier: modelVersions.extraIdentifier,
        modelVersionRuntimeOptionsJson: modelVersions.runtimeOptionsJson,
        providerCode: providers.code,
        testVersionId: testVersions.id,
        testContent: testVersions.content,
        sessionId: sessions.id,
        sessionAnswer: sessions.answer,
        evalPromptVersionId: promptVersions.id,
        evalPromptContent: promptVersions.content,
        evalInstructionsId: testEvaluationInstructionsVersions.id,
        evalInstructionsContent: testEvaluationInstructionsVersions.content,
        evaluationsCount: countDistinct(sessionEvaluations.id),
    })
        .from(modelVersions)
        .innerJoin(evaluatorModelAlias, and(eq(evaluatorModelAlias.id, modelVersions.modelId), eq(evaluatorModelAlias.active, true), eq(modelVersions.active, true)))
        .innerJoin(providers, and(eq(providers.id, modelVersions.providerId), eq(providers.active, true), or(...evaluatorsWithDefinitions.map(evaluator => modelVersionMatchesDefinition(providers, modelVersions, evaluator.modelDefinition, 'evaluator')))))
        // always true to fetch all possible session combinations (we will filter later - cross joins aren't supported in drizzle-orm as of now)
        .innerJoin(sessions, and(eq(sessions.id, sessions.id), eq(sessions.active, true), candidateModelConfigsWithTemperature.length > 0
        ? sql `${sessions.temperature} = CASE
							${sql.join(candidateModelConfigsWithTemperature.map(candidate => sql `WHEN
											${modelVersionMatchesDefinition(candidateProviderAlias, candidateModelVersionAlias, candidate.modelDefinition, 'candidate')}
											THEN ${candidate.temperature}`))}
							ELSE ${testsConfig.candidatesTemperature}
						END`
        : eq(sessions.temperature, testsConfig.candidatesTemperature)))
        .innerJoin(candidateModelVersionAlias, eq(candidateModelVersionAlias.id, sessions.modelVersionId))
        .innerJoin(candidateModelAlias, and(eq(candidateModelAlias.id, candidateModelVersionAlias.modelId), eq(candidateModelAlias.active, true), eq(candidateModelVersionAlias.active, true)))
        .innerJoin(candidateProviderAlias, and(eq(candidateProviderAlias.id, candidateModelVersionAlias.providerId), eq(candidateProviderAlias.active, true), or(...candidatesWithDefinitions.map(candidate => modelVersionMatchesDefinition(candidateProviderAlias, candidateModelVersionAlias, candidate.modelDefinition, 'candidate')))))
        .innerJoin(prompts, eq(prompts.code, '_evaluator_default'))
        .innerJoin(promptVersions, and(eq(promptVersions.promptId, prompts.id), eq(promptVersions.active, true)))
        // we add the evaluation prompt version to the query
        .innerJoin(testToEvaluationInstructionsRels, eq(testToEvaluationInstructionsRels.testVersionId, sessions.testVersionId))
        .innerJoin(testEvaluationInstructionsVersions, and(eq(testEvaluationInstructionsVersions.id, testToEvaluationInstructionsRels.evaluationInstructionsVersionId), eq(testEvaluationInstructionsVersions.active, true)))
        .leftJoin(sessionEvaluations, and(eq(sessionEvaluations.sessionId, sessions.id), eq(sessionEvaluations.modelVersionId, modelVersions.id), eq(sessionEvaluations.evaluationPromptVersionId, promptVersions.id), eq(sessionEvaluations.testEvaluationInstructionsVersionId, testEvaluationInstructionsVersions.id), eq(sessionEvaluations.active, true), modelConfigsWithTemperature.length > 0
        ? sql `${sessionEvaluations.temperature} = CASE
								${sql.join(modelConfigsWithTemperature.map(evaluator => sql `WHEN
												${modelVersionMatchesDefinition(providers, modelVersions, evaluator.modelDefinition, 'evaluator')}
												THEN ${evaluator.temperature}`))}
								ELSE ${testsConfig.evaluatorsTemperature}
							END`
        : eq(sessionEvaluations.temperature, testsConfig.evaluatorsTemperature)))
        // We will need to filter by tags
        .innerJoin(testVersions, and(eq(testVersions.id, sessions.testVersionId), eq(testVersions.active, true)))
        // we also need to ensure everything is still active there
        // .innerJoin(testToSystemPromptVersionRels, eq(testToSystemPromptVersionRels.testVersionId, testVersions.id))
        .innerJoin(testSysPromptAlias, and(eq(testSysPromptAlias.id, sessions.candidateSysPromptVersionId), eq(testSysPromptAlias.active, true)))
        .innerJoin(testToTagRels, eq(testToTagRels.testVersionId, testVersions.id))
        .innerJoin(tags, eq(tags.id, testToTagRels.tagId))
        .groupBy(modelVersions.id, sessions.id, promptVersions.id)
        .having(({ evaluationsCount }) => and(
    // Ensure we only get tests that have not been run enough times yet
    lt(evaluationsCount, testsConfig.evaluationsPerEvaluator), 
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
            ? modelConfigsWithTags.map(evaluator => sql `sum(CASE WHEN ${or(not(modelVersionMatchesDefinition(providers, modelVersions, evaluator.modelDefinition, 'evaluator')), inArray(tags.name, evaluator.requiredTags))} THEN 1 ELSE 0 END) > 0`)
            : []),
        // ensure we don't have any prohibited tags for each model
        ...(modelConfigsWithProhibitedTags.length > 0
            ? modelConfigsWithProhibitedTags.map(evaluator => sql `sum(CASE WHEN ${and(modelVersionMatchesDefinition(providers, modelVersions, evaluator.modelDefinition, 'evaluator'), inArray(tags.name, evaluator.prohibitedTags))} THEN 1 ELSE 0 END) = 0`)
            : []),
        // ensure we have all required tags for each candidate model
        ...(candidateModelConfigsWithTags.length > 0
            ? candidateModelConfigsWithTags.map(candidate => sql `sum(CASE WHEN ${or(not(modelVersionMatchesDefinition(candidateProviderAlias, candidateModelVersionAlias, candidate.modelDefinition, 'candidate')), inArray(tags.name, candidate.requiredTags))} THEN 1 ELSE 0 END) > 0`)
            : []),
        // ensure we don't have any prohibited tags for each candidate model
        ...(candidateModelConfigsWithProhibitedTags.length > 0
            ? candidateModelConfigsWithProhibitedTags.map(candidate => sql `sum(CASE WHEN ${and(modelVersionMatchesDefinition(candidateProviderAlias, candidateModelVersionAlias, candidate.modelDefinition, 'candidate'), inArray(tags.name, candidate.prohibitedTags))} THEN 1 ELSE 0 END) = 0`)
            : []),
    ]))
        // ordering by model id is important as Ollama and other local models have some initial load time to consider
        // and switching models regularly can be slow
        .orderBy(modelVersions.id, sessions.id, promptVersions.id);
    const warnedModelReferences = new Set();
    const requirements = {
        input: ['text'],
        output: ['structured'],
    };
    return missingEvaluations.filter(evaluation => {
        const modelReference = getModelVersionLabel(registry, evaluation);
        const modelDefinition = getModelDefinitionForVersion(registry, evaluation);
        if (log)
            warnIfCapabilitiesUndeclared(modelDefinition, modelReference, warnedModelReferences);
        const capabilityStatus = getModelCapabilityStatus(modelDefinition, requirements);
        if (capabilityStatus && !capabilityStatus.supported) {
            if (log) {
                logCapabilitySkip('evaluation', modelReference, evaluation.sessionId, capabilityStatus.missing);
            }
            return false;
        }
        return true;
    });
};
export const runAllEvaluationsWithDeps = async ({ db, testsConfig, registry, confirmRun, getProvider, wrapModel, generateText: generateTextFn, logModelError, envConfig, state, }) => {
    state.startRun();
    const { sessionEvaluations } = schema;
    const missingEvaluations = await getMissingEvaluations(db, testsConfig, registry, envConfig);
    const modelConfigsWithTemperature = testsConfig.evaluators.filter(evaluator => evaluator.temperature !== undefined);
    const modelsWithTemperatures = new Map(modelConfigsWithTemperature.map(({ id, temperature }) => [id, temperature]));
    // The total number of missing evaluations needs to account for the number of judgments
    const totalMissingEvaluations = missingEvaluations.reduce((acc, evaluation) => acc + (testsConfig.evaluationsPerEvaluator - evaluation.evaluationsCount), 0);
    if (totalMissingEvaluations === 0) {
        console.log('👌 No missing evaluations found.');
        return;
    }
    // ask for confirmation
    if (!(await confirmRun(`Are you sure you want to run all ${totalMissingEvaluations} missing evaluations?`)))
        return;
    console.log('Running all missing evaluations...');
    // For each missing test, we will run the test
    let i = 1;
    for (const evaluation of missingEvaluations) {
        const provider = getProvider(evaluation.providerCode);
        if (!provider)
            throw new Error(`Provider ${evaluation.providerCode} not found`);
        const modelDefinition = getModelDefinitionForVersion(registry, evaluation);
        const model = wrapModel(provider(evaluation.modelVersionCode), 'evaluator', modelDefinition);
        const temperature = (modelDefinition ? modelsWithTemperatures.get(modelDefinition.id) : undefined) ?? testsConfig.evaluatorsTemperature;
        // We extract the array of messages
        const sections = getSectionsFromMarkdownContent(evaluation.evalPromptContent);
        // const testSections = parseMarkdownContent(evaluation.testContent)
        // const evaluationInstructions = extractEvalInstrFromParsedContent(testSections)
        const evaluationInstructions = evaluation.evalInstructionsContent;
        if (!evaluationInstructions)
            throw new Error('💥 Evaluation instructions not found!');
        for (const section of sections) {
            if (section.type === 'system')
                section.content = section.content.replace('{{_evaluationInstructions}}', evaluationInstructions);
            else if (section.type === 'user')
                section.content = section.content.replace('{{_actualResponse}}', evaluation.sessionAnswer);
        }
        const messages = sectionsToAiMessages(sections, true);
        if (messages.length === 0) {
            console.log(`❌ No messages found for evaluation ${evaluation.evalPromptVersionId}`);
            break;
        }
        // for each missing judgment
        for (let judgment = evaluation.evaluationsCount; judgment < testsConfig.evaluationsPerEvaluator; judgment++) {
            // run the test
            const startTime = Date.now();
            let response;
            try {
                response = await generateTextFn({
                    model,
                    messages,
                    temperature,
                    output: Output.object({ schema: evalSchema }),
                    maxOutputTokens: envConfig.MAX_EVALUATION_OUTPUT_TOKENS,
                    abortSignal: AbortSignal.timeout(envConfig.MAX_WAIT_TIME),
                });
            }
            catch (err) {
                logModelError(err, 'eval', i, totalMissingEvaluations, evaluation.modelVersionCode);
                const skippedJudgments = testsConfig.evaluationsPerEvaluator - judgment - 1;
                i += testsConfig.evaluationsPerEvaluator - judgment;
                if (skippedJudgments > 0)
                    console.log(`⏭️ Skipping ${skippedJudgments} similar judgment(s)...`);
                break;
            }
            const endTime = Date.now();
            let completionTokens, promptTokens;
            try {
                ;
                ({ completionTokens, promptTokens } = getRequiredLanguageModelTokenUsage(response.usage));
            }
            catch (err) {
                logModelError(err, 'eval', i, totalMissingEvaluations, evaluation.modelVersionCode);
                const skippedJudgments = testsConfig.evaluationsPerEvaluator - judgment - 1;
                i += testsConfig.evaluationsPerEvaluator - judgment;
                if (skippedJudgments > 0)
                    console.log(`⏭️ Skipping ${skippedJudgments} similar judgment(s)...`);
                break;
            }
            // add the response to the DB as a session
            const trimmedFeedback = response.output.feedback?.trim();
            const reasoning = getTrimmedReasoningText(response.reasoningText);
            await db.insert(sessionEvaluations).values({
                sessionId: evaluation.sessionId,
                evaluationPromptVersionId: evaluation.evalPromptVersionId,
                testEvaluationInstructionsVersionId: evaluation.evalInstructionsId,
                modelVersionId: evaluation.modelVersionId,
                temperature,
                reasoning,
                pass: response.output.pass ? 1 : 0,
                feedback: trimmedFeedback ? trimmedFeedback : null,
                completionTokens,
                promptTokens,
                timeTaken: endTime - startTime,
                finishReason: response.finishReason ?? null,
                maxOutputTokens: envConfig.MAX_EVALUATION_OUTPUT_TOKENS,
            });
            console.log(`✅ Completed eval [${i} of ${totalMissingEvaluations}] with model ${evaluation.modelVersionCode} in ${
            // round to 2 decimal places
            ((endTime - startTime) / 1000).toFixed(2)}s`);
            i++;
        }
    }
    state.endRun();
};
const createDefaultEvaluationRunnerDeps = async () => {
    const [{ resolveTestsConfig, envConfig, getFileBackedModelRegistry }, { db }, { askYesNo }, { getProvider, wrapModel }, { logModelError }, { state },] = await Promise.all([
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
export const countMissingEvaluations = async ({ testsConfig, } = {}) => {
    const [{ resolveTestsConfig, getFileBackedModelRegistry, envConfig }, { db }] = await Promise.all([
        import('../config/index.js'),
        import('../database/db.js'),
    ]);
    const resolvedTestsConfig = testsConfig ?? resolveTestsConfig();
    const missingEvaluations = await getMissingEvaluations(db, resolvedTestsConfig, getFileBackedModelRegistry(), envConfig, {
        log: false,
    });
    return missingEvaluations.reduce((acc, evaluation) => acc + (resolvedTestsConfig.evaluationsPerEvaluator - evaluation.evaluationsCount), 0);
};
export const runAllEvaluations = async ({ confirmRun, testsConfig, registry } = {}) => runAllEvaluationsWithDeps({
    ...(await createDefaultEvaluationRunnerDeps()),
    ...(confirmRun ? { confirmRun } : {}),
    ...(testsConfig ? { testsConfig } : {}),
    ...(registry ? { registry } : {}),
});
