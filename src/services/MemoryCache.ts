export class MemoryCache<T> {

	private values = new Map<string,T>();

	public put(key: string, value: T): void {
		this.values.set( key, value );
	}

	public get(key: string, defaultValue: T): T {
		return this.values.get(key) ?? defaultValue;
	}
	
	public getOrNull(key: string): T | null {
		return this.values.get(key) ?? null;
	}

	public getFirst(keys: string[], defaultValue: T): T {
		for (let index = 0; index < keys.length; index++) {
			const key = keys[index];
			if (this.containsKey(key)) {
				return this.get(key, defaultValue);
			}
		}

		return defaultValue;
	}

	public containsKey(key: string): boolean {
		return this.values.has(key);
	}

	public getKeys(): string[] {
		return Array.from( this.values.keys() );
	}

	public removeKey( key: string ) : boolean{
		return this.values.delete( key );
	}

	public clear() {
		this.values.clear();
	}
}
