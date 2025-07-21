/**
 * This module is responsible for managing tool definitions and updating them in the database.
 */
import fs from 'node:fs';
import { inArray, notInArray } from 'drizzle-orm';
import { jsonSchema } from 'ai';
import z from 'zod';
import yaml from 'yaml';
import { envConfig } from '../config/index.js';
import { listAllYamlFiles } from '../utils/files.js';
import { generateHash } from '../utils/crypto.js';
import { db } from '../database/db.js';
import { schema } from '../database/schema.js';
export const ToolDefinition = z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.any(),
    // allow any additional fields
});
/**
 * Fetches a tool definition from a YAML file.
 * The file should be a YAML file with required fields.
 * @param filePath The path to the YAML file
 * @returns The tool definition
 */
const getToolFromFile = async (filePath) => {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = yaml.parse(content, { strict: false });
    const ToolValidation = z.union([
        ToolDefinition,
        z.object({
            id: z.string(),
            // allow any additional fields
        }),
    ]);
    ToolValidation.parse(parsed); // Validate the parsed object
    const id = parsed.id;
    delete parsed.id; // Remove id for schema validation
    // We make sure this is a valid JSON schema for the AI SDK
    jsonSchema(parsed);
    return {
        id,
        schema: parsed,
    };
};
/**
 * Update the tools in the database.
 * This function will read all YAML files from the tool definitions directory and update the database.
 * It will also update the tool versions for each tool.
 */
export const updateToolsInDb = async () => {
    console.log('Updating tools in the database...');
    const _tools = new Map();
    const _toolVersionHashes = new Set();
    if (!envConfig.AI_TESTER_TOOL_DEFINITIONS_DIR) {
        console.warn('AI_TESTER_TOOL_DEFINITIONS_DIR is not set in the environment. Skipping tools update.');
        return;
    }
    for (const file of listAllYamlFiles(envConfig.AI_TESTER_TOOL_DEFINITIONS_DIR)) {
        const tool = await getToolFromFile(file);
        if (_tools.has(tool.id)) {
            throw new Error(`Duplicate tool code found: ${tool.id}`);
        }
        _tools.set(tool.id, tool.schema);
    }
    const { tools, toolVersions } = schema;
    await db.transaction(async (tx) => {
        for (const [id, schemaObj] of _tools) {
            // Insert or get the tool row
            const toolInstance = (await tx.insert(tools).values({ code: id }).onConflictDoNothing().returning())[0] ??
                (await tx.query.tools.findFirst({
                    where: (tools, { eq }) => eq(tools.code, id),
                }));
            // Hash the data for versioning
            const hash = generateHash(JSON.stringify(schemaObj));
            _toolVersionHashes.add(hash);
            await tx
                .insert(toolVersions)
                .values({
                toolId: toolInstance.id,
                schema: JSON.stringify(schemaObj),
                hash,
            })
                .onConflictDoNothing();
        }
        // Activate/deactivate versions based on presence in files
        // Deactivate versions not present
        await tx
            .update(toolVersions)
            .set({ active: false })
            .where(
        // Deactivate if not in the current set
        notInArray(toolVersions.hash, Array.from(_toolVersionHashes)));
        // Activate versions present
        await tx
            .update(toolVersions)
            .set({ active: true })
            .where(inArray(toolVersions.hash, Array.from(_toolVersionHashes)));
    });
    console.log('✅ Tools updated!');
};
