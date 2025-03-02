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
export const selectMenu = async (message, choices) => {
    const action = await select({
        message,
        choices: choices.map(choiceMenuItem => {
            if (choiceMenuItem) {
                return {
                    name: choiceMenuItem.name,
                    value: choiceMenuItem.action,
                };
            }
            return new Separator();
        }),
    });
    if (action) {
        await action();
    }
};
