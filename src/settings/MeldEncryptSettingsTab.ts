import { App, PluginSettingTab, Setting } from "obsidian";
import { IMeldEncryptPluginFeature } from "../features/IMeldEncryptPluginFeature.ts";
import { SessionPasswordService } from "../services/SessionPasswordService.ts";
import MeldEncrypt from "../main.ts";
import { IMeldEncryptPluginSettings } from "./MeldEncryptPluginSettings.ts";
import { DevConsole } from "../services/DevConsole.ts";
import {
	createTranslator,
	normalizeSettingsLanguage,
	Translator,
} from "../i18n.ts";

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
		const t = createTranslator(this.settings.settingsLanguage);

		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settings.language.name'))
			.setDesc(t('settings.language.desc'))
			.addDropdown(dropdown => {
				dropdown
					.addOption('en', t('settings.language.option.en'))
					.addOption('zh-CN', t('settings.language.option.zhCn'))
					.setValue(this.settings.settingsLanguage)
					.onChange(async value => {
						this.settings.settingsLanguage = normalizeSettingsLanguage(value);
						await this.plugin.saveSettings();
						this.display();
					})
				;
			})
		;
		
		new Setting(containerEl)
			.setName(t('settings.confirmPassword.name'))
			.setDesc(t('settings.confirmPassword.desc'))
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

			let timeoutString = t('settings.rememberPassword.timeout.forMinutes', {
				minutes: rememberPasswordTimeout,
			});
			if (rememberPasswordTimeout == 1) {
				timeoutString = t('settings.rememberPassword.timeout.forOneMinute');
			}
			if( rememberPasswordTimeout == 0 ){
				timeoutString = t('settings.rememberPassword.timeout.untilClosed');
			}

			pwTimeoutSetting.setName(t('settings.rememberPassword.timeout.name', {
				timeout: timeoutString,
			}));
		
		}

		new Setting(containerEl)
			.setName(t('settings.rememberPassword.name'))
			.setDesc(t('settings.rememberPassword.desc'))
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
			.setName(t('settings.rememberPassword.shareBy.name'))
				.setDesc( this.buildRememberPasswordDescription(t) )
				.addDropdown( cb =>{
					cb
						.addOption( SessionPasswordService.LevelVault, t('settings.rememberPassword.shareBy.vault'))
						.addOption( SessionPasswordService.LevelFilename, t('settings.rememberPassword.shareBy.file'))
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
			.setName(t('settings.confirmRememberedPasswordBeforeOpen.name'))
			.setDesc(t('settings.confirmRememberedPasswordBeforeOpen.desc'))
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
			.setDesc(t('settings.rememberPasswordTimeout.desc'))
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
			f.buildSettingsUi( containerEl, async () => await this.plugin.saveSettings(), t );
		});
		
	}

	private buildRememberPasswordDescription(t: Translator) : DocumentFragment {
		const f = new DocumentFragment();

		const tbody = f.createEl( 'table' ).createTBody();

		
		let tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t('settings.rememberPassword.shareBy.vaultLabel'), attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: t('settings.rememberPassword.shareBy.vaultDesc') });
		
		tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t('settings.rememberPassword.shareBy.fileLabel'), attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: t('settings.rememberPassword.shareBy.fileDesc') });

		return f;
	}

}
