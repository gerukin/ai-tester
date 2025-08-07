import { askYesNo, selectMenu } from './utils/menus.js';
import { testsConfig } from './config/index.js';
import { updatePromptsInDb, updateTestsInDb, runAllTests, runAllEvaluations, showStats, updateStructuredObjectsInDb, updateToolsInDb, } from './main/index.js';
const exit = () => process.exit(0);
const updateAll = async () => {
    await updateStructuredObjectsInDb();
    await updateToolsInDb();
    await updatePromptsInDb();
    await updateTestsInDb();
};
const mainMenu = async () => {
    const runMissingStuff = async (fnc) => {
        if (!(await askYesNo('This will first update the tests & prompts DB. Do you want to continue?')))
            return;
        console.log(); // empty line
        await updateAll();
        await fnc();
        console.log(); // empty line
    };
    return selectMenu('What would you like to do?', [
        {
            name: 'Check stats',
            description: 'View statistics and analysis for costs, tests, and evaluations.',
            action: statsMenu,
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
    ]);
};
const statsMenu = async () => {
    if (!testsConfig.analysisQueries || testsConfig.analysisQueries.length === 0) {
        console.log('No analysis queries defined in the config.');
        return;
    }
    let go = true;
    while (go) {
        await selectMenu('Pick a query to run:', [
            ...testsConfig.analysisQueries.map(query => ({
                name: query.description,
                description: 'Run this analysis query.',
                action: async () => {
                    await showStats(query);
                },
            })),
            undefined,
            {
                name: 'Back',
                description: 'Return to the previous menu.',
                action: () => {
                    go = false;
                },
            },
            {
                name: 'Exit',
                description: 'Exit the application.',
                action: exit,
            },
        ]);
    }
};
while (true) {
    await mainMenu();
}
