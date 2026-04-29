import { TFile } from "obsidian";
import { MemoryCache } from "./MemoryCache.ts";
import { Utils } from "./Utils.ts";

export type PasswordAndHint = {
	password: string;
	hint: string;
}

export class SessionPasswordService{

	private static isActive = true;

	public static blankPasswordAndHint : PasswordAndHint = { password:'', hint:'' };

	private static cache = new MemoryCache<PasswordAndHint>();
	
	private static baseMinutesToExpire = 0;
	private static expiryTime : number | null = null;

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
		SessionPasswordService.updateExpiryTime();
	}

	/**
	 * 
	 * @param minutesToExpire set to 0 to never expire
	 */
	public static setAutoExpire( minutesToExpire:number | null ) : void{
		SessionPasswordService.baseMinutesToExpire = minutesToExpire ?? 0;
		SessionPasswordService.updateExpiryTime();
	}

	public static getLevel() : string {
		return SessionPasswordService.level;
	}

	public static setLevel( level: string ) {
		//console.debug( 'SessionPasswordService.setLevel', { level, allLevels: this.allLevels } );
		if ( SessionPasswordService.allLevels.contains(level) ){
			SessionPasswordService.level = level;
			SessionPasswordService.updateExpiryTime();
			return;
		}
		SessionPasswordService.level = SessionPasswordService.LevelFilename;
		this.clear();
		SessionPasswordService.updateExpiryTime();
		//console.debug( 'SessionPasswordService.level', { level: SessionPasswordService.level } );
	}

	public static updateExpiryTime() : void {
		if ( !SessionPasswordService.isAutoExpireActive() ){
			SessionPasswordService.expiryTime = null;
		} else {
			SessionPasswordService.expiryTime = Date.now() + SessionPasswordService.baseMinutesToExpire * 1000 * 60;
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

		SessionPasswordService.updateExpiryTime();
	}

	public static async getByFile( file:TFile  ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		const sessionExpired = this.clearIfExpired();
		if (!sessionExpired){
			SessionPasswordService.updateExpiryTime();
		}

		const key = SessionPasswordService.getFileCacheKey( file );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static putByPath( pw: PasswordAndHint, path:string ): void {
		if (!SessionPasswordService.isActive){
			return;
		}

		const key = SessionPasswordService.getPathCacheKey( path );

		this.putByKey( key, pw );

		SessionPasswordService.updateExpiryTime();
	}

	public static getByPath( path: string ) : PasswordAndHint {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		const sessionExpired = this.clearIfExpired();
		if (!sessionExpired){
			SessionPasswordService.updateExpiryTime();
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	public static async getByPathAsync( path: string ) : Promise<PasswordAndHint> {
		if (!SessionPasswordService.isActive){
			return SessionPasswordService.blankPasswordAndHint;
		}
		const sessionExpired = this.clearIfExpired();
		if (!sessionExpired){
			SessionPasswordService.updateExpiryTime();
		}

		const key = SessionPasswordService.getPathCacheKey( path );
		return this.getByKey( key, SessionPasswordService.blankPasswordAndHint );
	}

	private static getPathCacheKey( path : string ) : string {
		
		if ( SessionPasswordService.level == SessionPasswordService.LevelVault ){
			return '$' + SessionPasswordService.LevelVault;
		}

		return Utils.getPathExcludingExtension( path );
	}

	private static getFileCacheKey( file : TFile ) : string {
		
		if ( SessionPasswordService.level == SessionPasswordService.LevelVault ){
			return '$' + SessionPasswordService.LevelVault;
		}

		const fileExExt = Utils.getFilePathExcludingExtension( file );
		return fileExExt;

	}

	public static clearIfExpired() : boolean{
		if ( !SessionPasswordService.isAutoExpireActive() ){
			SessionPasswordService.expiryTime = null;
			return false;
		}
		if ( SessionPasswordService.expiryTime == null ){
			return false;
		}
		if ( Date.now() < SessionPasswordService.expiryTime ){
			return false;
		}
		this.clear();
		return true;
	}

	public static markExpiryHandled(): void {
		SessionPasswordService.expiryTime = null;
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
		this.cache.put( key, pw );
	}

	private static getByKey( key: string, defaultValue: PasswordAndHint ): PasswordAndHint {
		console.debug( 'SessionPasswordService.getByKey', { 'level': SessionPasswordService.level, key, defaultValue } );
		return this.cache.get( key, defaultValue );
	}
}
