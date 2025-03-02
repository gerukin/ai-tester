import { askYesNo, selectMenu } from './utils/menus.js';
import { testsConfig } from './config/index.js';
import { updatePromptsInDb, updateTestsInDb, runAllTests, runAllEvaluations, showStats } from './main/index.js';
const exit = () => process.exit(0);
const mainMenu = async () => {
    const runMissingStuff = async (fnc) => {
        if (!(await askYesNo('This will first update the tests & prompts DB. Do you want to continue?')))
            return;
        console.log(); // empty line
        await updatePromptsInDb();
        await updateTestsInDb();
        await fnc();
        console.log(); // empty line
    };
    return selectMenu('What would you like to do?', [
        {
            name: 'Check stats',
            action: statsMenu,
        },
        undefined,
        {
            name: 'Update prompts & tests in the database',
            action: async () => {
                await updatePromptsInDb();
                await updateTestsInDb();
            },
        },
        {
            name: 'Run missing tests',
            action: () => runMissingStuff(runAllTests),
        },
        {
            name: 'Run missing evaluations',
            action: () => runMissingStuff(runAllEvaluations),
        },
        undefined,
        {
            name: 'Exit',
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
                action: async () => {
                    await showStats(query);
                },
            })),
            undefined,
            {
                name: 'Back',
                action: () => {
                    go = false;
                },
            },
            {
                name: 'Exit',
                action: exit,
            },
        ]);
    }
};
while (true) {
    await mainMenu();
}
