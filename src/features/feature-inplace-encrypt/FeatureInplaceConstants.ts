
export const ENCRYPTED_ICON = '🛡️';
export const INPLACE_FORMAT_TAG_V2 = '@v2';
export const INPLACE_VERSION_V2 = 2;

export const _PREFIX_V2 = `%%${ENCRYPTED_ICON}\`${INPLACE_FORMAT_TAG_V2} `;
export const _PREFIX_V2_VISIBLE = `${ENCRYPTED_ICON}\`${INPLACE_FORMAT_TAG_V2} `;

export interface InPlaceFormatDefinition{
	version: number;
	hiddenPrefix: string;
	visiblePrefix: string;
}

export const INPLACE_FORMATS: InPlaceFormatDefinition[] = [
	{
		version: INPLACE_VERSION_V2,
		hiddenPrefix: _PREFIX_V2,
		visiblePrefix: _PREFIX_V2_VISIBLE
	}
];

export const _PREFIX_ENCODE_DEFAULT = _PREFIX_V2;
export const _PREFIX_ENCODE_DEFAULT_VISIBLE = _PREFIX_V2_VISIBLE;

// Should be listed by evaluation priority
export const _PREFIXES = INPLACE_FORMATS.reduce( (prefixes, format) => {
	prefixes.push(format.hiddenPrefix, format.visiblePrefix);
	return prefixes;
}, [] as string[] );

export const _VISIBLE_PREFIXES = INPLACE_FORMATS.map( format => format.visiblePrefix );

export const _SUFFIX_WITH_COMMENT = '`🛡️%%';
export const _SUFFIX_NO_COMMENT = '`🛡️';

// Should be listed by evaluation priority
export const _SUFFIXES = [
	_SUFFIX_WITH_COMMENT,
	_SUFFIX_NO_COMMENT
];

export const _HINT = '💡';
