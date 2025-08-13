import { testsConfig } from './config/index.js'
import { askYesNo, selectMenu, filterSelectMenu, ask } from './utils/menus.js'
import { getOpenRouterModels, formatOpenRouterModelsForDisplay } from './apis/open-router.js'
import {
	updatePromptsInDb,
	updateTestsInDb,
	runAllTests,
	runAllEvaluations,
	showStats,
	updateStructuredObjectsInDb,
	updateToolsInDb,
} from './main/index.js'

const exit = () => process.exit(0)

const updateAll = async () => {
	await updateStructuredObjectsInDb()
	await updateToolsInDb()
	await updatePromptsInDb()
	await updateTestsInDb()
}

const mainMenu = async () => {
	const runMissingStuff = async (fnc: typeof runAllTests | typeof runAllEvaluations) => {
		if (!(await askYesNo('This will first update the tests & prompts DB. Do you want to continue?'))) return

		console.log() // empty line

		await updateAll()
		await fnc()

		console.log() // empty line
	}

	return selectMenu('What would you like to do?', [
		{
			name: 'Check stats',
			description: 'View statistics and analysis for costs, tests, and evaluations.',
			action: statsMenu,
		},
		{
			name: 'OpenRouter API',
			description: 'Interact with OpenRouter API features.',
			action: () =>
				selectMenu('OpenRouter API:', [
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
					{
						name: 'Back',
						description: 'Return to main menu.',
					},
				]),
		},
		undefined,
		{
			name: 'Update the database from files',
			description: 'Synchronize all prompt, test, structured object, and tool definitions with the database.',
			action: updateAll,
		},
		{
			name: 'Run missing tests',
			description: 'Update the database, then execute all tests that have not yet been run.',
			action: () => runMissingStuff(runAllTests),
		},
		{
			name: 'Run missing evaluations',
			description: 'Update the database, then execute all evaluations that have not yet been run.',
			action: () => runMissingStuff(runAllEvaluations),
		},
		undefined,
		{
			name: 'Exit',
			description: 'Exit the application.',
			action: exit,
		},
	])
}

const statsMenu = async () => {
	if (!testsConfig.analysisQueries || testsConfig.analysisQueries.length === 0) {
		console.log('No analysis queries defined in the config.')
		return
	}

	let go = true
	while (go) {
		await selectMenu('Pick a query to run:', [
			...testsConfig.analysisQueries.map(query => ({
				name: query.description,
				description: 'Run this analysis query.',
				action: async () => {
					await showStats(query)
				},
			})),
			undefined,
			{
				name: 'Back',
				description: 'Return to the previous menu.',
				action: () => {
					go = false
				},
			},
			{
				name: 'Exit',
				description: 'Exit the application.',
				action: exit,
			},
		])
	}
}

const browseOpenRouterModelsMenu = async () => {
	const models = await getOpenRouterModels()
	await filterSelectMenu(
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
		}))
	)
}

const compareOpenRouterModelsMenu = async () => {
	const models = await getOpenRouterModels()
	const regex = await ask('Enter a regex to compare matching models:')

	const matchingModels = models.filter(model => regex && model.name.match(new RegExp(regex, 'i')))
	console.table(formatOpenRouterModelsForDisplay(matchingModels))
}

while (true) {
	await mainMenu()
}
