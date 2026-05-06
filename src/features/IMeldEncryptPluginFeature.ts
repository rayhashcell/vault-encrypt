import MeldEncrypt from "../main.ts";
import { IMeldEncryptPluginSettings } from "../settings/MeldEncryptPluginSettings.ts";
import { Translator } from "../i18n.ts";

export interface IMeldEncryptPluginFeature {
	onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings): Promise<void>;
	onunload(): void;
	buildSettingsUi(
		containerEl: HTMLElement,
		saveSettingCallback : () => Promise<void>,
		t: Translator
	) : void;
}
