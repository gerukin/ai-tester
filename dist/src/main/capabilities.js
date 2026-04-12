const capabilityLabels = {
    'input.text': 'text input',
    'input.image': 'image input',
    'input.file': 'file input',
    'input.pdf': 'PDF input',
    'output.text': 'text output',
    'output.structured': 'structured output',
    'output.tools': 'tool output',
};
const unique = (values) => Array.from(new Set(values));
export const getReferencedFileInputCapabilities = (files) => unique(files.flatMap(file => {
    if (file.type.category === 'image')
        return ['image'];
    if (file.type.mime === 'application/pdf')
        return ['pdf'];
    return ['file'];
}));
export const getModelCapabilityStatus = (model, requirements) => {
    if (!model?.capabilities)
        return undefined;
    const missing = [];
    for (const capability of unique(requirements.input)) {
        if (!model.capabilities.input[capability])
            missing.push(capabilityLabels[`input.${capability}`]);
    }
    for (const capability of unique(requirements.output)) {
        if (!model.capabilities.output[capability])
            missing.push(capabilityLabels[`output.${capability}`]);
    }
    return {
        supported: missing.length === 0,
        missing,
    };
};
export const warnIfCapabilitiesUndeclared = (model, modelReference, warnedModelReferences) => {
    if (model?.capabilities || warnedModelReferences.has(modelReference))
        return;
    warnedModelReferences.add(modelReference);
    console.warn(`⚠️ Model ${modelReference} has no capabilities declaration; running without capability checks.`);
};
export const logCapabilitySkip = (kind, modelReference, targetId, missing) => {
    console.log(`⏭️ Skipping ${kind} ${targetId} for model ${modelReference}: missing ${missing.join(', ')} capability.`);
};
