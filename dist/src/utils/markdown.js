import yaml from 'yaml';
import z from 'zod';
export const TagsValidation = z.array(z.string());
const ReplacementValueValidation = z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]);
export const ReplacementsValidation = z.union([
    z.record(ReplacementValueValidation),
    z.array(z.record(ReplacementValueValidation)),
]);
const USER_MESSAGE_MARKER = '# 👤', ASSISTANT_MESSAGE_MARKER = '# 🤖', EVALUATION_MARKER = '---';
/**
 * Extract the front matter and template from a markdown file.
 *
 * @param content The content of the markdown file
 * @returns The template and template configuration
 */
export const extractFrontMatterAndTemplate = (content) => {
    const frontmatterArea = content.match(/^---\n([\s\S]*?)\n---\n/);
    const template = frontmatterArea?.[0] ? content.slice(frontmatterArea[0].length + 1) : content;
    const templateConfig = frontmatterArea?.[1] ? yaml.parse(frontmatterArea[1], { strict: false }) : {};
    return { template, templateConfig };
};
/**
 * Get all content versions from the replacements. This is used to generate all possible versions of a template,
 * after replacing the placeholders with the replacements. There may be from just one version to many versions.
 *
 * @param template The template to get the versions from
 * @param replacements The replacements to use
 * @param currentKey The current key in the replacements object
 */
export const getVersionsFromReplacements = (template, replacements, currentKey) => {
    if (typeof replacements === 'string' || typeof replacements === 'number') {
        if (!currentKey)
            throw new Error('Current key is required for string replacements');
        return [template.replace(new RegExp(`\`{{${currentKey}}}\``, 'g'), replacements.toString().trim()).trim()];
    }
    else if (Array.isArray(replacements)) {
        if (typeof replacements?.[0] === 'string') {
            if (!currentKey)
                throw new Error('Current key is required for string replacements');
            return replacements.flatMap(replacement => getVersionsFromReplacements(template, replacement, currentKey));
        }
        else {
            // it's an array of objects
            return replacements.flatMap(replacement => getVersionsFromReplacements(template, replacement));
        }
    }
    else if (typeof replacements === 'object') {
        let versions = [template];
        for (const [key, value] of Object.entries(replacements)) {
            versions = versions.flatMap(version => getVersionsFromReplacements(version, value, key));
        }
        return versions;
    }
    return [template];
};
/**
 * Parse a markdown file content area (excluding front matter) and return all sections in the file.
 *
 * @param content The content of the markdown file
 * @returns The sections in the markdown file
 * @throws If no sections are found in the markdown content
 */
export const getSectionsFromMarkdownContent = (content) => {
    // if the evaluation marker is present more than once in the content, it's an error
    if ((content.match(new RegExp(EVALUATION_MARKER, 'g')) || []).length > 1)
        throw new Error(`More than one evaluation marker (${EVALUATION_MARKER}) found in the markdown content`);
    const sections = [];
    // Each section is either a user message, bot message, or evaluation
    const matches = content.match(new RegExp(`((?:^|${USER_MESSAGE_MARKER}|${ASSISTANT_MESSAGE_MARKER}|${EVALUATION_MARKER})(?:.|\n)+?)(?=${USER_MESSAGE_MARKER}|${ASSISTANT_MESSAGE_MARKER}|${EVALUATION_MARKER}|$)`, 'g'));
    // We filter out empty sections which may have been matched (normally at the start of the content)
    const filteredMatches = matches?.filter(match => match.trim().length > 0);
    if (!filteredMatches)
        throw new Error('No sections found in the markdown content');
    sections.push(...filteredMatches.map(section => {
        const type = section.startsWith(USER_MESSAGE_MARKER)
            ? 'user'
            : section.startsWith(ASSISTANT_MESSAGE_MARKER)
                ? 'assistant'
                : section.startsWith(EVALUATION_MARKER)
                    ? 'evaluation'
                    : 'system';
        return {
            type,
            content: section
                .replace(new RegExp(`${USER_MESSAGE_MARKER}|${ASSISTANT_MESSAGE_MARKER}|${EVALUATION_MARKER}`), '')
                .trim(),
        };
    }));
    return sections;
};
/**
 * Convert the sections to an array of normalized markdown strings.
 *
 * @param sections The sections to normalize
 * This can be used to normalize and compare the sections.
 */
export const sectionsToNormalizedStrings = (sections) => {
    const normalizedSections = sections.map(({ content, type }) => ({
        type,
        content: type === 'evaluation' || type === 'system'
            ? content
            : type === 'assistant'
                ? `${ASSISTANT_MESSAGE_MARKER}\n\n${content}`
                : `${USER_MESSAGE_MARKER}\n\n${content}`,
    }));
    return {
        normalizedSections,
        normalizedPreEval: normalizedSections
            .filter(section => section.type !== 'evaluation')
            .map(({ content }) => content)
            .join('\n\n'),
        normalizedEval: getEvalInstrFromSections(normalizedSections),
    };
};
/**
 * Extract the AI messages from the parsed content.
 *
 * @param sections The parsed content sections
 * @param includeSystem Whether to include system messages
 * @returns The AI messages
 */
export const sectionsToAiMessages = (sections, includeSystem = false) => {
    const messages = [];
    for (const { content, type } of sections) {
        if (type === 'user' || type === 'assistant' || (includeSystem && type === 'system')) {
            messages.push({ content, role: type });
        }
    }
    return messages;
};
/**
 * Extract the evaluation from the parsed content.
 *
 * @param sections The parsed content sections
 * @returns The evaluation
 */
export const getEvalInstrFromSections = (sections) => {
    const evaluationSection = sections.find(({ type }) => type === 'evaluation');
    return evaluationSection?.content;
};
