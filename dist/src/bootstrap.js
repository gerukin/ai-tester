export const runApp = async ({ mainMenu }) => mainMenu();
export const loadMainMenu = async () => (await import('./menus/main.js')).mainMenu;
const getDefaultMenuLoader = () => globalThis.__AI_TESTER_TEST_MENU_LOADER__ ?? loadMainMenu;
export const runDefaultApp = async ({ menuLoader = getDefaultMenuLoader() } = {}) => runApp({ mainMenu: await menuLoader() });
