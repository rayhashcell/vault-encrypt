import { Setting } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { createTranslator, Translator } from "../../i18n.ts";
import { PasswordRotationService } from "./PasswordRotationService.ts";
import { PasswordRotationModal } from "./PasswordRotationModal.ts";

export default class FeaturePasswordRotation implements IMeldEncryptPluginFeature {
	private plugin: MeldEncrypt;
	private settings: IMeldEncryptPluginSettings;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings): Promise<void> {
		this.plugin = plugin;
		this.settings = settings;

		this.plugin.addCommand({
			id: 'custom-encrypt-rotate-selected-passwords',
			name: 'Rotate selected encrypted passwords',
			icon: 'key-round',
			callback: () => this.openPasswordRotationModal(),
		});
	}

	onunload(): void { }

	buildSettingsUi(containerEl: HTMLElement, _saveSettingCallback: () => Promise<void>, t: Translator): void {
		new Setting(containerEl)
			.setName(t('passwordRotation.settings.name'))
			.setDesc(t('passwordRotation.settings.desc'))
			.addButton(button => button
				.setButtonText(t('passwordRotation.settings.openButton'))
				.setCta()
				.onClick(() => this.openPasswordRotationModal())
			)
		;
	}

	private openPasswordRotationModal(): void {
		const t = createTranslator(this.settings.settingsLanguage);
		const service = new PasswordRotationService(this.plugin.app, t);
		new PasswordRotationModal(this.plugin.app, service, t).open();
	}
}
