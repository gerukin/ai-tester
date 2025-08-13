import { selectMenu, ask } from '../utils/menus.js'
import { getOpenRouterModels, formatOpenRouterModelsForDisplay } from '../apis/open-router.js'

export const openRouterMenu = {
	name: 'OpenRouter API',
	description: 'Interact with OpenRouter API features.',
	action: () =>
		selectMenu(
			'OpenRouter API:',
			[
				{
					name: 'Browse models',
					description: 'Browse / filter, and view remote model data from OpenRouter.',
					action: browseOpenRouterModelsMenu,
				},
				{
					name: 'Compare models',
					description: 'Compare models matching a search filter.',
					action: compareOpenRouterModelsMenu,
				},
			],
			{
				repeatMenu: true,
				addExitCurrentMenuOption: true,
				addExitProgramOption: true,
			}
		),
}

const browseOpenRouterModelsMenu = async () => {
	const models = await getOpenRouterModels()
	await selectMenu(
		'Search and select an OpenRouter model:',
		models.map(model => ({
			name: model.name,
			description: model._enhanced_description,
			action: () => {
				console.log(model._enhanced_description)
				console.log(
					Object.fromEntries(Object.entries(model).filter(([key]) => !key.match(new RegExp('^_|description', 'i'))))
				)
			},
		})),
		{
			filterable: true,
			repeatMenu: true,
			addExitCurrentMenuOption: true,
			addExitProgramOption: true,
		}
	)
}

const compareOpenRouterModelsMenu = async () => {
	const models = await getOpenRouterModels()
	const regex = await ask('Enter a regex to compare matching models:')

	const matchingModels = models.filter(model => regex && model.name.match(new RegExp(regex, 'i')))
	console.table(formatOpenRouterModelsForDisplay(matchingModels))
}
