import { updatePromptsInDb, updateTestsInDb, runAllTests, runAllEvaluations } from './main/index.js';
import { askYesNo } from './utils/menus.js';
if (await askYesNo('Do you want to check & update the tests & prompts DB?')) {
    console.log(); // empty line
    // 1. Update prompts in the database
    await updatePromptsInDb();
    console.log(); // empty line
    // 2. Update tests in the database
    await updateTestsInDb();
}
console.log(); // empty line
// 3. Run all tests (will ask for confirmation)
await runAllTests();
console.log(); // empty line
// 4. Run all evaluations (will ask for confirmation)
await runAllEvaluations();
