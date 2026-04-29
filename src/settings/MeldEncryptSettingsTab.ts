import { App, PluginSettingTab, Setting } from "obsidian";
import { IMeldEncryptPluginFeature } from "../features/IMeldEncryptPluginFeature.ts";
import { SessionPasswordService } from "../services/SessionPasswordService.ts";
import MeldEncrypt from "../main.ts";
import { IMeldEncryptPluginSettings } from "./MeldEncryptPluginSettings.ts";
import { DevConsole } from "../services/DevConsole.ts";

export default class MeldEncryptSettingsTab extends PluginSettingTab {
	plugin: MeldEncrypt;
	settings: IMeldEncryptPluginSettings;

	features:IMeldEncryptPluginFeature[];

	constructor(
		app: App,
		plugin: MeldEncrypt,
		settings:IMeldEncryptPluginSettings,
		features: IMeldEncryptPluginFeature[]
	) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
		this.features = features;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		
		new Setting(containerEl)
			.setName('Confirm password when encrypting')
			.setDesc('Ask for the password twice when encrypting, so typos are caught before encrypted content is written.')
			.addToggle( toggle =>{
				toggle
					.setValue(this.settings.confirmPassword)
					.onChange( async value =>{
						this.settings.confirmPassword = value;
						await this.plugin.saveSettings();
					})
			})
		;

		const updateRememberPasswordSettingsUi = () => {
			
			if ( !this.settings.rememberPassword ){
				pwTimeoutSetting.settingEl.hide();
				rememberPasswordLevelSetting.settingEl.hide();
				confirmRememberedPasswordBeforeOpenSetting.settingEl.hide();
				return;
			}

			pwTimeoutSetting.settingEl.show();

			rememberPasswordLevelSetting.settingEl.show();
			confirmRememberedPasswordBeforeOpenSetting.settingEl.show();

			const rememberPasswordTimeout = this.settings.rememberPasswordTimeout;

			let timeoutString = `for ${rememberPasswordTimeout} minute${rememberPasswordTimeout == 1 ? '' : 's'}`;
			if( rememberPasswordTimeout == 0 ){
				timeoutString = 'until Obsidian is closed';
			}

			pwTimeoutSetting.setName( `Remember password (${timeoutString})` )
		
		}

		new Setting(containerEl)
			.setName('Remember passwords during this session')
			.setDesc('Keep successfully used passwords in memory for this Obsidian session. Cached passwords are cleared when this is disabled, when Obsidian closes, or when the timeout expires. Open whole-note encrypted tabs lock when their remembered password expires.')
			.addToggle( toggle =>{
				toggle
					.setValue(this.settings.rememberPassword)
					.onChange( async value => {
						if ( !value ){
							await this.plugin.clearPasswordCacheAndLockEncryptedNotes();
						}
						this.settings.rememberPassword = value;
						await this.plugin.saveSettings();
						SessionPasswordService.setActive( this.settings.rememberPassword );
						updateRememberPasswordSettingsUi();
					})
			})
		;

		const rememberPasswordLevelSetting = new Setting(containerEl)
			.setName('Share remembered passwords by')
				.setDesc( this.buildRememberPasswordDescription() )
				.addDropdown( cb =>{
					cb
						.addOption( SessionPasswordService.LevelVault, 'Vault')
						.addOption( SessionPasswordService.LevelFilename, 'File')
						.setValue( this.settings.rememberPasswordLevel )
						.onChange( async value => {
							DevConsole.debug( 'rememberPasswordLevelSetting.onChange', { value } );
							if ( this.settings.rememberPasswordLevel != value ){
								await this.plugin.clearPasswordCacheAndLockEncryptedNotes();
							}
							this.settings.rememberPasswordLevel = value;
							await this.plugin.saveSettings();
							SessionPasswordService.setLevel( this.settings.rememberPasswordLevel );
							updateRememberPasswordSettingsUi();
						})
				;
			})
		;

		const confirmRememberedPasswordBeforeOpenSetting = new Setting(containerEl)
			.setName('Confirm remembered password before opening encrypted notes')
			.setDesc('When a whole-note password is already remembered, show the password dialog with it prefilled instead of opening the note automatically.')
			.addToggle( toggle => {
				toggle
					.setValue( this.settings.confirmRememberedPasswordBeforeOpen )
					.onChange( async value => {
						this.settings.confirmRememberedPasswordBeforeOpen = value;
						await this.plugin.saveSettings();
						updateRememberPasswordSettingsUi();
					})
				;
			})
		;

		
		const pwTimeoutSetting = new Setting(containerEl)
			.setDesc('0 keeps cached passwords until Obsidian closes. 1-120 clears remembered passwords after that many minutes; the timer refreshes only after a password is successfully used or saved.')
			.addSlider( slider => {
				slider
					.setLimits(0, 120, 1)
					.setValue(this.settings.rememberPasswordTimeout)
					.onChange( async value => {
						this.settings.rememberPasswordTimeout = value;
						await this.plugin.saveSettings();
						SessionPasswordService.setAutoExpire( this.settings.rememberPasswordTimeout );
						updateRememberPasswordSettingsUi();
					})
				;
				
			})
		;

		updateRememberPasswordSettingsUi();

		// build feature settings
		this.features.forEach(f => {
			f.buildSettingsUi( containerEl, async () => await this.plugin.saveSettings() );
		});
		
	}

	private buildRememberPasswordDescription( ) : DocumentFragment {
		const f = new DocumentFragment();

		const tbody = f.createEl( 'table' ).createTBody();

		
		let tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: 'Vault:', attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: 'Use one shared cached password for all encrypted notes and inline encrypted text in this vault.' });
		
		tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: 'File:', attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: 'Cache passwords separately by file path, without the file extension.' });

		return f;
	}

}
