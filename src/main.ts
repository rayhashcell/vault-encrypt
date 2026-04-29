import { Notice, Plugin } from 'obsidian';
import MeldEncryptSettingsTab from './settings/MeldEncryptSettingsTab.ts';
import { IMeldEncryptPluginSettings } from './settings/MeldEncryptPluginSettings.ts';
import { IMeldEncryptPluginFeature } from './features/IMeldEncryptPluginFeature.ts';
import { SessionPasswordService } from './services/SessionPasswordService.ts';
import FeatureInplaceEncrypt from './features/feature-inplace-encrypt/FeatureInplaceEncrypt.ts';
import FeatureConvertNote from './features/feature-convert-note/FeatureConvertNote.ts';
import FeatureWholeNoteEncryptV2 from './features/feature-whole-note-encrypt/FeatureWholeNoteEncrypt.ts';
import { DevConsole } from './services/DevConsole.ts';

export default class MeldEncrypt extends Plugin {

	private settings: IMeldEncryptPluginSettings;

	private enabledFeatures : IMeldEncryptPluginFeature[] = [];
	private wholeNoteEncryptFeature: FeatureWholeNoteEncryptV2;
	private isAutoLockingExpiredSession = false;

	async onload() {

		// Settings
		await this.loadSettings();

		this.wholeNoteEncryptFeature = new FeatureWholeNoteEncryptV2();
		this.enabledFeatures.push(
			this.wholeNoteEncryptFeature,
			new FeatureConvertNote(),
			new FeatureInplaceEncrypt(),
		);

		this.addSettingTab(
			new MeldEncryptSettingsTab(
				this.app,
				this,
				this.settings,
				this.enabledFeatures
			)
		);
		// End Settings

		this.addCommand({
			id: 'custom-encrypt-clear-password-cache',
			name: 'Clear Session Password Cache and Lock Notes',
			icon: 'shield-ellipsis',
			callback: async () => await this.clearPasswordCacheAndLockEncryptedNotes(),
		});

		this.registerInterval(
			window.setInterval(
				() => this.lockEncryptedNotesIfSessionExpired().catch( error => DevConsole.error(error) ),
				1000
			)
		);

		// load features
		this.enabledFeatures.forEach(async f => {
			await f.onload( this, this.settings );
		});

	}

	override onunload() {
		this.enabledFeatures.forEach(async f => {
			f.onunload();
		});
		super.onunload();
	}

	public async clearPasswordCacheAndLockEncryptedNotes(): Promise<void> {
		const lockedCount = await this.wholeNoteEncryptFeature.lockAndCloseAllEncryptedNotes();
		const itemsCleared = SessionPasswordService.clear();
		new Notice(
			lockedCount > 0
				? `Locked encrypted notes: ${lockedCount}. Remembered passwords cleared: ${itemsCleared}.`
				: `Remembered passwords cleared: ${itemsCleared}.`
		);
	}

	private async lockEncryptedNotesIfSessionExpired() {
		if ( this.isAutoLockingExpiredSession ){
			return;
		}

		const expiredItems = SessionPasswordService.clearExpired();
		if ( expiredItems.length == 0 ){
			return;
		}

		this.isAutoLockingExpiredSession = true;
		try {
			const lockedCount = await this.wholeNoteEncryptFeature.lockAndCloseExpiredEncryptedNotes( expiredItems );
			new Notice(
				lockedCount > 0
					? 'Session password expired. Open encrypted notes locked.'
					: 'Session password expired. Password cache cleared.'
			);
		} finally {
			this.isAutoLockingExpiredSession = false;
		}
	}

	async loadSettings() {

		const DEFAULT_SETTINGS: IMeldEncryptPluginSettings = {
			confirmPassword: true,
			rememberPassword: true,
			rememberPasswordTimeout: 30,
			rememberPasswordLevel: SessionPasswordService.LevelVault,
			confirmRememberedPasswordBeforeOpen: false,

			featureWholeNoteEncrypt: {
			},

			featureInplaceEncrypt:{
				markerSearchLimit: 10000,
				showMarkerWhenReadingDefault: true
			}
		}

		const loadedSettings = await this.loadData() as Partial<IMeldEncryptPluginSettings> | null;
		this.settings = {
			confirmPassword: loadedSettings?.confirmPassword ?? DEFAULT_SETTINGS.confirmPassword,
			rememberPassword: loadedSettings?.rememberPassword ?? DEFAULT_SETTINGS.rememberPassword,
			rememberPasswordTimeout: loadedSettings?.rememberPasswordTimeout ?? DEFAULT_SETTINGS.rememberPasswordTimeout,
			rememberPasswordLevel: loadedSettings?.rememberPasswordLevel ?? DEFAULT_SETTINGS.rememberPasswordLevel,
			confirmRememberedPasswordBeforeOpen: loadedSettings?.confirmRememberedPasswordBeforeOpen ?? DEFAULT_SETTINGS.confirmRememberedPasswordBeforeOpen,
			featureWholeNoteEncrypt: {
				...DEFAULT_SETTINGS.featureWholeNoteEncrypt,
				...(loadedSettings?.featureWholeNoteEncrypt ?? {}),
			},
			featureInplaceEncrypt:{
				markerSearchLimit: loadedSettings?.featureInplaceEncrypt?.markerSearchLimit ?? DEFAULT_SETTINGS.featureInplaceEncrypt.markerSearchLimit,
				showMarkerWhenReadingDefault: loadedSettings?.featureInplaceEncrypt?.showMarkerWhenReadingDefault ?? DEFAULT_SETTINGS.featureInplaceEncrypt.showMarkerWhenReadingDefault,
			}
		};

		// apply settings
		SessionPasswordService.setActive( this.settings.rememberPassword );
		SessionPasswordService.setAutoExpire(
			this.settings.rememberPasswordTimeout == 0
			? null
			: this.settings.rememberPasswordTimeout
		);
		SessionPasswordService.setLevel( this.settings.rememberPasswordLevel );
		this.settings.rememberPasswordLevel = SessionPasswordService.getLevel();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}
