/**
 * This module is responsible for managing prompts and updating them in the database.
 */

import fs from 'node:fs'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import z from 'zod'

import { envConfig, SPECIAL_TAGS } from '../config/index.js'
import { listAllMdFiles } from '../utils/files.js'
import {
	extractFrontMatterAndTemplate,
	getVersionsFromReplacements,
	TagsValidation,
	ReplacementsValidation,
	getSectionsFromMarkdownContent,
} from '../utils/markdown.js'
import { generateHash } from '../utils/crypto.js'
import { db } from '../database/db.js'
import { schema } from '../database/schema.js'

const ConfigValidation = z.object({
	id: z.string(),
	tags: TagsValidation.optional(),
	replacements: ReplacementsValidation.optional(),
})
type Config = z.infer<typeof ConfigValidation>
const PromptValidation = z.intersection(
	ConfigValidation,
	z.object({
		template: z.string(),
	})
)
type Prompt = z.infer<typeof PromptValidation>

/**
 * Fetches a prompt from a file, and optionally replaces placeholders with values.
 * The prompt file should be named `prompt.md` and be in the same directory as the current file.
 *
 * @param filePath The path to the prompt file
 *
 * @returns The prompt, with placeholders replaced if replacements are provided
 */
const getPromptFromFile = async (filePath: string): Promise<Prompt> => {
	const content = await fs.promises.readFile(filePath, 'utf-8')
	const { template, templateConfig }: { template: string; templateConfig: Config } =
		extractFrontMatterAndTemplate(content)

	// Validate config
	ConfigValidation.parse(templateConfig)

	const prompt: Prompt = {
		id: templateConfig.id,
		template,
		tags: templateConfig.tags,
		replacements: templateConfig.replacements,
	}

	return prompt
}

/**
 * Update the prompts in the database.
 * This function will read all prompt files from the prompts directory and update the database with the new prompts.
 * It will also update the prompt versions and tags associated with each prompt.
 */
export const updatePromptsInDb = async () => {
	console.log('Updating prompts in the database...')

	const _prompts = new Map<string, Prompt>()
	const _promptVersionHashes = new Set<string>()

	for (const file of listAllMdFiles(envConfig.AI_TESTER_PROMPTS_DIR)) {
		const prompt = await getPromptFromFile(file)

		if (_prompts.has(prompt.id)) {
			throw new Error(`Duplicate prompt ID found: ${prompt.id}`)
		}
		_prompts.set(prompt.id, prompt)

		// We need to validate the prompt template before we can continue
		const sections = getSectionsFromMarkdownContent(prompt.template)

		// For a prompt, valid sections must follow these rules:
		// - At least one section must be present
		// - If the `_evaluator` tag is set, the sections must be `system`, then `user`
		// - Otherwise, only the `system` section is allowed
		if (sections.length === 0) {
			throw new Error(`Prompt ${prompt.id} must have at least one section`)
		}
		if (prompt.tags?.includes('_evaluator')) {
			if (sections.length !== 2 || sections[0].type !== 'system' || sections[1].type !== 'user') {
				const sectionNames = sections.map(s => s.type).join(', ')
				throw new Error(
					`Prompt ${prompt.id} with tag "_evaluator" must have sections system, and user (instead found ${sectionNames})`
				)
			}
		} else {
			if (sections.length !== 1 || sections[0].type !== 'system') {
				throw new Error(`Prompt ${prompt.id} without tag "_evaluator" must have only section system`)
			}
		}
	}

	const { prompts, promptVersions, tags, promptToTagRels } = schema

	await db.transaction(async tx => {
		for (const [id, prompt] of _prompts) {
			const promptInstance =
				(await tx.insert(prompts).values({ code: id }).onConflictDoNothing().returning())[0] ??
				(await tx.query.prompts.findFirst({
					where: (prompts, { eq }) => eq(prompts.code, id),
				}))

			const contentVersions = getVersionsFromReplacements(prompt.template, prompt.replacements)

			for (const contentVersion of contentVersions) {
				// get a list of all special tags used, sort, and join them (they should be part of the hash)
				const specialTags = Array.from(SPECIAL_TAGS.keys())
					.filter(tag => prompt.tags?.includes(tag) ?? false)
					.sort()
					.join(',')
				const hash = generateHash(contentVersion + specialTags)
				_promptVersionHashes.add(hash)

				await tx
					.insert(promptVersions)
					.values({
						promptId: promptInstance.id,
						content: contentVersion,
						hash,
					})
					.onConflictDoNothing()
			}

			const tagInstances = []
			for (const tagName of prompt.tags ?? []) {
				const tagInstance =
					(await tx.insert(tags).values({ name: tagName }).onConflictDoNothing().returning())[0] ??
					(await tx.query.tags.findFirst({
						where: (tags, { eq }) => eq(tags.name, tagName),
					}))
				tagInstances.push(tagInstance)

				// add tag to prompt
				await tx
					.insert(promptToTagRels)
					.values({ tagId: tagInstance.id, promptId: promptInstance.id })
					.onConflictDoNothing()
			}

			// remove all tag associations not in tagInstances for this prompt
			await tx.delete(promptToTagRels).where(
				and(
					eq(promptToTagRels.promptId, promptInstance.id),
					notInArray(
						promptToTagRels.tagId,
						tagInstances.map(tag => tag.id)
					)
				)
			)
		}

		/**
		 * Activate or deactivate prompts based on the files we have
		 *
		 * @param active Whether to activate or deactivate the tests
		 */
		const activateOrDeactivate = (active: boolean) => {
			const arrFilterFnc = active ? inArray : notInArray
			return tx
				.update(promptVersions)
				.set({ active })
				.where(
					and(
						eq(promptVersions.active, !active),
						arrFilterFnc(promptVersions.hash, Array.from(_promptVersionHashes.keys()))
					)
				)
		}

		// update system prompts that are no longer in our files, to set them as inactive
		await activateOrDeactivate(false)

		// update system prompts that are now in our files, to set them as active
		await activateOrDeactivate(true)
	})

	console.log('✅ Prompts updated!')
}
