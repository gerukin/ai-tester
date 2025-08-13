import { selectMenu } from '../utils/menus.js'
import { statsMenu } from './stats.js'
import { openRouterMenu } from './open-router.js'
import { testsAndEvalsMenus } from './tests-and-evals.js'

export const mainMenu = async () => {
	return selectMenu('What would you like to do?', [statsMenu, openRouterMenu, undefined, ...testsAndEvalsMenus], {
		repeatMenu: true,
		addExitProgramOption: true,
	})
}
