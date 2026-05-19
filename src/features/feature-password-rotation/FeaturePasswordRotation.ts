import { Setting } from "obsidian";
import VaultEncrypt from "../../main.ts";
import { IVaultEncryptPluginSettings } from "../../settings/VaultEncryptPluginSettings.ts";
import { IVaultEncryptPluginFeature } from "../IVaultEncryptPluginFeature.ts";
import { createTranslator, Translator } from "../../i18n.ts";
import { PasswordRotationService } from "./PasswordRotationService.ts";
import { PasswordRotationModal } from "./PasswordRotationModal.ts";

export default class FeaturePasswordRotation implements IVaultEncryptPluginFeature {
	private plugin: VaultEncrypt;
	private settings: IVaultEncryptPluginSettings;

	async onload(plugin: VaultEncrypt, settings: IVaultEncryptPluginSettings): Promise<void> {
		this.plugin = plugin;
		this.settings = settings;

		this.plugin.addCommand({
			id: 'vault-encrypt-rotate-selected-passwords',
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
