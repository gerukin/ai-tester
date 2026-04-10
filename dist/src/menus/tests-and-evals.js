import { askYesNo } from '../utils/menus.js';
import { runEvalsWithSync, runTestsWithSync, syncAll } from '../cli/actions.js';
export const testsAndEvalsMenus = [
    {
        name: 'Update the database from files',
        description: 'Synchronize currencies, providers, models, prompts, tests, structured objects, and tools with the database.',
        action: syncAll,
    },
    {
        name: 'Run missing tests',
        description: 'Update the database, then execute all tests that have not yet been run.',
        action: () => runTestsWithSync({ confirmSync: askYesNo, confirmRun: askYesNo }),
    },
    {
        name: 'Run missing evaluations',
        description: 'Update the database, then execute all evaluations that have not yet been run.',
        action: () => runEvalsWithSync({ confirmSync: askYesNo, confirmRun: askYesNo }),
    },
];
