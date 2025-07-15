/**
 * This module is responsible for managing structured objects and updating them in the database.
 */

import fs from 'node:fs'
import { inArray, notInArray } from 'drizzle-orm'
import { jsonSchema } from 'ai'
import z from 'zod'
import yaml from 'yaml'

import { envConfig } from '../config/index.js'
import { listAllYamlFiles } from '../utils/files.js'
import { generateHash } from '../utils/crypto.js'
import { db } from '../database/db.js'
import { schema } from '../database/schema.js'

/**
 * Fetches a structured object from a YAML file.
 * The file should be a YAML file with required fields.
 * @param filePath The path to the YAML file
 * @returns The structured object
 */
const getStructuredObjectFromFile = async (filePath: string): Promise<{ id: string; schema: any }> => {
	const content = await fs.promises.readFile(filePath, 'utf-8')
	const parsed = yaml.parse(content, { strict: false })
	const StructuredObjectValidation = z.object({
		id: z.string(),
		// allow any additional fields
	})
	StructuredObjectValidation.parse(parsed) // Validate the parsed object
	const id = parsed.id
	delete parsed.id // Remove id for schema validation

	// We make sure this is a valid JSON schema for the AI SDK
	jsonSchema(parsed)

	return {
		id,
		schema: parsed,
	}
}

/**
 * Update the structured objects in the database.
 * This function will read all JSON files from the structured schemas directory and update the database.
 * It will also update the object versions for each object.
 */
export const updateStructuredObjectsInDb = async () => {
	console.log('Updating structured objects in the database...')

	const _objects = new Map<string, any>()
	const _objectVersionHashes = new Set<string>()

	if (!envConfig.AI_TESTER_STRUCTURED_SCHEMAS_DIR) {
		console.warn('AI_TESTER_STRUCTURED_SCHEMAS_DIR is not set in the environment. Skipping structured objects update.')
		return
	}

	for (const file of listAllYamlFiles(envConfig.AI_TESTER_STRUCTURED_SCHEMAS_DIR)) {
		const obj = await getStructuredObjectFromFile(file)
		if (_objects.has(obj.id)) {
			throw new Error(`Duplicate structured object ID found: ${obj.id}`)
		}
		_objects.set(obj.id, obj.schema)
	}

	const { structuredObjects, structuredObjectVersions } = schema

	await db.transaction(async tx => {
		for (const [id, schema] of _objects) {
			// Insert or get the structured object row
			const objectInstance =
				(await tx.insert(structuredObjects).values({ code: id }).onConflictDoNothing().returning())[0] ??
				(await tx.query.structuredObjects.findFirst({
					where: (structuredObjects, { eq }) => eq(structuredObjects.code, id),
				}))

			// Hash the data for versioning
			const hash = generateHash(JSON.stringify(schema))
			_objectVersionHashes.add(hash)

			await tx
				.insert(structuredObjectVersions)
				.values({
					structuredObjectId: objectInstance.id,
					schema: schema,
					hash,
				})
				.onConflictDoNothing()
		}

		// Activate/deactivate versions based on presence in files
		// Deactivate versions not present
		await tx
			.update(structuredObjectVersions)
			.set({ active: false })
			.where(
				// Deactivate if not in the current set
				notInArray(structuredObjectVersions.hash, Array.from(_objectVersionHashes))
			)

		// Activate versions present
		await tx
			.update(structuredObjectVersions)
			.set({ active: true })
			.where(inArray(structuredObjectVersions.hash, Array.from(_objectVersionHashes)))
	})

	console.log('✅ Structured objects updated!')
}
