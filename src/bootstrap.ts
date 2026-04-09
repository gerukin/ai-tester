export type MainMenu = () => unknown | Promise<unknown>

declare global {
	var __AI_TESTER_TEST_MENU_LOADER__: (() => Promise<MainMenu>) | undefined
}

export const runApp = async ({ mainMenu }: { mainMenu: MainMenu }) => mainMenu()

export const loadMainMenu = async (): Promise<MainMenu> => (await import('./menus/main.js')).mainMenu

const getDefaultMenuLoader = () => globalThis.__AI_TESTER_TEST_MENU_LOADER__ ?? loadMainMenu

export const runDefaultApp = async (
	{ menuLoader = getDefaultMenuLoader() }: { menuLoader?: () => Promise<MainMenu> } = {}
) =>
	runApp({ mainMenu: await menuLoader() })
