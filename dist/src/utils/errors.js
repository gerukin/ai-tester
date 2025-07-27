import { AISDKError } from 'ai';
import { envConfig } from '../config/environment.js';
import { createFile } from './files.js';
import { state } from './state.js';
/**
 * Utility function to handle and log model errors.
 *
 * @param err The error to handle.
 * @param type The type of operation ('eval' or 'test').
 * @param i The current index of the operation.
 * @param total The total number of operations.
 * @param modelVersionCode The version code of the model being used.
 * @returns True if the error was handled, false otherwise.
 */
export const logModelError = (err, type, i, total, modelVersionCode) => {
    let msg = `❌ Failed ${type} [${i} of ${total}] with model ${modelVersionCode}`;
    if (err instanceof Error || err instanceof AISDKError) {
        if ('name' in err) {
            msg += ` (${err.name})`;
        }
        let supplementalInfo = '';
        if ('message' in err) {
            supplementalInfo += `\n${err.message}`;
            Object.defineProperty(err, 'message', { enumerable: true });
        }
        if ('cause' in err && err.cause) {
            supplementalInfo += `\nCause: ${err.cause}`;
        }
        if ('text' in err && err.text) {
            supplementalInfo += `\nText: ${err.text}`;
        }
        if ('finishReason' in err && err.finishReason) {
            supplementalInfo += `\nFinish Reason: ${err.finishReason}`;
        }
        if (supplementalInfo) {
            msg += supplementalInfo;
        }
    }
    console.error(msg);
    createFile(`${envConfig.AI_TESTER_LOGS_DIR}/runs/${state.getLastRun().startTime?.toISOString() ?? 'unknown'}/${type}-errors/${i}-${total}-${modelVersionCode}.json`, JSON.stringify(err, null, '\t'));
};
