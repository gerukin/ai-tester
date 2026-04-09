import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
	ReplacementsValidation,
	extractFrontMatterAndTemplate,
	getEvalInstrFromSections,
	getReferencedFiles,
	getSectionsFromMarkdownContent,
	getVersionsFromReplacements,
	sectionsToAiMessages,
	sectionsToNormalizedStrings,
} from '../src/utils/markdown.js'

test('extractFrontMatterAndTemplate parses front matter and falls back cleanly when absent', () => {
	const withFrontMatter = extractFrontMatterAndTemplate(
		[
			'---',
			'tags:',
			'  - fast',
			'replacements:',
			'  name: Alice',
			'---',
			'# 👤',
			'',
			'Hello `{{name}}`',
		].join('\n')
	)
	assert.deepStrictEqual(withFrontMatter.templateConfig, {
		tags: ['fast'],
		replacements: { name: 'Alice' },
	})
	assert.strictEqual(withFrontMatter.template, '# 👤\n\nHello `{{name}}`')

	const withoutFrontMatter = extractFrontMatterAndTemplate('# 👤\n\nNo front matter')
	assert.deepStrictEqual(withoutFrontMatter.templateConfig, {})
	assert.strictEqual(withoutFrontMatter.template, '# 👤\n\nNo front matter')

	const withLeadingBlankLine = extractFrontMatterAndTemplate(
		[
			'---',
			'id: prompt',
			'---',
			'',
			'You are helpful.',
		].join('\n')
	)
	assert.strictEqual(withLeadingBlankLine.template, 'You are helpful.')
})

test('getVersionsFromReplacements expands scalar, array, and null replacements into all versions', () => {
	const replacements = ReplacementsValidation.parse({
		name: [' Alice ', 'Bob'],
		mode: [' fast ', 'slow'],
		status: null,
	})

	assert.deepStrictEqual(
		getVersionsFromReplacements('Name: `{{name}}` | Mode: `{{mode}}` | Status: `{{status}}`', replacements),
		[
			'Name: Alice | Mode: fast | Status: null',
			'Name: Alice | Mode: slow | Status: null',
			'Name: Bob | Mode: fast | Status: null',
			'Name: Bob | Mode: slow | Status: null',
		]
	)
	assert.throws(() => getVersionsFromReplacements('Name: `{{name}}`', 'Alice'), /Current key is required/)
})

test('getReferencedFiles deduplicates, sorts, and hashes referenced files', async t => {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-tester-markdown-files-'))
	t.after(async () => {
		await fs.rm(rootDir, { recursive: true, force: true })
	})

	await fs.writeFile(path.join(rootDir, 'b.txt'), 'plain text file')
	await fs.writeFile(path.join(rootDir, 'a.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

	const files = getReferencedFiles(
		[
			'Use `{{_file:b.txt}}` once.',
			'Use `{{_file:a.png}}` too.',
			'Use `{{_file:b.txt}}` again.',
		].join('\n'),
		rootDir,
		true
	)

	assert.deepStrictEqual(files.map(file => path.basename(file.filePath)), ['a.png', 'b.txt'])
	assert.strictEqual(files[0]?.type.category, 'image')
	assert.strictEqual(files[1]?.type.category, 'text')
	assert.ok(files[0]?.hash)
	assert.ok(files[1]?.hash)
})

test('markdown sections normalize cleanly and expose evaluation instructions', () => {
	const sections = getSectionsFromMarkdownContent(
		[
			'You are terse.',
			'# 👤',
			'',
			'Hello there',
			'# 🤖',
			'',
			'General Kenobi',
			'---',
			'',
			'Check tone',
		].join('\n')
	)

	assert.deepStrictEqual(sections.map(section => section.type), ['system', 'user', 'assistant', 'evaluation'])
	assert.deepStrictEqual(sections.map(section => section.content), [
		'You are terse.',
		'Hello there',
		'General Kenobi',
		'Check tone',
	])

	const normalized = sectionsToNormalizedStrings(sections)
	assert.strictEqual(
		normalized.normalizedPreEval,
		['You are terse.', '', '# 👤', '', 'Hello there', '', '# 🤖', '', 'General Kenobi'].join('\n')
	)
	assert.strictEqual(normalized.normalizedEval, 'Check tone')
	assert.strictEqual(getEvalInstrFromSections(sections), 'Check tone')
})

test('only the last standalone --- line starts evaluation instructions', () => {
	const sections = getSectionsFromMarkdownContent(
		[
			'System intro',
			'',
			'Something --- in the middle of a line',
			'',
			'---',
			'',
			'# 👤',
			'',
			'Question after an earlier separator line',
			'',
			'---',
			'',
			'Evaluation instructions',
		].join('\n')
	)

	assert.deepStrictEqual(sections, [
		{
			type: 'system',
			content: ['System intro', '', 'Something --- in the middle of a line', '', '---'].join('\n'),
		},
		{
			type: 'user',
			content: 'Question after an earlier separator line',
		},
		{
			type: 'evaluation',
			content: 'Evaluation instructions',
		},
	])
})

test('sectionsToAiMessages includes system text and user file attachments', () => {
	const sections = [
		{ type: 'system', content: 'System prompt' },
		{ type: 'user', content: 'Inspect note.txt and image.png' },
		{ type: 'assistant', content: 'Looks good' },
	] as const

	const messages = sectionsToAiMessages(sections as never, true, [
		{
			filePath: '/tmp/image.png',
			content: 'aGVsbG8=',
			fileName: 'image.png',
			extension: '.png',
			type: { category: 'image', mime: 'image/png', encoding: 'base64' },
		},
		{
			filePath: '/tmp/note.txt',
			content: 'attached note',
			fileName: 'note.txt',
			extension: '.txt',
			type: { category: 'text', mime: 'text/plain', encoding: 'utf-8' },
		},
	])

	assert.deepStrictEqual(messages[0], { role: 'system', content: 'System prompt' })
	assert.deepStrictEqual(messages[2], { role: 'assistant', content: 'Looks good' })
	assert.deepStrictEqual(messages[1], {
		role: 'user',
		content: [
			{ type: 'text', text: 'Inspect note.txt and image.png' },
			{ type: 'image', image: 'aGVsbG8=' },
			{ type: 'file', data: 'attached note', mediaType: 'text/plain' },
		],
	})
})

test('getSectionsFromMarkdownContent allows --- in content and rejects empty markdown', () => {
	const sections = getSectionsFromMarkdownContent('# 👤\n\nA --- B\n\n---\n\nEval')
	assert.deepStrictEqual(sections, [
		{ type: 'user', content: 'A --- B' },
		{ type: 'evaluation', content: 'Eval' },
	])
	assert.throws(() => getSectionsFromMarkdownContent(''), /No sections found/)
})
