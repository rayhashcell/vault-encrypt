import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { EncryptedMarkdownView } from "./EncryptedMarkdownView.ts";
import { MarkdownView, TFolder, normalizePath, moment, TFile, Notice } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { ExpiredSessionPasswordCacheItem, PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { ENCRYPTED_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSION_DEFAULT } from "../../services/Constants.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { createTranslator, Translator } from "../../i18n.ts";

export default class FeatureWholeNoteEncryptV2 implements IMeldEncryptPluginFeature {

	plugin: MeldEncrypt;
	private settings: IMeldEncryptPluginSettings;

	private statusIndicator: HTMLElement;

	async onload( plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings ) {
		this.plugin = plugin;
		this.settings = settings;
		//this.settings = settings.featureWholeNoteEncrypt;
		
		this.plugin.addRibbonIcon( 'file-lock-2', 'New encrypted note', async (ev)=>{
			await this.processCreateNewEncryptedNoteCommand( this.getDefaultFileFolder() );
		});

		this.plugin.addRibbonIcon( 'book-lock', 'Lock and Close all open encrypted notes', async (ev)=>{
			await this.processLockAndCloseAllEncryptedNotesCommand();
		});

		this.plugin.addCommand({
			id: 'custom-encrypt-create-new-note',
			name: 'Create new encrypted note',
			icon: 'file-lock-2',
			callback: async () => await this.processCreateNewEncryptedNoteCommand( this.getDefaultFileFolder() ),
		});

		this.plugin.addCommand({
			id: 'custom-encrypt-close-and-forget',
			name: 'Lock and Close all open encrypted notes',
			icon: 'book-lock',
			callback: async () => await this.processLockAndCloseAllEncryptedNotesCommand(),
		});
		
		this.plugin.registerEvent(
			this.plugin.app.workspace.on( 'file-menu', (menu, file) => {
				if (file instanceof TFolder){
					menu.addItem( (item) => {
						item
							.setTitle('New encrypted note')
							.setIcon('file-lock-2')
							.onClick( () => this.processCreateNewEncryptedNoteCommand( file ) );
						}
					);
				}
			})
		);

		// configure status indicator
		this.statusIndicator = this.plugin.addStatusBarItem();
		this.statusIndicator.hide();
		this.statusIndicator.setText('🛡️');

		// editor context menu
		this.plugin.registerEvent( this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
			if( view.file == null || !ENCRYPTED_FILE_EXTENSIONS.includes( view.file.extension ) ){
				return;
			}
			if (view instanceof EncryptedMarkdownView){
				menu.addItem( (item) => {
					item
						.setTitle('Change Password')
						.setIcon('key-round')
						.onClick( async () => await view.changePassword() );
					}
				);
				menu.addItem( (item) => {
					item
						.setTitle('Lock & Close')
						.setIcon('lock')
						.onClick( () => view.lockAndClose() );
					}
				);
			}
		}));

		this.plugin.registerEvent( this.plugin.app.workspace.on('file-menu', (menu, file) => {
			if ( !(file instanceof TFile) ){
				return
			}
			if( !ENCRYPTED_FILE_EXTENSIONS.includes( file.extension ) ){
				return;
			}

			const view = this.plugin.app.workspace.getActiveViewOfType( EncryptedMarkdownView );
			if (view == null || view.file != file){
				return;
			}

			menu.addItem( (item) => {
				item
					.setTitle('Change Password')
					.setIcon('key-round')
					.onClick( async () => await view.changePassword() );
				}
			);
			menu.addItem( (item) => {
				item
					.setTitle('Lock & Close')
					.setIcon('lock')
					.onClick( () => view.lockAndClose() );
				}
			);
		}))


		// register view
		this.plugin.registerView( EncryptedMarkdownView.VIEW_TYPE, (leaf) => new EncryptedMarkdownView(leaf, this.settings) );
		this.plugin.registerExtensions( ENCRYPTED_FILE_EXTENSIONS, EncryptedMarkdownView.VIEW_TYPE );

		// show status indicator for encrypted files, hide for others
		this.plugin.registerEvent( this.plugin.app.workspace.on('active-leaf-change', () => {
			const view = this.plugin.app.workspace.getActiveViewOfType(EncryptedMarkdownView);
			if (view == null){
				this.statusIndicator.hide();
				return;
			}
			this.statusIndicator.show();
		}));

		// make sure the view is the right type
		this.plugin.registerEvent(

            this.plugin.app.workspace.on('active-leaf-change', async (leaf) => {
				if ( leaf == null ){
					return;
				}
				
				if ( leaf.view instanceof EncryptedMarkdownView ){
					// correct view already active
					return;
				}

				if ( leaf.view instanceof MarkdownView ){

					const file = leaf.view.file;
					if ( file == null ){
						return;
					}
					
					if ( ENCRYPTED_FILE_EXTENSIONS.includes( file.extension ) ){
						// file is encrypted but has the wrong view type
						const viewState = leaf.getViewState();
						viewState.type = EncryptedMarkdownView.VIEW_TYPE;
						
						await leaf.setViewState( viewState );

						return;
					}

				}

			} )
		);

	}

	private async processLockAndCloseAllEncryptedNotesCommand(): Promise<void> {
		const lockedCount = await this.lockAndCloseAllEncryptedNotes();
		const itemsCleared = SessionPasswordService.clear();
		new Notice(
			lockedCount > 0
				? `Locked encrypted notes: ${lockedCount}. Remembered passwords cleared: ${itemsCleared}.`
				: `Remembered passwords cleared: ${itemsCleared}.`
		);
	}

	public async lockAndCloseAllEncryptedNotes(): Promise<number> {
		// loop through all open leaves
		const leaves = this.plugin.app.workspace.getLeavesOfType( EncryptedMarkdownView.VIEW_TYPE );
		let lockedCount = 0;
		for ( const leaf of leaves ) {
			const view = leaf.view as EncryptedMarkdownView;
			if ( view != null ){
				await view.lockAndClose();
				lockedCount++;
			}
		}
		return lockedCount;
	}

	public async lockAndCloseExpiredEncryptedNotes(
		expiredItems: ExpiredSessionPasswordCacheItem[]
	): Promise<number> {
		if ( expiredItems.some( item => item.isVault ) ){
			return await this.lockAndCloseAllEncryptedNotes();
		}

		const expiredFileKeys = new Set( expiredItems.map( item => item.key ) );
		const leaves = this.plugin.app.workspace.getLeavesOfType( EncryptedMarkdownView.VIEW_TYPE );
		let lockedCount = 0;
		for ( const leaf of leaves ) {
			const view = leaf.view as EncryptedMarkdownView;
			if ( view == null || view.file == null ){
				continue;
			}
			if ( !expiredFileKeys.has( SessionPasswordService.getFileScopedCacheKey( view.file ) ) ){
				continue;
			}
			await view.lockAndClose();
			lockedCount++;
		}
		return lockedCount;
	}

	private t(): Translator {
		return createTranslator(this.settings.settingsLanguage);
	}

	private getDefaultFileFolder() : TFolder {
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile != null){
			return this.plugin.app.fileManager.getNewFileParent(activeFile.path);
		}else{
			return this.plugin.app.fileManager.getNewFileParent('');
		}
	}

	private async processCreateNewEncryptedNoteCommand( parentFolder: TFolder ) : Promise<void> {
		
		const newFilename = moment().format( `[Untitled] YYYYMMDD hhmmss[.${ENCRYPTED_FILE_EXTENSION_DEFAULT}]`);
		const newFilepath = normalizePath( parentFolder.path + "/" + newFilename );
		const t = this.t();
		
		const pwm = new PluginPasswordModal(
			this.plugin.app,
			t('modal.title.providePasswordForEncryption'),
			true,
			true,
			await SessionPasswordService.peekByPathAsync( newFilepath ),
			t
		);

		let pwh : PasswordAndHint;
		try{
			pwh = await pwm.openAsync();
		}catch(e){
			return; // cancelled
		}

		// create the new file
		const fileData = await FileDataHelper.encrypt( pwh.password, pwh.hint, '' )
		const fileContents = JsonFileEncoding.encode( fileData );
		const file = await this.plugin.app.vault.create( newFilepath, fileContents );
		
		// cache the password
		SessionPasswordService.putByFile( pwh, file );

		// open the file
		const leaf = this.plugin.app.workspace.getLeaf( true );
		await leaf.openFile( file );

	}

	onunload() {
		this.plugin.app.workspace.detachLeavesOfType(EncryptedMarkdownView.VIEW_TYPE);
	}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>, t: Translator): void {
		//throw new Error("Method not implemented.");
	}

}
