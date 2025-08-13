import { askYesNo } from '../utils/menus.js';
import { updatePromptsInDb, updateTestsInDb, runAllTests, runAllEvaluations, updateStructuredObjectsInDb, updateToolsInDb, } from '../main/index.js';
const updateAll = async () => {
    await updateStructuredObjectsInDb();
    await updateToolsInDb();
    await updatePromptsInDb();
    await updateTestsInDb();
};
const runMissingStuff = async (fnc) => {
    if (!(await askYesNo('This will first update the tests & prompts DB. Do you want to continue?')))
        return;
    console.log(); // empty line
    await updateAll();
    await fnc();
    console.log(); // empty line
};
export const testsAndEvalsMenus = [
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
];
