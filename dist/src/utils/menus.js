import { confirm, select, search, password, input, checkbox, Separator } from '@inquirer/prompts';
const DEFAULT_LEAVE_MENU_NAME = 'Leave this menu', DEFAULT_EXIT_PROGRAM_NAME = 'Exit program', DEFAULT_FILTER_NAME = 'Search for:', DEFAULT_PAGE_SIZE = 10;
/**
 * Ask a yes/no question to the user
 *
 * @param question Yes or No question to ask
 * @param def Default answer as `true` or `false` (`true` by default)
 * @returns Promise with `true` if the answer is yes, `false` otherwise
 */
export const askYesNo = (question, def = true) => confirm({
    message: question,
    default: def,
});
/**
 * Shows a menu to allow the user to perform various actions.
 * If the choices are a function, it will be called immediately when rendering the menu.
 * If filtering is enabled, it will also be called again when the user types in the search box, with no further automatic filtering (the function is expected to filter).
 *
 * @param message Message to show in the menu
 * @param choices Choices (options / selections) to show in the menu, can be a static array or a function that returns an array for a given input
 * @param options Options to customize the menu
 */
export const selectMenu = async (message, choices, { repeatMenu = false, addExitCurrentMenuOption = false, addExitProgramOption = false, searchDescription = false, pageSize = DEFAULT_PAGE_SIZE, ...filterOptions } = {}) => {
    const filterable = filterOptions.filterable ?? false, 
    // const filterable = 'filterable' in filterOptions && filterOptions.filterable ? true : false,
    debounceTimeout = 'debounceTimeout' in filterOptions && filterOptions.debounceTimeout ? filterOptions.debounceTimeout : 0, defaultFilterValue = 'defaultFilterValue' in filterOptions ? filterOptions.defaultFilterValue : undefined, manualFiltering = 'manualFiltering' in filterOptions ? filterOptions.manualFiltering : false;
    const addDynamicMenus = (choicesSoFar) => {
        if (addExitCurrentMenuOption || addExitProgramOption) {
            const _choicesSoFar = [...choicesSoFar];
            _choicesSoFar.push(undefined);
            if (addExitCurrentMenuOption)
                _choicesSoFar.push({
                    name: typeof addExitCurrentMenuOption === 'object' ? addExitCurrentMenuOption.name : DEFAULT_LEAVE_MENU_NAME,
                    action: async () => {
                        keepLooping = false;
                    },
                });
            if (addExitProgramOption)
                _choicesSoFar.push({
                    name: typeof addExitProgramOption === 'object' ? addExitProgramOption.name : DEFAULT_EXIT_PROGRAM_NAME,
                    action: async () => {
                        process.exit(0);
                    },
                });
            // If the menu will be looping (more than a page's worth of choices), we want to add one more separator in case people loop back from the top
            // Note: filterable menus cannot loop back
            if ((!filterable || manualFiltering) && _choicesSoFar.length > pageSize)
                _choicesSoFar.push(undefined);
            return _choicesSoFar;
        }
        return choicesSoFar;
    };
    const mapChoices = (choicesSoFar) => {
        return choicesSoFar.map(choiceMenuItem => {
            if (choiceMenuItem) {
                return {
                    name: choiceMenuItem.name,
                    description: choiceMenuItem.description,
                    disabled: choiceMenuItem.disabled,
                    value: 'value' in choiceMenuItem ? choiceMenuItem.value : choiceMenuItem.action,
                };
            }
            return new Separator();
        });
    };
    let keepLooping = true;
    while (keepLooping) {
        let actionOrValue;
        // The first time we run the async function right away, we only debounce later after the first run
        let debounceNeeded = false;
        if (filterable) {
            let filterValue = '';
            if (manualFiltering) {
                const name = typeof manualFiltering === 'object' && manualFiltering.name ? manualFiltering.name : DEFAULT_FILTER_NAME;
                filterValue = (await ask(name, defaultFilterValue)) ?? '';
            }
            const filterFn = async (input) => {
                if (debounceTimeout > 0 && debounceNeeded) {
                    await new Promise(resolve => setTimeout(resolve, debounceTimeout));
                }
                debounceNeeded = true;
                if (input === undefined)
                    input = defaultFilterValue;
                const _choices = [...(Array.isArray(choices) ? choices : await choices(input))];
                const filtered = !input || typeof choices === 'function'
                    ? mapChoices(addDynamicMenus(_choices))
                    : mapChoices(addDynamicMenus(_choices.filter(c => c &&
                        (('name' in c && c.name.toLowerCase().includes(input.toLowerCase())) ||
                            (searchDescription &&
                                (('description' in c && c.description?.toLowerCase().includes(input.toLowerCase())) ??
                                    false))))));
                return filtered;
            };
            actionOrValue = filterValue
                ? await select({
                    message,
                    choices: await filterFn(filterValue),
                    pageSize,
                })
                : await search({
                    message,
                    source: filterFn,
                    pageSize,
                });
        }
        else {
            actionOrValue = await select({
                message,
                choices: mapChoices(addDynamicMenus(Array.isArray(choices) ? choices : await choices())),
                pageSize,
            });
        }
        if (typeof actionOrValue === 'function') {
            const res = await actionOrValue();
            if (res === false) {
                keepLooping = false;
            }
        }
        else if (!repeatMenu) {
            return actionOrValue;
        }
        if (!repeatMenu)
            keepLooping = false;
    }
};
/**
 * Shows a multi-select menu to allow the user to select multiple options.
 * Each item can have either an `action` or a `value`.
 * Actions are performed immediately (and in order) once submitted. Values are returned.
 * If both kinds are present, all actions run first, then values are returned.
 *
 * @param message Message to show in the menu
 * @param choices Choices (options / selections) to show in the menu
 * @param options Options to customize the menu
 */
export const multiSelectMenu = async (message, choices, { pageSize = DEFAULT_PAGE_SIZE } = {}) => {
    const actionsAndValues = await checkbox({
        message,
        choices: choices.map(choice => {
            if (!choice)
                return new Separator();
            return {
                name: choice.name,
                value: 'value' in choice ? choice.value : choice.action,
                checked: choice.checked,
                description: choice.description,
            };
        }),
        pageSize,
    });
    for (const actionOrValue of actionsAndValues) {
        if (typeof actionOrValue === 'function') {
            await actionOrValue();
        }
    }
    return actionsAndValues.filter(v => typeof v !== 'function');
};
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
 * Shows a menu to ask the user for a password or other secret
 *
 * @param message Message to show in the menu
 * @param mask Mask to use for the password (default: true)
 * @returns Promise with the entered password or secret
 */
export const askSecret = async (message, mask = true) => {
    const secretMask = mask === true ? '*' : mask;
    return await password({
        message,
        mask: secretMask,
    });
};
