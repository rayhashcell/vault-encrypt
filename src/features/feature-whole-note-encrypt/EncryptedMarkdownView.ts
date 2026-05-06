import { MarkdownView, Notice, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { FileData, FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { ENCRYPTED_FILE_EXTENSIONS } from "../../services/Constants.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { DevConsole } from "../../services/DevConsole.ts";
import { createTranslator, Translator } from "../../i18n.ts";

export class EncryptedMarkdownView extends MarkdownView {

	static VIEW_TYPE = 'custom-encrypted-view';
	private pluginSettings: IMeldEncryptPluginSettings;

	passwordAndHint : PasswordAndHint | null = null;
	encryptedData : FileData | null = null;
	cachedUnencryptedData : string = '';
	dataWasChangedSinceLastSave = false;
	
	isSavingEnabled = false;
	isLoadingFileInProgress = false;
	isSavingInProgress = false;
	
	override allowNoFile = false;

	origFile:TFile | null; // used resync password cache when renaming the file

	constructor(leaf: WorkspaceLeaf, settings: IMeldEncryptPluginSettings) {
		super(leaf);
		this.pluginSettings = settings;
	}
	
	override getViewType(): string {
		return EncryptedMarkdownView.VIEW_TYPE;
	}

	override canAcceptExtension(extension: string): boolean {
		return ENCRYPTED_FILE_EXTENSIONS.includes( extension );
	}

	private t(): Translator {
		return createTranslator(this.pluginSettings.settingsLanguage);
	}

	protected override async onOpen(): Promise<void> {
		await super.onOpen();

		// add view actions
		this.addAction(
			'key-round',
			'Change password',
			() => this.changePassword(),
		)

		this.addAction(
			'lock',
			'Lock & Close',
			() => this.lockAndClose(),
		)
	}

	override async onLoadFile(file: TFile): Promise<void> {
		this.setViewBusy( true );
		try{

			this.setUnencryptedViewData('', true);

			if (!this.app.workspace.layoutReady ){
				this.leaf.detach();
				return;
			};

			const fileContents = await this.app.vault.read( file );
			this.encryptedData = JsonFileEncoding.decode( fileContents );
			if ( !FileDataHelper.isSupported( this.encryptedData ) ){
				new Notice('Unsupported encrypted file format.');
				this.leaf.detach();
				return;
			}

			const rememberedPasswordAndHint: PasswordAndHint = {
				...await SessionPasswordService.peekByFile( file ),
				hint: this.encryptedData.hint,
			};

			// try to decrypt the file content
			let decryptedText: string|null = null;
			let nextPasswordPromptDefault: PasswordAndHint = { password: '', hint: this.encryptedData.hint };
			let nextPasswordPromptUsesRememberedPassword = false;
			let passwordCameFromCache = false;

			if (
				rememberedPasswordAndHint.password.length > 0
				&& !this.pluginSettings.confirmRememberedPasswordBeforeOpen
			) {
				this.passwordAndHint = rememberedPasswordAndHint;
				decryptedText = await FileDataHelper.decrypt( this.encryptedData, this.passwordAndHint.password );
				passwordCameFromCache = decryptedText != null;
			}

			if (
				rememberedPasswordAndHint.password.length > 0
				&& this.pluginSettings.confirmRememberedPasswordBeforeOpen
			) {
				nextPasswordPromptDefault = rememberedPasswordAndHint;
				nextPasswordPromptUsesRememberedPassword = true;
			}

			while( decryptedText == null ){
				const promptUsesRememberedPassword = nextPasswordPromptUsesRememberedPassword;
				const t = this.t();
				// prompt for password
				const passwordModal = new PluginPasswordModal(
					this.app,
					t('modal.title.decryptingFile', { file: file.basename }),
					false,
					false,
					nextPasswordPromptDefault,
					t
				);
				let rememberedPasswordExpiryWatcher: number | null = null;
				try {
					if ( promptUsesRememberedPassword ){
						rememberedPasswordExpiryWatcher = window.setInterval( () => {
							if ( !SessionPasswordService.hasUnexpiredByFile( file ) ){
								new Notice('Remembered password expired. Password dialog closed.');
								passwordModal.close();
							}
						}, 1000 );
					}
					this.passwordAndHint = await passwordModal.open2Async();
				} finally {
					if ( rememberedPasswordExpiryWatcher != null ){
						window.clearInterval( rememberedPasswordExpiryWatcher );
					}
				}
				nextPasswordPromptDefault = { password: '', hint: this.encryptedData.hint };
				nextPasswordPromptUsesRememberedPassword = false;

				if ( this.passwordAndHint == null ) {
					// user cancelled
					this.leaf.detach();
					return;
				}

				if (
					promptUsesRememberedPassword
					&& !SessionPasswordService.hasUnexpiredByFile( file )
				) {
					this.passwordAndHint = null;
					new Notice('Remembered password expired. Password dialog closed.');
					this.leaf.detach();
					return;
				}

				decryptedText = await FileDataHelper.decrypt( this.encryptedData, this.passwordAndHint.password );
				if ( decryptedText == null ) {
					new Notice('Decryption failed');
				}else{
					passwordCameFromCache = (
						promptUsesRememberedPassword
						&& this.passwordAndHint.password == rememberedPasswordAndHint.password
					);
				}
			}

			if ( decryptedText == null ) {
				this.leaf.detach();
				return;
			}

			if ( this.passwordAndHint != null ) {
				if ( !passwordCameFromCache || !SessionPasswordService.touchByFile( file ) ){
					SessionPasswordService.putByFile( this.passwordAndHint, file );
				}
			}

			this.setUnencryptedViewData( decryptedText, false );
			
			
			this.isLoadingFileInProgress = true;
			try{
				this.origFile = file;
				await super.onLoadFile(file);
			}finally{
				this.isLoadingFileInProgress = false;
				this.isSavingEnabled = true; // allow saving after the file is loaded with a password
			}

		}finally{
			this.setViewBusy( false );
		}

	}

	private setViewBusy( busy: boolean ) {
		if ( busy ) {
			this.contentEl.style.cursor = 'wait';
		} else {
			this.contentEl.style.cursor = 'auto';
		}
	}

	public async detachSafely(){
		await this.save();
		this.isSavingEnabled = false;
		this.leaf.detach();
	}

	override async onUnloadFile(file: TFile): Promise<void> {
		
		if ( this.passwordAndHint == null || this.encryptedData == null ) {
			return;
		}
		
		if (this.isSavingInProgress){
			DevConsole.info( 'Saving is in progress, but forcing another save because the file is being unloaded' );
			this.isSavingInProgress = false;
			this.dataWasChangedSinceLastSave = true;
		}
		await super.onUnloadFile(file);
	}    
	
	override async onRename(file: TFile): Promise<void> {
		if (this.origFile){
			SessionPasswordService.clearForFile( this.origFile );
		}    

		if (this.passwordAndHint!=null){
			SessionPasswordService.putByFile( this.passwordAndHint, file );
		}    
		await super.onRename(file);    
	}    


	private getUnencryptedViewData(): string {
		return super.getViewData();
	}

	override getViewData(): string {
		// something is reading the data.. maybe to save it

		if (this.isSavingInProgress) {
			if ( this.encryptedData == null ) {
				throw new Error('encryptedData is unexpectedly null');
			}
			// return the encrypted data which should have just been updated in the save method
			return JsonFileEncoding.encode( this.encryptedData );
		}
		
		// not saving, so return the unencrypted view data
		return this.getUnencryptedViewData();
	}

	private setUnencryptedViewData(data: string, clear: boolean): void {
		this.cachedUnencryptedData = data;
		super.setViewData(data, false);
	}

	override setViewData(data: string, clear: boolean): void {
		// something is setting the view data, perhaps from reading from the
		// file... or some other plugin is adding some markdown

		if ( this.file == null ) {
			DevConsole.info( 'View data will not be set because file is null' )
			return;
		}

		if ( this.isLoadingFileInProgress ){
			return;
		}

		if ( !JsonFileEncoding.isEncoded(data) ){
			this.setUnencryptedViewData(data, clear);
			return;
		}

		DevConsole.info( 'View is being set with already encoded data, trying to decode', {
			dataLength: data.length,
		} );
		if (this.passwordAndHint == null){
			DevConsole.error('passwordAndHint == null');
			return;
		}
		const newEncoded = JsonFileEncoding.decode(data);
		
		FileDataHelper.decrypt( newEncoded, this.passwordAndHint.password ).then( decryptedText => {
			if ( decryptedText == null ){
				DevConsole.info('View was being set with already encoceded data but the decryption failed, closing view');
				this.isSavingEnabled = false; // don't overwrite the data when we detach
				this.leaf.detach();
				return;
			}
			this.setUnencryptedViewData(decryptedText, clear);
		});
		
	}

	override async setState(state: any, result: ViewStateResult): Promise<void> {
		if ( state.mode == 'preview' ){
			await this.save(); // save before preview
		}
		this.isSavingEnabled = false;
		try{
			await super.setState(state, result);
			super.setViewData(this.cachedUnencryptedData, false);
		}finally{
			this.isSavingEnabled = true;
		}
	}

	override async save(clear?: boolean | undefined): Promise<void> {
		DevConsole.debug('save', { clear });
		if ( this.isSavingInProgress ) {
			DevConsole.info('Saving was prevented because another save is in progress, Obsidian will try again later if the content changed.');
			return;
		}

		this.isSavingInProgress = true;
		this.setViewBusy( true );
		try{
			
			if (this.file == null){
				DevConsole.info('Saving was prevented beacuse there is no file loaded in the view yet');
				return;
			}

			if ( !ENCRYPTED_FILE_EXTENSIONS.includes( this.file.extension ) ){
				DevConsole.info('Saving was prevented because the file is not an encrypted file');
				return;
			}

			if (!this.isSavingEnabled){
				if (this.passwordAndHint == null){
					DevConsole.info('Saving was prevented because the file was not yet loaded with a password');
				}else{
					DevConsole.info('Saving was prevented because it was explicitly disabled');
				}
				return;
			}

			if (this.passwordAndHint == null){
				DevConsole.info('Saving was prevented beacuse there is no password set');
				return;
			}
			
			const unencryptedDataToSave = this.getUnencryptedViewData();
			
			if ( JsonFileEncoding.isEncoded( unencryptedDataToSave ) ){
				// data is already encrypted, protect it from being overwritten
				DevConsole.info('Saving was prevented beacuse the data was already encoded but it was expected to not be');
				return;
			}

			if (
				!this.dataWasChangedSinceLastSave
				&& this.cachedUnencryptedData.length == unencryptedDataToSave.length
				&& this.cachedUnencryptedData == unencryptedDataToSave
			){
				DevConsole.info('Saving was prevented because the data was not changed');
				return;
			}

			this.setUnencryptedViewData(unencryptedDataToSave, false);

			// build up-to-date encrypted data
			this.encryptedData = await FileDataHelper.encrypt(
				this.passwordAndHint.password,
				this.passwordAndHint.hint,
				unencryptedDataToSave
			);

			// call the real save.. which will call getViewData... getViewData will
			// decide whether to return encrypted or unencrypted data (encrypted
			// in this case becase this.isSavingInProgress is true)
			await super.save(clear);

			this.dataWasChangedSinceLastSave = false;

		} finally{
			this.isSavingInProgress = false;
			this.setViewBusy( false );
		}
		
	}

	async lockAndClose() {
		await this.detachSafely();
		if ( this.file != null ){
			SessionPasswordService.clearForFile( this.file );
		}
	}

	async changePassword(): Promise<void> {
		if (this.file == null){
			DevConsole.info('Unable to change password beacuse there is no file loaded in the view yet');
			return;
		}

		// fetch password
		const t = this.t();
		const pwm = new PluginPasswordModal(
			this.app,
			t('modal.title.changePasswordForFile', { file: this.file.basename }),
			true,
			true,
			await SessionPasswordService.peekByFile( this.file ),
			t
		);
			
		try{
			const newPwh = await pwm.openAsync();

			this.passwordAndHint = newPwh;
		
			SessionPasswordService.putByFile( newPwh, this.file );

			this.dataWasChangedSinceLastSave = true;
			await this.save();

			new Notice( 'Password changed' );
		}catch(error){
			new Notice( 'Password wasn\'t changed' );
		}
	}


}
