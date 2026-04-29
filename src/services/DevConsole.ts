const DEV_LOGGING_ENABLED = false;

export class DevConsole {
	public static debug(...args: unknown[]): void {
		if ( DEV_LOGGING_ENABLED ){
			console.debug(...args);
		}
	}

	public static info(...args: unknown[]): void {
		if ( DEV_LOGGING_ENABLED ){
			console.info(...args);
		}
	}

	public static error(...args: unknown[]): void {
		if ( DEV_LOGGING_ENABLED ){
			console.error(...args);
		}
	}
}
