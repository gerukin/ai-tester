import z from 'zod'

export const ToolDefinition = z.object({
	name: z.string(),
	description: z.string(),
	parameters: z.any(),
})
