import VaultEncrypt from "../main.ts";
import { IVaultEncryptPluginSettings } from "../settings/VaultEncryptPluginSettings.ts";
import { Translator } from "../i18n.ts";

export interface IVaultEncryptPluginFeature {
	onload(plugin: VaultEncrypt, settings: IVaultEncryptPluginSettings): Promise<void>;
	onunload(): void;
	buildSettingsUi(
		containerEl: HTMLElement,
		saveSettingCallback : () => Promise<void>,
		t: Translator
	) : void;
}
