/**
 * Singleton class to manage the global run state.
 *
 * @example
 * State.getInstance().startRun();
 * State.getInstance().endRun();
 * const last = State.getInstance().getLastRun();
 */
export class State {
    static instance;
    _currentRun = { startTime: null, endTime: null };
    constructor() { }
    /**
     * Get the singleton instance of State.
     * @returns {State} The singleton instance.
     */
    static getInstance() {
        if (!State.instance) {
            State.instance = new State();
        }
        return State.instance;
    }
    /**
     * Get the last run's start and end time.
     * @returns {LastRun} The last run object (readonly).
     */
    getLastRun() {
        // Return a copy to preserve immutability
        return { ...this._currentRun };
    }
    /**
     * Start a new run, setting the start time to now and end time to null.
     */
    startRun() {
        this._currentRun = {
            startTime: new Date(),
            endTime: null,
        };
    }
    /**
     * End the current run, setting the end time to now.
     */
    endRun() {
        this._currentRun = {
            ...this._currentRun,
            endTime: new Date(),
        };
    }
}
export const state = State.getInstance();
