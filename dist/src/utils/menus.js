import { confirm } from '@inquirer/prompts';
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
