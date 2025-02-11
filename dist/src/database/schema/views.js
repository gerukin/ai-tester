import { sqliteView } from 'drizzle-orm/sqlite-core';
import { eq, aliasedTable, desc, sql } from 'drizzle-orm';
import { modelVersions } from './models.js';
import { testToTagRels, tags } from './tags.js';
import { promptVersions } from './prompts.js';
import { sessions, sessionEvaluations } from './sessions.js';
import { testVersions, testEvaluationInstructionsVersions } from './tests.js';
export const evaluatedSessionsView = sqliteView('evaluated_sessions_view').as(qb => {
    const evalPromptAlias = aliasedTable(promptVersions, 'eval_prompt_version');
    const evalModelAlias = aliasedTable(modelVersions, 'eval_model_version');
    return qb
        .select({
        candidate_model: modelVersions.providerModelCode,
        sys_prompt: promptVersions.content,
        test_prompt: testVersions.content,
        reasoning: sessions.reasoning,
        answer: sessions.answer,
        eval_inst: testEvaluationInstructionsVersions.content,
        evaluator_model: evalModelAlias.providerModelCode,
        pass: sessionEvaluations.pass,
        feedback: sessionEvaluations.feedback,
        // temperature fields
        candidate_temp: sessions.temperature,
        evaluator_temp: sessionEvaluations.temperature,
        // tag fields as an array
        tags: sql `group_concat(${tags.name}, ', ')`.as(`tags`),
        // active marker fields
        sys_prompt_active: promptVersions.active,
        test_prompt_active: testVersions.active,
        eval_inst_active: testEvaluationInstructionsVersions.active,
        eval_sys_prompt_active: evalPromptAlias.active,
        // created_at fields
        session_at: sessions.createdAt,
        evaluation_at: sessionEvaluations.createdAt,
        // less relevant fields but useful for debugging
        session_id: sessions.id,
        test_version_id: testVersions.id,
        candidate_model_version_id: sessions.modelVersionId,
        candidate_sys_prompt_version_id: sessions.candidateSysPromptVersionId,
        evaluator_model_version_id: sessionEvaluations.modelVersionId,
        test_evaluation_instructions_version_id: sessionEvaluations.testEvaluationInstructionsVersionId,
        evaluation_prompt_version_id: sessionEvaluations.evaluationPromptVersionId,
        session_evaluation_id: sessionEvaluations.id,
        eval_sys_prompt: evalPromptAlias.content,
    })
        .from(sessions)
        .innerJoin(testVersions, eq(sessions.testVersionId, testVersions.id))
        .innerJoin(modelVersions, eq(sessions.modelVersionId, modelVersions.id))
        .innerJoin(promptVersions, eq(sessions.candidateSysPromptVersionId, promptVersions.id))
        .leftJoin(sessionEvaluations, eq(sessions.id, sessionEvaluations.sessionId))
        .leftJoin(evalPromptAlias, eq(sessionEvaluations.evaluationPromptVersionId, evalPromptAlias.id))
        .leftJoin(testEvaluationInstructionsVersions, eq(sessionEvaluations.testEvaluationInstructionsVersionId, testEvaluationInstructionsVersions.id))
        .leftJoin(evalModelAlias, eq(sessionEvaluations.modelVersionId, evalModelAlias.id))
        .innerJoin(testToTagRels, eq(testVersions.id, testToTagRels.testVersionId))
        .innerJoin(tags, eq(testToTagRels.tagId, tags.id))
        .groupBy(sessions.id, sessionEvaluations.id)
        .orderBy(desc(sessionEvaluations.createdAt), desc(sessions.createdAt));
});
