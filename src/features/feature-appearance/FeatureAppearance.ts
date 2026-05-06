import { ColorComponent, Setting } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IFeatureAppearanceSettings } from "./IFeatureAppearanceSettings.ts";

const READABLE_LINE_HEIGHT_CLASS = 'custom-encrypt-readable-line-height';
const RAINBOW_FILE_EXPLORER_CLASS = 'custom-encrypt-rainbow-file-explorer';
const FILE_EXPLORER_ICONS_CLASS = 'custom-encrypt-file-explorer-icons';
const MARKDOWN_EXTENSION_BADGE_CLASS = 'custom-encrypt-markdown-extension-badge';
const RAINBOW_FOLDER_LEGACY_COLOR_PREFIX = '--custom-encrypt-rainbow-folder-';
const RAINBOW_FOLDER_LIGHT_COLOR_PREFIX = '--custom-encrypt-rainbow-folder-light-';
const RAINBOW_FOLDER_DARK_COLOR_PREFIX = '--custom-encrypt-rainbow-folder-dark-';
type RainbowFolderTheme = 'light' | 'dark';

const OLD_DEFAULT_RAINBOW_FOLDER_COLORS = [
	'#e45649',
	'#da8548',
	'#b58900',
	'#50a14f',
	'#0184bc',
	'#4078f2',
	'#a626a4',
];

const PREVIOUS_DEFAULT_RAINBOW_FOLDER_COLORS = [
	'#d84c4c',
	'#008f7a',
	'#b98500',
	'#3f7de8',
	'#4f8f28',
	'#8b5bd6',
	'#d66a2c',
	'#0098b3',
	'#c65ac7',
	'#7c8d1f',
];

export const DEFAULT_RAINBOW_FOLDER_COLORS_LIGHT = [
	'#e02f3e',
	'#008f72',
	'#bd7800',
	'#2f78e6',
	'#438d1f',
	'#8750d6',
	'#dc5a1e',
	'#0095ad',
	'#c43fc4',
	'#788a12',
];

export const DEFAULT_RAINBOW_FOLDER_COLORS_DARK = [
	'#ff6b73',
	'#20c9a8',
	'#ffc247',
	'#73a7ff',
	'#8ada70',
	'#b88cff',
	'#ff9858',
	'#40d2e8',
	'#f084f0',
	'#cadb58',
];

export const DEFAULT_RAINBOW_FOLDER_COLORS = DEFAULT_RAINBOW_FOLDER_COLORS_LIGHT;

export default class FeatureAppearance implements IMeldEncryptPluginFeature {
	private featureSettings: IFeatureAppearanceSettings;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings): Promise<void> {
		this.featureSettings = settings.featureAppearance;
		this.featureSettings.rainbowFolderColorsLight = this.getRainbowFolderColors('light');
		this.featureSettings.rainbowFolderColorsDark = this.getRainbowFolderColors('dark');
		this.featureSettings.rainbowFolderColors = this.featureSettings.rainbowFolderColorsLight;
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

		const lightColorPickers: ColorComponent[] = [];
		const darkColorPickers: ColorComponent[] = [];
		new Setting(containerEl)
			.setName('Rainbow folder colors')
			.setDesc('Choose separate ten-color cycles for light and dark themes.')
			.addButton(button => {
				button
					.setButtonText('Reset all')
					.onClick(async () => {
						this.setRainbowFolderColors('light', [...DEFAULT_RAINBOW_FOLDER_COLORS_LIGHT]);
						this.setRainbowFolderColors('dark', [...DEFAULT_RAINBOW_FOLDER_COLORS_DARK]);
						this.applyAppearanceSettings();
						lightColorPickers.forEach((colorPicker, index) => {
							colorPicker.setValue(this.featureSettings.rainbowFolderColorsLight[index]);
						});
						darkColorPickers.forEach((colorPicker, index) => {
							colorPicker.setValue(this.featureSettings.rainbowFolderColorsDark[index]);
						});
						await saveSettingCallback();
					})
				;
			})
		;

		this.buildRainbowFolderColorSettings(
			containerEl,
			'Light theme folder colors',
			'Light folder color',
			'light',
			lightColorPickers,
			saveSettingCallback
		);

		this.buildRainbowFolderColorSettings(
			containerEl,
			'Dark theme folder colors',
			'Dark folder color',
			'dark',
			darkColorPickers,
			saveSettingCallback
		);

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
			.setName('Show file extension badges')
			.setDesc('Shows file extension badges at the right edge of files in the file explorer.')
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
		this.getRainbowFolderColors('light').forEach((color, index) => {
			document.body.style.setProperty(`${RAINBOW_FOLDER_LIGHT_COLOR_PREFIX}${index + 1}`, color);
		});
		this.getRainbowFolderColors('dark').forEach((color, index) => {
			document.body.style.setProperty(`${RAINBOW_FOLDER_DARK_COLOR_PREFIX}${index + 1}`, color);
		});
	}

	private clearRainbowFolderColors(): void {
		DEFAULT_RAINBOW_FOLDER_COLORS.forEach((_, index) => {
			document.body.style.removeProperty(`${RAINBOW_FOLDER_LEGACY_COLOR_PREFIX}${index + 1}`);
			document.body.style.removeProperty(`${RAINBOW_FOLDER_LIGHT_COLOR_PREFIX}${index + 1}`);
			document.body.style.removeProperty(`${RAINBOW_FOLDER_DARK_COLOR_PREFIX}${index + 1}`);
		});
	}

	private buildRainbowFolderColorSettings(
		containerEl: HTMLElement,
		sectionName: string,
		colorNamePrefix: string,
		theme: RainbowFolderTheme,
		colorPickers: ColorComponent[],
		saveSettingCallback: () => Promise<void>
	): void {
		new Setting(containerEl)
			.setName(sectionName)
			.setDesc(`Used when Obsidian is in ${theme} theme.`)
			.addButton(button => {
				button
					.setButtonText('Reset')
					.onClick(async () => {
						this.setRainbowFolderColors(theme, [...this.getDefaultRainbowFolderColors(theme)]);
						this.applyAppearanceSettings();
						colorPickers.forEach((colorPicker, index) => {
							colorPicker.setValue(this.getRainbowFolderColors(theme)[index]);
						});
						await saveSettingCallback();
					})
				;
			})
		;

		this.getRainbowFolderColors(theme).forEach((color, index) => {
			new Setting(containerEl)
				.setName(`${colorNamePrefix} ${index + 1}`)
				.addColorPicker(colorPicker => {
					colorPickers[index] = colorPicker;
					colorPicker
						.setValue(color)
						.onChange(async value => {
							const colors = this.getRainbowFolderColors(theme);
							colors[index] = value;
							this.setRainbowFolderColors(theme, colors);
							this.applyAppearanceSettings();
							await saveSettingCallback();
						})
					;
				})
			;
		});
	}

	private setRainbowFolderColors(theme: RainbowFolderTheme, colors: string[]): void {
		if (theme === 'light') {
			this.featureSettings.rainbowFolderColorsLight = colors;
			this.featureSettings.rainbowFolderColors = colors;
			return;
		}
		this.featureSettings.rainbowFolderColorsDark = colors;
	}

	private getRainbowFolderColors(theme: RainbowFolderTheme): string[] {
		const fallbackColors = this.getDefaultRainbowFolderColors(theme);
		const configuredColors = this.getConfiguredRainbowFolderColors(theme);
		return fallbackColors.map((fallbackColor, index) => {
			const color = configuredColors[index];
			return this.isHexColor(color) ? color : fallbackColor;
		});
	}

	private getConfiguredRainbowFolderColors(theme: RainbowFolderTheme): string[] {
		const themeColors = theme === 'light'
			? this.featureSettings.rainbowFolderColorsLight
			: this.featureSettings.rainbowFolderColorsDark;

		if (themeColors?.length > 0) {
			return this.isDefaultRainbowFolderPalette(themeColors) ? [] : themeColors;
		}

		const legacyColors = this.featureSettings.rainbowFolderColors ?? [];
		return this.isDefaultRainbowFolderPalette(legacyColors) ? [] : legacyColors;
	}

	private getDefaultRainbowFolderColors(theme: RainbowFolderTheme): string[] {
		return theme === 'light'
			? DEFAULT_RAINBOW_FOLDER_COLORS_LIGHT
			: DEFAULT_RAINBOW_FOLDER_COLORS_DARK;
	}

	private isDefaultRainbowFolderPalette(colors: string[]): boolean {
		return [
			OLD_DEFAULT_RAINBOW_FOLDER_COLORS,
			PREVIOUS_DEFAULT_RAINBOW_FOLDER_COLORS,
			DEFAULT_RAINBOW_FOLDER_COLORS_LIGHT,
			DEFAULT_RAINBOW_FOLDER_COLORS_DARK,
		].some(defaultColors => this.isMatchingRainbowFolderPalette(colors, defaultColors));
	}

	private isMatchingRainbowFolderPalette(colors: string[], defaultColors: string[]): boolean {
		return colors.length === defaultColors.length
			&& defaultColors.every((color, index) => {
				return colors[index]?.toLowerCase() === color;
			});
	}

	private isHexColor(color: string | undefined): color is string {
		return color != null && /^#[0-9a-fA-F]{6}$/.test(color);
	}
}
