/**
 * Represents the start and end time of the last run.
 */
export type LastRun = {
	/** Start time as a Date object, or null if not started */
	readonly startTime: Date | null
	/** End time as a Date object, or null if not ended */
	readonly endTime: Date | null
}

/**
 * Singleton class to manage the global run state.
 *
 * @example
 * State.getInstance().startRun();
 * State.getInstance().endRun();
 * const last = State.getInstance().getLastRun();
 */
export class State {
	private static instance: State
	private _currentRun: LastRun = { startTime: null, endTime: null }

	private constructor() {}

	/**
	 * Get the singleton instance of State.
	 * @returns {State} The singleton instance.
	 */
	public static getInstance(): State {
		if (!State.instance) {
			State.instance = new State()
		}
		return State.instance
	}

	/**
	 * Get the last run's start and end time.
	 * @returns {LastRun} The last run object (readonly).
	 */
	public getLastRun(): LastRun {
		// Return a copy to preserve immutability
		return { ...this._currentRun }
	}

	/**
	 * Start a new run, setting the start time to now and end time to null.
	 */
	public startRun(): void {
		this._currentRun = {
			startTime: new Date(),
			endTime: null,
		}
	}

	/**
	 * End the current run, setting the end time to now.
	 */
	public endRun(): void {
		this._currentRun = {
			...this._currentRun,
			endTime: new Date(),
		}
	}
}

export const state = State.getInstance()
