import { TFile } from "obsidian";
import { MemoryCache } from "./MemoryCache.ts";
import { Utils } from "./Utils.ts";
import { DevConsole } from "./DevConsole.ts";

export type PasswordAndHint = {
	password: string;
	hint: string;
}

export type ExpiredSessionPasswordCacheItem = {
	key: string;
	isVault: boolean;
}

type SessionPasswordCacheEntry = {
	passwordAndHint: PasswordAndHint;
	expiresAt: number | null;
	isVault: boolean;
}

export class SessionPasswordService{

	private static isActive = true;

	public static blankPasswordAndHint : PasswordAndHint = { password:'', hint:'' };

	private static cache = new MemoryCache<SessionPasswordCacheEntry>();
	
	private static baseMinutesToExpire = 0;
	private static readonly vaultCacheKey = '$vault';

	public static LevelFilename = 'filename';
	public static LevelVault = 'vault';
	private static allLevels = [
		SessionPasswordService.LevelFilename,
		SessionPasswordService.LevelVault,
	];
	private static level = SessionPasswordService.LevelVault;

	public static setActive( isActive: boolean ) {
		SessionPasswordService.isActive = isActive;
		if (!SessionPasswordService.isActive){
			this.clear();
		}
		SessionPasswordService.refreshAllExpiryTimes();
	}

	/**
	 * 
	 * @param minutesToExpire set to 0 to never expire
	 */
	public static setAutoExpire( minutesToExpire:number | null ) : void{
		SessionPasswordService.baseMinutesToExpire = minutesToExpire ?? 0;
		SessionPasswordService.refreshAllExpiryTimes();
	}

	public static getLevel() : string {
		return SessionPasswordService.level;
	}

	public static setLevel( level: string ) {
		if ( SessionPasswordService.allLevels.contains(level) ){
			if ( SessionPasswordService.level != level ){
				this.clear();
			}
			SessionPasswordService.level = level;
			return;
		}
		SessionPasswordService.level = SessionPasswordService.LevelFilename;
		this.clear();
	}

	private static refreshAllExpiryTimes() : void {
		const expiresAt = SessionPasswordService.buildExpiresAt();
		for ( const key of SessionPasswordService.cache.getKeys() ) {
			const entry = SessionPasswordService.cache.getOrNull( key );
			if ( entry != null ){
				SessionPasswordService.cache.put( key, {
					...entry,
					expiresAt,
				} );
			}
		}
	}

	private static isAutoExpireActive(): boolean {
		return (
			SessionPasswordService.isActive
			&& SessionPasswordService.baseMinutesToExpire > 0
		);
	}

	public static putByFile( pw: PasswordAndHint, file:TFile ): void {
		if (!SessionPasswordService.isActive){
			return;
		}

		const key = SessionPasswordService.getFileCacheKey( file );
		this.putByKey( key, pw );
	}

	public static async peekByFile( file:TFile  ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.copyPasswordAndHint( SessionPasswordService.blankPasswordAndHint );
		}

		const key = SessionPasswordService.getFileCacheKey( file );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static async getByFile( file:TFile  ) : Promise<PasswordAndHint> {
		return SessionPasswordService.peekByFile( file );
	}

	public static touchByFile( file:TFile ): boolean {
		if (!SessionPasswordService.isActive){
			return false;
		}

		const key = SessionPasswordService.getFileCacheKey( file );
		return this.touchByKey( key );
	}

	public static hasUnexpiredByFile( file:TFile ): boolean {
		if (!SessionPasswordService.isActive){
			return false;
		}

		const key = SessionPasswordService.getFileCacheKey( file );
		return this.hasUnexpiredByKey( key );
	}

	public static putByPath( pw: PasswordAndHint, path:string ): void {
		if (!SessionPasswordService.isActive){
			return;
		}

		const key = SessionPasswordService.getPathCacheKey( path );

		this.putByKey( key, pw );
	}

	public static peekByPath( path: string ) : PasswordAndHint {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.copyPasswordAndHint( SessionPasswordService.blankPasswordAndHint );
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static getByPath( path: string ) : PasswordAndHint {
		return SessionPasswordService.peekByPath( path );
	}

	public static async peekByPathAsync( path: string ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.copyPasswordAndHint( SessionPasswordService.blankPasswordAndHint );
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static async getByPathAsync( path: string ) : Promise<PasswordAndHint> {
		return SessionPasswordService.peekByPathAsync( path );
	}

	public static touchByPath( path:string ): boolean {
		if (!SessionPasswordService.isActive){
			return false;
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.touchByKey( key );
	}

	public static hasUnexpiredByPath( path:string ): boolean {
		if (!SessionPasswordService.isActive){
			return false;
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.hasUnexpiredByKey( key );
	}

	private static getPathCacheKey( path : string ) : string {
		
		if ( SessionPasswordService.level == SessionPasswordService.LevelVault ){
			return SessionPasswordService.vaultCacheKey;
		}

		return Utils.getPathExcludingExtension( path );
	}

	private static getFileCacheKey( file : TFile ) : string {
		
		if ( SessionPasswordService.level == SessionPasswordService.LevelVault ){
			return SessionPasswordService.vaultCacheKey;
		}

		return SessionPasswordService.getFileScopedCacheKey( file );

	}

	public static getFileScopedCacheKey( file : TFile ) : string {
		return Utils.getFilePathExcludingExtension( file );
	}

	public static clearExpired() : ExpiredSessionPasswordCacheItem[] {
		if ( !SessionPasswordService.isAutoExpireActive() ){
			return [];
		}

		const expiredItems: ExpiredSessionPasswordCacheItem[] = [];
		for ( const key of SessionPasswordService.cache.getKeys() ) {
			const entry = SessionPasswordService.cache.getOrNull( key );
			if ( entry == null || !SessionPasswordService.entryHasExpired( entry ) ){
				continue;
			}

			SessionPasswordService.cache.removeKey( key );
			expiredItems.push( {
				key,
				isVault: entry.isVault,
			} );
		}

		return expiredItems;
	}

	public static clearIfExpired() : boolean{
		return this.clearExpired().length > 0;
	}

	public static markExpiryHandled(): void {
		// Expiry is handled per cache entry. This method is retained for
		// compatibility with older call sites.
	}

	public static clearForFile( file: TFile ) : void {
		const key = SessionPasswordService.getFileCacheKey( file );
		this.cache.removeKey( key );
	}

	public static clear(): number {
		const count = this.cache.getKeys().length;
		this.cache.clear();
		return count;
	}

	private static putByKey( key: string, pw: PasswordAndHint ) : void {
		this.cache.put( key, {
			passwordAndHint: SessionPasswordService.copyPasswordAndHint( pw ),
			expiresAt: SessionPasswordService.buildExpiresAt(),
			isVault: key == SessionPasswordService.vaultCacheKey,
		} );
	}

	private static getByKey( key: string, defaultValue: PasswordAndHint ): PasswordAndHint {
		const entry = this.cache.getOrNull( key );
		DevConsole.debug( 'SessionPasswordService.getByKey', {
			level: SessionPasswordService.level,
			key,
			hasEntry: entry != null,
			entryHasExpired: entry == null ? false : SessionPasswordService.entryHasExpired( entry ),
			hasDefaultPassword: defaultValue.password.length > 0,
			hasDefaultHint: defaultValue.hint.length > 0,
		} );
		if ( entry == null || SessionPasswordService.entryHasExpired( entry ) ){
			return SessionPasswordService.copyPasswordAndHint( defaultValue );
		}
		return SessionPasswordService.copyPasswordAndHint( entry.passwordAndHint );
	}

	private static touchByKey( key: string ): boolean {
		const entry = this.cache.getOrNull( key );
		if ( entry == null || SessionPasswordService.entryHasExpired( entry ) ){
			return false;
		}

		this.cache.put( key, {
			...entry,
			expiresAt: SessionPasswordService.buildExpiresAt(),
		} );
		return true;
	}

	private static hasUnexpiredByKey( key: string ): boolean {
		const entry = this.cache.getOrNull( key );
		return entry != null && !SessionPasswordService.entryHasExpired( entry );
	}

	private static buildExpiresAt(): number | null {
		if ( !SessionPasswordService.isAutoExpireActive() ){
			return null;
		}
		return Date.now() + SessionPasswordService.baseMinutesToExpire * 1000 * 60;
	}

	private static entryHasExpired( entry: SessionPasswordCacheEntry ): boolean {
		if ( !SessionPasswordService.isAutoExpireActive() || entry.expiresAt == null ){
			return false;
		}
		return Date.now() >= entry.expiresAt;
	}

	private static copyPasswordAndHint( pw: PasswordAndHint ): PasswordAndHint {
		return {
			password: pw.password,
			hint: pw.hint,
		};
	}
}
