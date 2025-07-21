/**
 * This module is responsible for managing tests and updating them in the database.
 */
import fs from 'node:fs';
import { and, eq, ne, inArray, notInArray } from 'drizzle-orm';
import z from 'zod';
import { envConfig, SPECIAL_TAGS } from '../config/index.js';
import { listAllMdFiles } from '../utils/files.js';
import { extractFrontMatterAndTemplate, getVersionsFromReplacements, TagsValidation, ReplacementsValidation, getSectionsFromMarkdownContent, sectionsToNormalizedStrings, getReferencedFiles, } from '../utils/markdown.js';
import { generateHash } from '../utils/crypto.js';
import { db } from '../database/db.js';
import { schema } from '../database/schema.js';
const ConfigValidation = z.object({
    tags: TagsValidation.optional(),
    replacements: ReplacementsValidation.optional(),
    systemPrompts: z.array(z.string()).min(1),
    structuredResponseSchema: z.string().optional(),
    availableTools: z.array(z.string()).optional(),
}).refine(data => {
    const hasSchema = !!data.structuredResponseSchema;
    const hasTools = !!data.availableTools && data.availableTools.length > 0;
    return !(hasSchema && hasTools);
}, {
    message: 'Only one of structuredResponseSchema or availableTools can be specified, not both.',
    path: ['structuredResponseSchema', 'availableTools'],
});
const TestValidation = z.intersection(ConfigValidation, z.object({
    template: z.string(),
}));
/**
 * Fetches a test from a file, and optionally replaces placeholders with values.
 * The test file should be named `test.md` and be in the same directory as the current file.
 *
 * @param filePath The path to the test file
 *
 * @returns The test, with placeholders replaced if replacements are provided
 */
const getTestFromFile = async (filePath) => {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const { template, templateConfig } = extractFrontMatterAndTemplate(content);
    // Validate config
    const cnf = ConfigValidation.parse(templateConfig);
    return {
        template,
        tags: cnf.tags,
        replacements: cnf.replacements,
        systemPrompts: cnf.systemPrompts,
        structuredResponseSchema: cnf.structuredResponseSchema,
        availableTools: cnf.availableTools,
    };
};
/**
 * Update the tests in the database.
 * This function will read all test files from the tests directory and update the database with the new tests.
 * It will also update the test versions and tags associated with each test.
 */
export const updateTestsInDb = async () => {
    console.log('Updating tests in the database...');
    const _tests = new Map();
    const _testVersionHashes = new Set();
    const _testEvaluationPromptVersionHashes = new Set();
    for (const file of listAllMdFiles(envConfig.AI_TESTER_TESTS_DIR)) {
        const test = await getTestFromFile(file);
        const id = generateHash(test.template);
        if (_tests.has(id)) {
            throw new Error(`Duplicate test found: ${file}`);
        }
        _tests.set(id, test);
        // We need to validate the test template before we can continue
        const sections = getSectionsFromMarkdownContent(test.template);
        // For a test, valid sections must follow these rules:
        // - At least one section must be present
        // - The sections are then as follows
        //   - `system` (optional)
        //   - `user`
        //   - several more `assistant` and `user` sections can repeat in between (optional)
        //   - `evaluation`
        if (sections.length === 0) {
            throw new Error(`Test file must contain at least one section: ${file}`);
        }
        if (sections[0].type !== 'system' && sections[0].type !== 'user') {
            throw new Error(`First section must be 'system' or 'user': ${file}`);
        }
        // Note: in the future this will not be mandatory (ex: when evaluating deterministic answers)
        if (sections[sections.length - 1].type !== 'evaluation') {
            throw new Error(`Last section must be 'evaluation': ${file}`);
        }
        if (sections.length > 2) {
            for (let i = 1; i < sections.length - 1; i = i + 2) {
                if (sections[i].type !== 'assistant' || sections[i + 1].type !== 'user') {
                    const sectionNames = sections.map(s => s.type).join(', ');
                    throw new Error(`All sections in between the first and last section must alternate between 'assistant' then 'user', ending with 'user': ${file} (instead found ${sectionNames})`);
                }
            }
        }
    }
    const { testVersions, tags, testToTagRels, testToSystemPromptVersionRels, testEvaluationInstructionsVersions, testToEvaluationInstructionsRels, testToToolVersionRels, } = schema;
    await db.transaction(async (tx) => {
        for (const test of _tests.values()) {
            const contentVersions = getVersionsFromReplacements(test.template, test.replacements);
            for (const contentVersion of contentVersions) {
                // get a list of all special tags used, sort, and join them (they should be part of the hash)
                const specialTags = Array.from(SPECIAL_TAGS.keys())
                    .filter(tag => test.tags?.includes(tag) ?? false)
                    .sort()
                    .join(',');
                // split the content into pre eval and post eval instructions
                const splitContent = sectionsToNormalizedStrings(getSectionsFromMarkdownContent(contentVersion));
                // get all referenced files in the content
                const referencedFiles = getReferencedFiles(contentVersion, envConfig.AI_TESTER_TESTS_DIR, true);
                // if the test has a structuredResponseSchema, find the corresponding structured object version
                let structuredObjectVersionId = undefined;
                if (test.structuredResponseSchema) {
                    const code = String(test.structuredResponseSchema);
                    const structuredObject = await tx.query.structuredObjects.findFirst({
                        where: (obj, { eq }) => eq(obj.code, code),
                    });
                    if (!structuredObject) {
                        throw new Error(`Structured object not found for code: ${code}`);
                    }
                    const structuredObjectVersion = await tx.query.structuredObjectVersions.findFirst({
                        where: (ver, { eq, and }) => and(eq(ver.structuredObjectId, structuredObject.id), eq(ver.active, true)),
                    });
                    if (!structuredObjectVersion) {
                        throw new Error(`Active structured object version not found for code: ${code}`);
                    }
                    structuredObjectVersionId = structuredObjectVersion.id;
                }
                // if the test has available tools, we need to get the tool versions
                const referencedToolVersionIds = [];
                if (test.availableTools) {
                    for (const toolCode of test.availableTools) {
                        const toolInstance = await tx.query.tools.findFirst({
                            where: (tools, { eq }) => eq(tools.code, toolCode),
                            with: {
                                versions: {
                                    where: (version, { eq }) => eq(version.active, true),
                                },
                            },
                        });
                        if (!toolInstance) {
                            throw new Error(`Tool not found: ${toolCode}`);
                        }
                        if (toolInstance.versions.length === 0) {
                            throw new Error(`No active version found for tool: ${toolCode}`);
                        }
                        referencedToolVersionIds.push(toolInstance.versions[0].id);
                    }
                }
                // get a hash for the test
                const hash = generateHash(splitContent.normalizedPreEval +
                    specialTags +
                    (structuredObjectVersionId ? `|STRUCT_ID:${structuredObjectVersionId}|` : '') +
                    (referencedToolVersionIds.length > 0 ? `|TOOLS:${referencedToolVersionIds.join(',')}|` : '') +
                    referencedFiles.map(f => f.hash).join(''));
                _testVersionHashes.add(hash);
                const testInstance = (await tx
                    .insert(testVersions)
                    .values({ hash, content: splitContent.normalizedPreEval, structuredObjectVersionId })
                    .onConflictDoNothing()
                    .returning())[0] ??
                    (await tx.query.testVersions.findFirst({
                        where: (test, { eq }) => eq(test.hash, hash),
                    }));
                // if we have instructions for the evaluation, we need to store them
                if (splitContent.normalizedEval) {
                    // get a hash for the evaluation prompt
                    const evalPromptHash = generateHash(splitContent.normalizedEval);
                    _testEvaluationPromptVersionHashes.add(evalPromptHash);
                    const evalInstructionsInstance = (await tx
                        .insert(testEvaluationInstructionsVersions)
                        .values({
                        hash: evalPromptHash,
                        content: splitContent.normalizedEval,
                    })
                        .onConflictDoNothing()
                        .returning())[0] ??
                        (await tx.query.testEvaluationInstructionsVersions.findFirst({
                            where: (evalPrompt, { eq }) => eq(evalPrompt.hash, evalPromptHash),
                        }));
                    // Add the new one if needed
                    await tx
                        .insert(testToEvaluationInstructionsRels)
                        .values({
                        testVersionId: testInstance.id,
                        evaluationInstructionsVersionId: evalInstructionsInstance.id,
                    })
                        .onConflictDoNothing();
                    // Remove any other eval prompt previously associated with this test (if any)
                    await tx
                        .delete(testToEvaluationInstructionsRels)
                        .where(and(eq(testToEvaluationInstructionsRels.testVersionId, testInstance.id), ne(testToEvaluationInstructionsRels.evaluationInstructionsVersionId, evalInstructionsInstance.id)));
                }
                const tagInstances = [];
                for (const tagName of test.tags ?? []) {
                    const tagInstance = (await tx.insert(tags).values({ name: tagName }).onConflictDoNothing().returning())[0] ??
                        (await tx.query.tags.findFirst({
                            where: (tag, { eq }) => eq(tag.name, tagName),
                        }));
                    tagInstances.push(tagInstance);
                    // add tag to the test
                    await tx
                        .insert(testToTagRels)
                        .values({ tagId: tagInstance.id, testVersionId: testInstance.id })
                        .onConflictDoNothing();
                }
                // remove tags that are no longer associated with the test
                await tx.delete(testToTagRels).where(and(eq(testToTagRels.testVersionId, testInstance.id), notInArray(testToTagRels.tagId, tagInstances.map(tag => tag.id))));
                // add all system prompt versions to the test
                const sysPromptVersionInstances = [];
                for (const sysPrompt of test.systemPrompts) {
                    // get the id for that system prompt
                    const sysPromptInstance = await tx.query.prompts.findFirst({
                        columns: {},
                        where: (prompt, { eq }) => eq(prompt.code, sysPrompt),
                        with: {
                            versions: true,
                        },
                    });
                    if (!sysPromptInstance) {
                        throw new Error(`System prompt not found: ${sysPrompt}`);
                    }
                    for (const sysPromptVersionInstance of sysPromptInstance.versions) {
                        await tx
                            .insert(testToSystemPromptVersionRels)
                            .values({ testVersionId: testInstance.id, systemPromptVersionId: sysPromptVersionInstance.id })
                            .onConflictDoNothing();
                        sysPromptVersionInstances.push(sysPromptVersionInstance);
                    }
                }
                // Link tool versions to this test version
                if (referencedToolVersionIds.length > 0) {
                    for (const toolVersionId of referencedToolVersionIds) {
                        await tx
                            .insert(testToToolVersionRels)
                            .values({ testVersionId: testInstance.id, toolVersionId })
                            .onConflictDoNothing();
                    }
                }
                // Remove tool version relationships that are no longer associated with this test version
                await tx
                    .delete(testToToolVersionRels)
                    .where(and(eq(testToToolVersionRels.testVersionId, testInstance.id), notInArray(testToToolVersionRels.toolVersionId, referencedToolVersionIds)));
                // remove system prompts that are no longer associated with the test
                // for already run sessions, this will not remove the association as it is kept in the sessions table
                await tx.delete(testToSystemPromptVersionRels).where(and(eq(testToSystemPromptVersionRels.testVersionId, testInstance.id), notInArray(testToSystemPromptVersionRels.systemPromptVersionId, sysPromptVersionInstances.map(sysPrompt => sysPrompt.id))));
            }
        }
        /**
         * Activate or deactivate tests based on the files we have
         *
         * @param active Whether to activate or deactivate the tests
         */
        const activateOrDeactivate = (active, type) => {
            const arrFilterFnc = active ? inArray : notInArray;
            const typeProps = type === 'test_versions'
                ? {
                    table: testVersions,
                    activeField: testVersions.active,
                    hashField: testVersions.hash,
                    hashes: _testVersionHashes,
                }
                : {
                    table: testEvaluationInstructionsVersions,
                    activeField: testEvaluationInstructionsVersions.active,
                    hashField: testEvaluationInstructionsVersions.hash,
                    hashes: _testEvaluationPromptVersionHashes,
                };
            return tx
                .update(typeProps.table)
                .set({ active })
                .where(and(eq(typeProps.activeField, !active), arrFilterFnc(typeProps.hashField, Array.from(typeProps.hashes.keys()))));
        };
        // update tests that are no longer in our files, to set them as inactive
        await activateOrDeactivate(false, 'test_versions');
        // update tests that are now in our files, to set them as active
        await activateOrDeactivate(true, 'test_versions');
        // update evaluation prompts that are no longer in our files, to set them as inactive
        await activateOrDeactivate(false, 'eval_prompts');
        // update evaluation prompts that are now in our files, to set them as active
        await activateOrDeactivate(true, 'eval_prompts');
    });
    console.log('✅ Tests updated!');
};
