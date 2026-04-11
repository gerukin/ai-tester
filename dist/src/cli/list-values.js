import fs from 'node:fs';
import z from 'zod';
import { envConfig } from '../config/environment.js';
import { loadCurrencyDefinitions } from '../config/currency-registry.js';
import { getFileBackedModelRegistry } from '../config/model-registry.js';
import { listAllMdFiles } from '../utils/files.js';
import { extractFrontMatterAndTemplate, TagsValidation } from '../utils/markdown.js';
const PromptListConfigSchema = z.object({
    id: z.string(),
    tags: TagsValidation.optional(),
});
const TestListConfigSchema = z.object({
    tags: TagsValidation.optional(),
});
const sortUnique = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
const readMarkdownFrontMatter = (filePath) => extractFrontMatterAndTemplate(fs.readFileSync(filePath, 'utf-8')).templateConfig;
const formatSection = (title, values, emptyMessage) => [`${title}:`, ...(values.length > 0 ? values.map(value => `  ${value}`) : [`  ${emptyMessage}`])].join('\n');
export const listAvailableModels = () => getFileBackedModelRegistry()
    .activeModels.map(model => JSON.stringify({ provider: model.provider, model: model.providerModelCode }))
    .sort((a, b) => a.localeCompare(b));
export const listAvailableTags = () => sortUnique(listAllMdFiles(envConfig.AI_TESTER_TESTS_DIR).flatMap(file => TestListConfigSchema.parse(readMarkdownFrontMatter(file)).tags ?? []));
export const listAvailablePromptCodes = () => sortUnique(listAllMdFiles(envConfig.AI_TESTER_PROMPTS_DIR).flatMap(file => {
    const prompt = PromptListConfigSchema.parse(readMarkdownFrontMatter(file));
    return prompt.tags?.includes('_evaluator') ? [] : [prompt.id];
}));
export const listAvailableCurrencies = () => loadCurrencyDefinitions().map(currency => currency.code).sort();
export const formatAvailableValues = (options) => {
    const sections = [];
    if (options.models) {
        sections.push(formatSection('Models', listAvailableModels(), 'No active file-backed models found.'));
    }
    if (options.tags) {
        sections.push(formatSection('Tags', listAvailableTags(), 'No test tags found.'));
    }
    if (options.prompts) {
        sections.push(formatSection('Prompts', listAvailablePromptCodes(), 'No non-evaluator prompt codes found.'));
    }
    if (options.currencies) {
        sections.push(formatSection('Currencies', listAvailableCurrencies(), 'No file-backed currencies configured.'));
    }
    return sections.join('\n\n');
};
