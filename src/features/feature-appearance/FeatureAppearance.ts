import { ColorComponent, Setting, TFolder } from "obsidian";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IFeatureAppearanceSettings } from "./IFeatureAppearanceSettings.ts";
import { Translator } from "../../i18n.ts";

const READABLE_LINE_HEIGHT_CLASS = 'custom-encrypt-readable-line-height';
const RAINBOW_FILE_EXPLORER_CLASS = 'custom-encrypt-rainbow-file-explorer';
const RAINBOW_FILE_EXPLORER_ITEM_CLASS = 'custom-encrypt-rainbow-file-explorer-item';
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
	private plugin: MeldEncrypt;
	private rainbowFolderIndexByRootPath = new Map<string, number>();
	private rainbowFolderMutationObserver: MutationObserver | null = null;
	private rainbowFolderUpdateFrame: number | null = null;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings): Promise<void> {
		this.plugin = plugin;
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
		saveSettingCallback: () => Promise<void>,
		t: Translator
	): void {
		new Setting(containerEl)
			.setHeading()
			.setName(t('appearance.heading'))
		;

		new Setting(containerEl)
			.setName(t('appearance.readableLineHeight.name'))
			.setDesc(t('appearance.readableLineHeight.desc'))
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
			.setName(t('appearance.rainbowFileExplorer.name'))
			.setDesc(t('appearance.rainbowFileExplorer.desc'))
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
			.setName(t('appearance.rainbowFolderColors.name'))
			.setDesc(t('appearance.rainbowFolderColors.desc'))
			.addButton(button => {
				button
					.setButtonText(t('appearance.rainbowFolderColors.resetAll'))
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
			t('appearance.lightThemeFolderColors'),
			(index) => t('appearance.lightFolderColorName', { number: index + 1 }),
			'light',
			lightColorPickers,
			saveSettingCallback,
			t
		);

		this.buildRainbowFolderColorSettings(
			containerEl,
			t('appearance.darkThemeFolderColors'),
			(index) => t('appearance.darkFolderColorName', { number: index + 1 }),
			'dark',
			darkColorPickers,
			saveSettingCallback,
			t
		);

		new Setting(containerEl)
			.setName(t('appearance.fileExplorerIcons.name'))
			.setDesc(t('appearance.fileExplorerIcons.desc'))
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
			.setName(t('appearance.markdownExtensionBadge.name'))
			.setDesc(t('appearance.markdownExtensionBadge.desc'))
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
		this.updateRainbowFolderDomColoring();
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
		this.stopRainbowFolderDomColoring();
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

	private updateRainbowFolderDomColoring(): void {
		if (!this.featureSettings.rainbowFileExplorer) {
			this.stopRainbowFolderDomColoring();
			return;
		}

		this.startRainbowFolderDomColoring();
		this.scheduleRainbowFolderDomColoring();
	}

	private startRainbowFolderDomColoring(): void {
		if (this.rainbowFolderMutationObserver != null) {
			return;
		}

		this.rainbowFolderMutationObserver = new MutationObserver(() => {
			this.scheduleRainbowFolderDomColoring();
		});
		this.rainbowFolderMutationObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['data-path'],
			childList: true,
			subtree: true,
		});
	}

	private stopRainbowFolderDomColoring(): void {
		this.rainbowFolderMutationObserver?.disconnect();
		this.rainbowFolderMutationObserver = null;
		if (this.rainbowFolderUpdateFrame != null) {
			window.cancelAnimationFrame(this.rainbowFolderUpdateFrame);
			this.rainbowFolderUpdateFrame = null;
		}
		this.clearRainbowFolderDomColors();
	}

	private scheduleRainbowFolderDomColoring(): void {
		if (this.rainbowFolderUpdateFrame != null) {
			return;
		}

		this.rainbowFolderUpdateFrame = window.requestAnimationFrame(() => {
			this.rainbowFolderUpdateFrame = null;
			this.applyRainbowFolderDomColors();
		});
	}

	private applyRainbowFolderDomColors(): void {
		this.rebuildRainbowFolderIndexByRootPath();

		const navItems = document.body.querySelectorAll<HTMLElement>(
			'.nav-files-container .nav-folder, .nav-files-container .nav-file'
		);

		navItems.forEach(navItem => {
			const rootPath = this.getRootFolderPathForNavItem(navItem);
			if (rootPath == null) {
				this.clearRainbowFolderDomColor(navItem);
				return;
			}

			const colorIndex = this.getRainbowFolderColorIndex(rootPath);
			navItem.classList.add(RAINBOW_FILE_EXPLORER_ITEM_CLASS);
			navItem.style.setProperty('--rainbow-folder-color', `var(--rainbow-folder-${colorIndex + 1})`);
		});
	}

	private clearRainbowFolderDomColors(): void {
		document.body.querySelectorAll<HTMLElement>(`.${RAINBOW_FILE_EXPLORER_ITEM_CLASS}`).forEach(navItem => {
			this.clearRainbowFolderDomColor(navItem);
		});
	}

	private clearRainbowFolderDomColor(navItem: HTMLElement): void {
		navItem.classList.remove(RAINBOW_FILE_EXPLORER_ITEM_CLASS);
		navItem.style.removeProperty('--rainbow-folder-color');
	}

	private rebuildRainbowFolderIndexByRootPath(): void {
		const topLevelFolderPaths = this.plugin.app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && file.parent?.isRoot() === true)
			.map(folder => folder.path)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

		this.rainbowFolderIndexByRootPath = new Map(
			topLevelFolderPaths.map((path, index) => {
				return [path, index % DEFAULT_RAINBOW_FOLDER_COLORS.length];
			})
		);
	}

	private getRootFolderPathForNavItem(navItem: HTMLElement): string | null {
		const itemPath = this.getPathForNavItem(navItem);
		if (itemPath == null) {
			return null;
		}

		const normalizedPath = itemPath.replace(/^\/+/, '');
		if (normalizedPath.length === 0) {
			return null;
		}

		const rootPath = normalizedPath.split('/')[0];
		const isRootFile = !navItem.classList.contains('nav-folder') && !normalizedPath.includes('/');
		return isRootFile ? null : rootPath;
	}

	private getPathForNavItem(navItem: HTMLElement): string | null {
		const path = navItem.getAttribute('data-path')
			?? navItem.querySelector<HTMLElement>('[data-path]')?.getAttribute('data-path');
		return path?.trim() || null;
	}

	private getRainbowFolderColorIndex(rootPath: string): number {
		const existingIndex = this.rainbowFolderIndexByRootPath.get(rootPath);
		if (existingIndex != null) {
			return existingIndex;
		}

		const nextIndex = this.rainbowFolderIndexByRootPath.size % DEFAULT_RAINBOW_FOLDER_COLORS.length;
		this.rainbowFolderIndexByRootPath.set(rootPath, nextIndex);
		return nextIndex;
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
		getColorName: (index: number) => string,
		theme: RainbowFolderTheme,
		colorPickers: ColorComponent[],
		saveSettingCallback: () => Promise<void>,
		t: Translator
	): void {
		new Setting(containerEl)
			.setName(sectionName)
			.setDesc(theme === 'light'
				? t('appearance.usedWhenLightTheme')
				: t('appearance.usedWhenDarkTheme')
			)
			.addButton(button => {
				button
					.setButtonText(t('appearance.reset'))
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
				.setName(getColorName(index))
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
