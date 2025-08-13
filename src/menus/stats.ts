import { testsConfig } from '../config/index.js'
import { selectMenu } from '../utils/menus.js'
import { showStats } from '../main/index.js'

export const statsMenu = {
	name: 'Check stats',
	description: 'View statistics and analysis for costs, tests, and evaluations.',
	action: async () => {
		if (!testsConfig.analysisQueries || testsConfig.analysisQueries.length === 0) {
			console.log('No analysis queries defined in the config.')
			return
		}

		await selectMenu(
			'Pick a query to run:',
			[
				...testsConfig.analysisQueries.map(query => ({
					name: query.description,
					description: 'Run this analysis query.',
					action: async () => {
						await showStats(query)
					},
				})),
			],
			{
				repeatMenu: true,
				addExitCurrentMenuOption: true,
				addExitProgramOption: true,
			}
		)
	},
}
