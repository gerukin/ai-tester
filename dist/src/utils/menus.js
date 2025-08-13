import { confirm, select, Separator, search, input } from '@inquirer/prompts';
/**
 * Presents a searchable selection menu to the user with optional descriptions for each item.
 * Filters menu items as the user types.
 *
 * @param message - The prompt message to display.
 * @param choices - Array of menu items to present.
 * @returns Promise that resolves after the selected action is executed.
 * @example
 * await filterSelectMenu('Search and select an item:', [
 *   { name: 'Item 1', description: 'First item', action: () => doSomething() },
 *   { name: 'Item 2', action: () => doSomethingElse() }
 * ])
 */
export const filterSelectMenu = async (message, choices, searchDescription = false) => {
    const action = await search({
        message,
        source: async (input) => {
            const filtered = !input
                ? choices
                : choices.filter(c => c &&
                    (c.name.toLowerCase().includes(input.toLowerCase()) ||
                        (searchDescription && (c.description?.toLowerCase().includes(input.toLowerCase()) ?? false))));
            return filtered.map(choiceMenuItem => {
                if (choiceMenuItem) {
                    return {
                        name: choiceMenuItem.name,
                        value: choiceMenuItem.action,
                        description: choiceMenuItem.description,
                    };
                }
                return new Separator();
            });
        },
    });
    if (action) {
        await action();
    }
};
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
 * Prompts the user for input.
 *
 * @param message - The prompt message to display.
 * @param defaultValue - The default value to use if the user provides no input.
 * @returns Promise that resolves to the user's input or undefined.
 */
export const ask = (message, defaultValue) => {
    return input({
        message,
        default: defaultValue,
    });
};
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
