import path from 'path';
import { createFile, getFileInfo } from '../utils/files.js';
import { envConfig } from '../config/index.js';
const PRICING_TRANSFORMS = {
    /** Cost per input token */
    prompt: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
    /** Cost per output token */
    completion: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
    /** Cost per API request */
    request: (value) => Number(Number(value).toFixed(3)),
    /** Cost per image input */
    image: (value) => Number(Number(value).toFixed(3)),
    // `audio` exists but is not documented
    /** Cost per web search operation */
    web_search: (value) => Number(Number(value).toFixed(3)),
    /** Cost for internal reasoning tokens */
    internal_reasoning: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
    /** Cost per cached input token read */
    input_cache_read: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
    /** Cost per cached input token write */
    input_cache_write: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
    default: (value) => Number((Number(value) * 1_000_000).toFixed(3)),
};
const CAPABILITIES_TO_ADD_FROM_SUPPORTED_PARAMS = ['structured_outputs', 'tools', 'reasoning'];
const NAME_TRANSFORMS = [
    (value) => value.replace(/Google/gi, 'GGL'),
    (value) => value.replace(/Anthropic/gi, 'ANTH'),
    (value) => value.replace(/Agentica/gi, 'AGTC'),
    (value) => value.replace(/OpenAI/gi, 'OAI'),
    (value) => value.replace(/Meta/gi, 'META'),
    (value) => value.replace(/Microsoft/gi, 'MSFT'),
    (value) => value.replace(/Mistral/gi, 'MSTL'),
    (value) => value.replace(/Perplexity/gi, 'PPX'),
    (value) => value.replace(/Cohere/gi, 'COHR'),
    (value) => value.replace(/Stability AI/gi, 'STBL'),
    (value) => value.replace(/Baidu/gi, 'BDU'),
    (value) => value.replace(/Alibaba/gi, 'ALI'),
    (value) => value.replace(/DeepMind/gi, 'DMND'),
    (value) => value.replace(/^DeepSeek/gi, 'DeepS'),
    (value) => value.replace(/Hugging Face/gi, 'HF'),
    // Z.AI and xAI are already short enough, do not transform
    // Other abbreviations
    (value) => value.replace(/thinking/gi, 'think.'),
    (value) => value.replace(/self-moderated/gi, 'self-mod.'),
    (value) => value.replace(/preview/gi, 'prev.'),
    (value) => value.replace(/experimental/gi, 'exp.'),
    (value) => value.replace(/free/gi, '🤑'),
];
const PRICING_KEY_TRANSFORMS = [
    (value) => value.replace(/prompt/gi, 'in'),
    (value) => value.replace(/completion/gi, 'out'),
    (value) => value.replace(/request/gi, 'req'),
    (value) => value.replace(/image/gi, 'img'),
    (value) => value.replace(/audio/gi, 'aud'),
    (value) => value.replace(/web_search/gi, 'web'),
    (value) => value.replace(/internal_reasoning/gi, 'reas'),
    (value) => value.replace(/input_cache_read/gi, 'cch_r'),
    (value) => value.replace(/input_cache_write/gi, 'cch_w'),
];
const CAPABILITIES_KEY_TRANSFORMS = [
    (value) => value.replace(/text/gi, 'txt'),
    (value) => value.replace(/file/gi, 'fil'),
    (value) => value.replace(/image/gi, 'img'),
    (value) => value.replace(/video/gi, 'vid'),
    (value) => value.replace(/audio/gi, 'aud'),
    (value) => value.replace(/structured_outputs/gi, 'json'),
    (value) => value.replace(/tools/gi, '🛠️'),
    (value) => value.replace(/reasoning/gi, '🧠'),
];
let hasFetched = false;
const getModalityHeader = (raw_modality, type, transform = false) => {
    if (transform)
        raw_modality = CAPABILITIES_KEY_TRANSFORMS.reduce((acc, transform) => transform(acc), raw_modality);
    return type === 'input' ? `⬆️ ${raw_modality}` : type === 'output' ? `⬇️ ${raw_modality}` : raw_modality;
};
const getEnhancedDescription = (model) => {
    const capabilities = [
        ...model._capabilities.in.map(capability => getModalityHeader(capability, 'input')),
        ...model._capabilities.out.map(capability => getModalityHeader(capability, 'output')),
        ...model._capabilities.other.map(capability => getModalityHeader(capability, 'other')),
    ].join(', ');
    const pricing = model.pricing
        ? Object.entries(model.pricing)
            .map(([key, value]) => {
            const transform = key in PRICING_TRANSFORMS
                ? // @ts-ignore
                    PRICING_TRANSFORMS[key]
                : PRICING_TRANSFORMS.default;
            return Number(value) > 0 ? `${key}: ${transform(value)}` : undefined;
        })
            .filter(Boolean)
            .join(', ')
        : 'Unknown';
    return `💪 ${capabilities}\n💵 ${pricing}\n${model.description}`;
};
const getCapabilities = (model) => {
    return {
        in: model.architecture?.['input_modalities']?.map(modality => modality) || [],
        out: model.architecture?.['output_modalities']?.map(modality => modality) || [],
        other: model.supported_parameters.filter(param => CAPABILITIES_TO_ADD_FROM_SUPPORTED_PARAMS.includes(param)),
    };
};
/**
 * Fetches OpenRouter models from API (once per session), caches to logs, and returns parsed array.
 */
export const getOpenRouterModels = async () => {
    const filePath = path.join(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json');
    let data;
    if (!hasFetched) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (!res.ok)
                throw new Error(`Failed to fetch: ${res.status}`);
            data = await res.json();
            createFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            hasFetched = true;
        }
        catch (err) {
            // Try to read from file if fetch fails
            try {
                const { content } = getFileInfo(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json', 'utf-8');
                data = JSON.parse(content);
            }
            catch (fileErr) {
                throw new Error('Could not fetch or read cached OpenRouter models');
            }
        }
    }
    else {
        // Already fetched, read from file
        const { content } = getFileInfo(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json', 'utf-8');
        data = JSON.parse(content);
    }
    if (!data?.data || !Array.isArray(data.data))
        throw new Error('Invalid OpenRouter models data');
    return data.data.map((model) => {
        const newModel = {
            ...model,
            _capabilities: getCapabilities(model),
        };
        newModel._enhanced_description = getEnhancedDescription(newModel);
        return newModel;
    });
};
/**
 * Formats OpenRouter models for display in a table or as an array of objects.
 */
export const formatOpenRouterModelsForDisplay = (models) => {
    const formattedModels = [];
    for (const model of models) {
        const modalityColumns = {
            ...Object.fromEntries(model._capabilities.in.filter(c => c !== 'text').map(c => [getModalityHeader(c, 'input', true), '✅'])),
            ...Object.fromEntries(model._capabilities.out.filter(c => c !== 'text').map(c => [getModalityHeader(c, 'output', true), '✅'])),
            ...Object.fromEntries(model._capabilities.other.map(c => [getModalityHeader(c, 'other', true), '✅'])),
        };
        // Collect all pricing keys for all models
        const allPricingKeys = Array.from(new Set(models.flatMap(m => (m.pricing ? Object.keys(m.pricing) : []))));
        // Only include keys where at least one model has a non-zero price
        const nonZeroPricingKeys = allPricingKeys.filter(key => models.some(m => m.pricing && m.pricing[key] && m.pricing[key] !== '0'));
        const pricingColumns = {};
        if (model.pricing && typeof model.pricing === 'object') {
            for (const key of nonZeroPricingKeys) {
                const transformedKey = PRICING_KEY_TRANSFORMS.reduce((acc, transform) => transform(acc), key);
                const transform = key in PRICING_TRANSFORMS
                    ? // @ts-ignore
                        PRICING_TRANSFORMS[key]
                    : PRICING_TRANSFORMS.default;
                if (model.pricing[key])
                    pricingColumns[`$${transformedKey}`] = transform(model.pricing[key]);
            }
        }
        // Apply all name transforms to model.name
        let transformedName = model.name;
        for (const transform of NAME_TRANSFORMS) {
            transformedName = transform(transformedName);
        }
        formattedModels.push([
            transformedName,
            {
                ...pricingColumns,
                ...modalityColumns,
            },
        ]);
    }
    return Object.fromEntries(formattedModels);
};
