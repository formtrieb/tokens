/**
 * Shared type definitions for the token build pipeline.
 */

export interface Theme {
	id: string;
	name: string;
	group: string;
	selectedTokenSets: Record<string, 'enabled' | 'source' | 'disabled'>;
}

export interface GroupedThemes {
	[group: string]: Theme[];
}

export interface TypographyValue {
	fontFamily?: string;
	fontWeight?: string;
	fontSize?: string;
	lineHeight?: string;
	letterSpacing?: string;
	textCase?: string;
	textDecoration?: string;
	paragraphSpacing?: string;
	paragraphIndent?: string;
}

export interface TypographyToken {
	path: string[];
	value: TypographyValue;
}
