import type { ModelDefinition } from '../config/model-registry.js'
import type { ReferencedFiles } from '../utils/markdown.js'

type InputCapability = 'text' | 'image' | 'file' | 'pdf'
type OutputCapability = 'text' | 'structured' | 'tools'

export type CapabilityRequirements = {
	input: InputCapability[]
	output: OutputCapability[]
}

type CapabilityStatus = {
	supported: boolean
	missing: string[]
}

const capabilityLabels: Record<`input.${InputCapability}` | `output.${OutputCapability}`, string> = {
	'input.text': 'text input',
	'input.image': 'image input',
	'input.file': 'file input',
	'input.pdf': 'PDF input',
	'output.text': 'text output',
	'output.structured': 'structured output',
	'output.tools': 'tool output',
}

const unique = <T>(values: T[]) => Array.from(new Set(values))

export const getReferencedFileInputCapabilities = (files: ReferencedFiles): InputCapability[] =>
	unique(
		files.flatMap(file => {
			if (file.type.category === 'image') return ['image']
			if (file.type.mime === 'application/pdf') return ['pdf']
			return ['file']
		})
	)

export const getModelCapabilityStatus = (
	model: ModelDefinition | undefined,
	requirements: CapabilityRequirements
): CapabilityStatus | undefined => {
	if (!model?.capabilities) return undefined

	const missing: string[] = []
	for (const capability of unique(requirements.input)) {
		if (!model.capabilities.input[capability]) missing.push(capabilityLabels[`input.${capability}`])
	}
	for (const capability of unique(requirements.output)) {
		if (!model.capabilities.output[capability]) missing.push(capabilityLabels[`output.${capability}`])
	}

	return {
		supported: missing.length === 0,
		missing,
	}
}

export const warnIfCapabilitiesUndeclared = (
	model: ModelDefinition | undefined,
	modelReference: string,
	warnedModelReferences: Set<string>
) => {
	if (model?.capabilities || warnedModelReferences.has(modelReference)) return
	warnedModelReferences.add(modelReference)
	console.warn(`⚠️ Model ${modelReference} has no capabilities declaration; running without capability checks.`)
}

export const logCapabilitySkip = (
	kind: 'test' | 'evaluation',
	modelReference: string,
	targetId: number,
	missing: string[]
) => {
	console.log(
		`⏭️ Skipping ${kind} ${targetId} for model ${modelReference}: missing ${missing.join(', ')} capability.`
	)
}
