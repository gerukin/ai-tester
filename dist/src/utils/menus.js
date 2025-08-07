import { confirm, select, Separator } from '@inquirer/prompts';
/**
 * Ask a yes/no question to the user
 *
 * @param question Yes or No question to ask
 * @param def Default as `true` or `false` (`true` by default)
 * @returns Promise with `true` if the answer is yes, `false` otherwise
 */
export const askYesNo = (question, def = true) => confirm({
    message: question,
    default: def,
});
/**
 * Presents a selection menu to the user with optional descriptions for each item.
 *
 * @param message - The prompt message to display.
 * @param choices - Array of menu items to present.
 * @returns Promise that resolves after the selected action is executed.
 * @example
 * await selectMenu('Choose an option:', [
 *   { name: 'Option 1', description: 'First option', action: () => doSomething() },
 *   { name: 'Option 2', action: () => doSomethingElse() }
 * ])
 */
export const selectMenu = async (message, choices) => {
    const action = await select({
        message,
        choices: choices.map(choiceMenuItem => {
            if (choiceMenuItem) {
                // If description is present, append it to the name for display
                return {
                    name: choiceMenuItem.name,
                    value: choiceMenuItem.action,
                    description: choiceMenuItem.description,
                };
            }
            return new Separator();
        }),
    });
    if (action) {
        await action();
    }
};
