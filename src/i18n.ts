export const SETTINGS_LANGUAGES = ['en', 'zh-CN'] as const;
export type SettingsLanguage = typeof SETTINGS_LANGUAGES[number];

export const DEFAULT_SETTINGS_LANGUAGE: SettingsLanguage = 'en';

const enTranslations = {
	'settings.language.name': 'Settings language',
	'settings.language.desc': 'Choose the language used by Custom Encrypt settings and related dialogs.',
	'settings.language.option.en': 'English',
	'settings.language.option.zhCn': '简体中文',
	'settings.confirmPassword.name': 'Confirm password when encrypting',
	'settings.confirmPassword.desc': 'Ask for the password twice when encrypting, so typos are caught before encrypted content is written.',
	'settings.rememberPassword.name': 'Remember passwords during this session',
	'settings.rememberPassword.desc': 'Keep successfully used passwords in memory for this Obsidian session. Cached passwords are cleared when this is disabled, when Obsidian closes, or when the timeout expires. Open whole-note encrypted tabs lock when their remembered password expires.',
	'settings.rememberPassword.timeout.name': 'Remember password ({timeout})',
	'settings.rememberPassword.timeout.forMinutes': 'for {minutes} minutes',
	'settings.rememberPassword.timeout.forOneMinute': 'for 1 minute',
	'settings.rememberPassword.timeout.untilClosed': 'until Obsidian is closed',
	'settings.rememberPassword.shareBy.name': 'Share remembered passwords by',
	'settings.rememberPassword.shareBy.vault': 'Vault',
	'settings.rememberPassword.shareBy.file': 'File',
	'settings.rememberPassword.shareBy.vaultLabel': 'Vault:',
	'settings.rememberPassword.shareBy.fileLabel': 'File:',
	'settings.rememberPassword.shareBy.vaultDesc': 'Use one shared cached password for all encrypted notes and inline encrypted text in this vault.',
	'settings.rememberPassword.shareBy.fileDesc': 'Cache passwords separately by file path, without the file extension.',
	'settings.confirmRememberedPasswordBeforeOpen.name': 'Confirm remembered password before opening encrypted notes',
	'settings.confirmRememberedPasswordBeforeOpen.desc': 'When a whole-note password is already remembered, show the password dialog with it prefilled instead of opening the note automatically.',
	'settings.rememberPasswordTimeout.desc': '0 keeps cached passwords until Obsidian closes. 1-120 clears remembered passwords after that many minutes; the timer refreshes only after a password is successfully used or saved.',
	'appearance.heading': 'Appearance helpers',
	'appearance.readableLineHeight.name': 'Use readable Markdown line height',
	'appearance.readableLineHeight.desc': 'Sets Obsidian normal line height to 1.8 while this option is enabled.',
	'appearance.rainbowFileExplorer.name': 'Use rainbow file explorer folders',
	'appearance.rainbowFileExplorer.desc': 'Colors each top-level folder and its descendants in the file explorer.',
	'appearance.rainbowFolderColors.name': 'Rainbow folder colors',
	'appearance.rainbowFolderColors.desc': 'Choose separate ten-color cycles for light and dark themes.',
	'appearance.rainbowFolderColors.resetAll': 'Reset all',
	'appearance.lightThemeFolderColors': 'Light theme folder colors',
	'appearance.darkThemeFolderColors': 'Dark theme folder colors',
	'appearance.lightFolderColorName': 'Light folder color {number}',
	'appearance.darkFolderColorName': 'Dark folder color {number}',
	'appearance.usedWhenLightTheme': 'Used when Obsidian is in light theme.',
	'appearance.usedWhenDarkTheme': 'Used when Obsidian is in dark theme.',
	'appearance.reset': 'Reset',
	'appearance.fileExplorerIcons.name': 'Show file explorer type icons',
	'appearance.fileExplorerIcons.desc': 'Adds file-type icons in the file explorer, including a key icon for .cenc files.',
	'appearance.markdownExtensionBadge.name': 'Show file extension badges',
	'appearance.markdownExtensionBadge.desc': 'Shows file extension badges at the right edge of files in the file explorer.',
	'inplace.heading': 'In-place encryption',
	'inplace.markerSearchLimit.name': 'Inline marker search limit',
	'inplace.markerSearchLimit.desc': 'Maximum characters to scan before and after the cursor or selection when finding inline encryption markers. Increase this for very long encrypted blocks.',
	'inplace.showMarkerWhenReadingDefault.name': 'Show inline encryption markers in Reading view by default',
	'inplace.showMarkerWhenReadingDefault.desc': 'Default for new inline encryption only. On shows lock markers in Reading view; off hides them with Markdown comments.',
	'modal.title.encryptNote': 'Encrypt Note',
	'modal.title.decryptNote': 'Decrypt Note',
	'modal.title.decryptingFile': 'Decrypting "{file}"',
	'modal.title.changePasswordForFile': 'Change password for "{file}"',
	'modal.title.providePasswordForEncryption': 'Please provide a password for encryption',
	'modal.title.encrypting': 'Encrypting',
	'modal.title.decrypting': 'Decrypting',
	'modal.password.name': 'Password:',
	'modal.password.hintPlaceholder': 'Hint: {hint}',
	'modal.password.showPasswordTooltip': 'Show password',
	'modal.password.hidePasswordTooltip': 'Hide password',
	'modal.confirmPassword.name': 'Confirm Password:',
	'modal.optionalPasswordHint.name': 'Optional Password Hint',
	'modal.optionalPasswordHint.placeholder': 'Password Hint',
	'modal.showEncryptedMarkerInReadingView.name': 'Show encrypted marker in Reading view',
	'modal.button.confirm': 'Confirm',
	'modal.button.save': 'Save',
	'modal.button.copy': 'Copy',
	'modal.button.decryptInPlace': 'Decrypt in-place',
	'modal.validation.passwordsDontMatch': 'Passwords don\'t match',
	'modal.validation.passwordHintCannotContainBackticks': 'Password hint cannot contain backticks.',
	'modal.notice.copied': 'Copied!',
} satisfies Record<string, string>;

export type TranslationKey = keyof typeof enTranslations;

const zhCnTranslations = {
	'settings.language.name': '设置语言',
	'settings.language.desc': '选择 Custom Encrypt 设置页和相关弹窗使用的语言。',
	'settings.language.option.en': 'English',
	'settings.language.option.zhCn': '简体中文',
	'settings.confirmPassword.name': '加密时确认密码',
	'settings.confirmPassword.desc': '加密时需要输入两次密码，以便在写入加密内容前发现输入错误。',
	'settings.rememberPassword.name': '在本次会话中记住密码',
	'settings.rememberPassword.desc': '将成功使用过的密码临时保存在内存中。关闭此选项、关闭 Obsidian 或超时后会清除缓存密码。已打开的整篇加密笔记会在记住的密码过期后自动锁定。',
	'settings.rememberPassword.timeout.name': '记住密码（{timeout}）',
	'settings.rememberPassword.timeout.forMinutes': '{minutes} 分钟',
	'settings.rememberPassword.timeout.forOneMinute': '1 分钟',
	'settings.rememberPassword.timeout.untilClosed': '直到 Obsidian 关闭',
	'settings.rememberPassword.shareBy.name': '记住的密码共享范围',
	'settings.rememberPassword.shareBy.vault': '库',
	'settings.rememberPassword.shareBy.file': '文件',
	'settings.rememberPassword.shareBy.vaultLabel': '库：',
	'settings.rememberPassword.shareBy.fileLabel': '文件：',
	'settings.rememberPassword.shareBy.vaultDesc': '此库中的所有整篇加密笔记和行内加密文本共用一个缓存密码。',
	'settings.rememberPassword.shareBy.fileDesc': '按文件路径分别缓存密码，不包含文件扩展名。',
	'settings.confirmRememberedPasswordBeforeOpen.name': '打开加密笔记前确认已记住的密码',
	'settings.confirmRememberedPasswordBeforeOpen.desc': '当整篇笔记的密码已被记住时，显示已预填密码的密码弹窗，而不是自动打开笔记。',
	'settings.rememberPasswordTimeout.desc': '0 表示缓存密码保留到 Obsidian 关闭。1-120 表示在对应分钟数后清除记住的密码；计时器只会在密码成功使用或保存后刷新。',
	'appearance.heading': '外观辅助',
	'appearance.readableLineHeight.name': '使用更易读的 Markdown 行高',
	'appearance.readableLineHeight.desc': '启用后将 Obsidian 正文行高设置为 1.8。',
	'appearance.rainbowFileExplorer.name': '使用彩虹文件浏览器文件夹',
	'appearance.rainbowFileExplorer.desc': '为文件浏览器中的每个顶层文件夹及其子项着色。',
	'appearance.rainbowFolderColors.name': '彩虹文件夹颜色',
	'appearance.rainbowFolderColors.desc': '为浅色和深色主题分别设置十色循环。',
	'appearance.rainbowFolderColors.resetAll': '全部重置',
	'appearance.lightThemeFolderColors': '浅色主题文件夹颜色',
	'appearance.darkThemeFolderColors': '深色主题文件夹颜色',
	'appearance.lightFolderColorName': '浅色文件夹颜色 {number}',
	'appearance.darkFolderColorName': '深色文件夹颜色 {number}',
	'appearance.usedWhenLightTheme': 'Obsidian 使用浅色主题时生效。',
	'appearance.usedWhenDarkTheme': 'Obsidian 使用深色主题时生效。',
	'appearance.reset': '重置',
	'appearance.fileExplorerIcons.name': '显示文件浏览器类型图标',
	'appearance.fileExplorerIcons.desc': '在文件浏览器中添加文件类型图标，包括用于 .cenc 文件的钥匙图标。',
	'appearance.markdownExtensionBadge.name': '显示文件扩展名徽标',
	'appearance.markdownExtensionBadge.desc': '在文件浏览器中文件右侧显示扩展名徽标。',
	'inplace.heading': '行内加密',
	'inplace.markerSearchLimit.name': '行内标记搜索范围',
	'inplace.markerSearchLimit.desc': '查找行内加密标记时，在光标或选区前后扫描的最大字符数。对于非常长的加密块可以调大此值。',
	'inplace.showMarkerWhenReadingDefault.name': '默认在阅读视图中显示行内加密标记',
	'inplace.showMarkerWhenReadingDefault.desc': '仅作为新行内加密的默认值。开启时在阅读视图显示锁标记；关闭时用 Markdown 注释隐藏标记。',
	'modal.title.encryptNote': '加密笔记',
	'modal.title.decryptNote': '解密笔记',
	'modal.title.decryptingFile': '正在解密“{file}”',
	'modal.title.changePasswordForFile': '修改“{file}”的密码',
	'modal.title.providePasswordForEncryption': '请提供用于加密的密码',
	'modal.title.encrypting': '正在加密',
	'modal.title.decrypting': '正在解密',
	'modal.password.name': '密码：',
	'modal.password.hintPlaceholder': '提示：{hint}',
	'modal.password.showPasswordTooltip': '显示密码',
	'modal.password.hidePasswordTooltip': '隐藏密码',
	'modal.confirmPassword.name': '确认密码：',
	'modal.optionalPasswordHint.name': '可选密码提示',
	'modal.optionalPasswordHint.placeholder': '密码提示',
	'modal.showEncryptedMarkerInReadingView.name': '在阅读视图中显示加密标记',
	'modal.button.confirm': '确认',
	'modal.button.save': '保存',
	'modal.button.copy': '复制',
	'modal.button.decryptInPlace': '原地解密',
	'modal.validation.passwordsDontMatch': '两次输入的密码不一致',
	'modal.validation.passwordHintCannotContainBackticks': '密码提示不能包含反引号。',
	'modal.notice.copied': '已复制！',
} satisfies Record<TranslationKey, string>;

const TRANSLATIONS: Record<SettingsLanguage, Record<TranslationKey, string>> = {
	en: enTranslations,
	'zh-CN': zhCnTranslations,
};

export type TranslationParams = Record<string, string | number>;
export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export function normalizeSettingsLanguage(language: unknown): SettingsLanguage {
	return language === 'zh-CN' ? 'zh-CN' : DEFAULT_SETTINGS_LANGUAGE;
}

export function createTranslator(language: unknown): Translator {
	const settingsLanguage = normalizeSettingsLanguage(language);

	return (key, params = {}) => {
		const translation = TRANSLATIONS[settingsLanguage][key] ?? enTranslations[key];
		return interpolateTranslation(translation, params);
	};
}

function interpolateTranslation(
	translation: string,
	params: TranslationParams
): string {
	let result = translation;
	Object.keys(params).forEach((key) => {
		result = result.split(`{${key}}`).join(params[key].toString());
	});
	return result;
}
