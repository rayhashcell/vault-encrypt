import { ColorComponent, Setting } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IFeatureAppearanceSettings } from "./IFeatureAppearanceSettings.ts";

const READABLE_LINE_HEIGHT_CLASS = 'custom-encrypt-readable-line-height';
const RAINBOW_FILE_EXPLORER_CLASS = 'custom-encrypt-rainbow-file-explorer';
const FILE_EXPLORER_ICONS_CLASS = 'custom-encrypt-file-explorer-icons';
const MARKDOWN_EXTENSION_BADGE_CLASS = 'custom-encrypt-markdown-extension-badge';
const RAINBOW_FOLDER_COLOR_PREFIX = '--custom-encrypt-rainbow-folder-';

export const DEFAULT_RAINBOW_FOLDER_COLORS = [
	'#e45649',
	'#da8548',
	'#b58900',
	'#50a14f',
	'#0184bc',
	'#4078f2',
	'#a626a4',
];

export default class FeatureAppearance implements IMeldEncryptPluginFeature {
	private featureSettings: IFeatureAppearanceSettings;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings): Promise<void> {
		this.featureSettings = settings.featureAppearance;
		this.featureSettings.rainbowFolderColors = this.getRainbowFolderColors();
		this.applyAppearanceSettings();
	}

	onunload(): void {
		this.clearAppearanceSettings();
	}

	buildSettingsUi(
		containerEl: HTMLElement,
		saveSettingCallback: () => Promise<void>
	): void {
		new Setting(containerEl)
			.setHeading()
			.setName('Appearance helpers')
		;

		new Setting(containerEl)
			.setName('Use readable Markdown line height')
			.setDesc('Sets Obsidian normal line height to 1.8 while this option is enabled.')
			.addToggle(toggle => {
				toggle
					.setValue(this.featureSettings.readableLineHeight)
					.onChange(async value => {
						this.featureSettings.readableLineHeight = value;
						this.applyAppearanceSettings();
						await saveSettingCallback();
					})
				;
			})
		;

		new Setting(containerEl)
			.setName('Use rainbow file explorer folders')
			.setDesc('Colors each top-level folder and its descendants in the file explorer.')
			.addToggle(toggle => {
				toggle
					.setValue(this.featureSettings.rainbowFileExplorer)
					.onChange(async value => {
						this.featureSettings.rainbowFileExplorer = value;
						this.applyAppearanceSettings();
						await saveSettingCallback();
					})
				;
			})
		;

		const colorPickers: ColorComponent[] = [];
		new Setting(containerEl)
			.setName('Rainbow folder colors')
			.setDesc('Choose the seven colors used for the top-level folder color cycle.')
			.addButton(button => {
				button
					.setButtonText('Reset')
					.onClick(async () => {
						this.featureSettings.rainbowFolderColors = [...DEFAULT_RAINBOW_FOLDER_COLORS];
						this.applyAppearanceSettings();
						colorPickers.forEach((colorPicker, index) => {
							colorPicker.setValue(this.featureSettings.rainbowFolderColors[index]);
						});
						await saveSettingCallback();
					})
				;
			})
		;

		this.getRainbowFolderColors().forEach((color, index) => {
			new Setting(containerEl)
				.setName(`Folder color ${index + 1}`)
				.addColorPicker(colorPicker => {
					colorPickers[index] = colorPicker;
					colorPicker
						.setValue(color)
						.onChange(async value => {
							const colors = this.getRainbowFolderColors();
							colors[index] = value;
							this.featureSettings.rainbowFolderColors = colors;
							this.applyAppearanceSettings();
							await saveSettingCallback();
						})
					;
				})
			;
		});

		new Setting(containerEl)
			.setName('Show file explorer type icons')
			.setDesc('Adds file-type icons in the file explorer, including a key icon for .cenc files.')
			.addToggle(toggle => {
				toggle
					.setValue(this.featureSettings.fileExplorerIcons)
					.onChange(async value => {
						this.featureSettings.fileExplorerIcons = value;
						this.applyAppearanceSettings();
						await saveSettingCallback();
					})
				;
			})
		;

		new Setting(containerEl)
			.setName('Show Markdown extension badges')
			.setDesc('Shows an MD badge at the right edge of Markdown files in the file explorer.')
			.addToggle(toggle => {
				toggle
					.setValue(this.featureSettings.markdownExtensionBadge)
					.onChange(async value => {
						this.featureSettings.markdownExtensionBadge = value;
						this.applyAppearanceSettings();
						await saveSettingCallback();
					})
				;
			})
		;
	}

	private applyAppearanceSettings(): void {
		this.toggleBodyClass(READABLE_LINE_HEIGHT_CLASS, this.featureSettings.readableLineHeight);
		this.toggleBodyClass(RAINBOW_FILE_EXPLORER_CLASS, this.featureSettings.rainbowFileExplorer);
		this.toggleBodyClass(FILE_EXPLORER_ICONS_CLASS, this.featureSettings.fileExplorerIcons);
		this.toggleBodyClass(MARKDOWN_EXTENSION_BADGE_CLASS, this.featureSettings.markdownExtensionBadge);
		this.applyRainbowFolderColors();
	}

	private clearAppearanceSettings(): void {
		for ( const className of [
			READABLE_LINE_HEIGHT_CLASS,
			RAINBOW_FILE_EXPLORER_CLASS,
			FILE_EXPLORER_ICONS_CLASS,
			MARKDOWN_EXTENSION_BADGE_CLASS,
		] ) {
			document.body.classList.remove(className);
		}
		this.clearRainbowFolderColors();
	}

	private toggleBodyClass(className: string, enabled: boolean): void {
		document.body.classList.toggle(className, enabled);
	}

	private applyRainbowFolderColors(): void {
		this.getRainbowFolderColors().forEach((color, index) => {
			document.body.style.setProperty(`${RAINBOW_FOLDER_COLOR_PREFIX}${index + 1}`, color);
		});
	}

	private clearRainbowFolderColors(): void {
		DEFAULT_RAINBOW_FOLDER_COLORS.forEach((_, index) => {
			document.body.style.removeProperty(`${RAINBOW_FOLDER_COLOR_PREFIX}${index + 1}`);
		});
	}

	private getRainbowFolderColors(): string[] {
		const colors = this.featureSettings.rainbowFolderColors ?? [];
		return DEFAULT_RAINBOW_FOLDER_COLORS.map((fallbackColor, index) => {
			const color = colors[index];
			return this.isHexColor(color) ? color : fallbackColor;
		});
	}

	private isHexColor(color: string | undefined): color is string {
		return color != null && /^#[0-9a-fA-F]{6}$/.test(color);
	}
}
