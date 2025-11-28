import { CopyPasta } from '../core/types';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export function deriveTitle(content: string): string {
	const value = content.trim();

	if (!value) return 'Copypasta';

	const firstLine = value.split(/\r?\n/)[0]?.trim() ?? '';

	const base = firstLine || value;

	return base.length > TITLE_MAX ? `${base.slice(0, TITLE_MAX - 3)}...` : base;
}

export function deriveDescription(content: string): string {
	const value = content.trim();

	if (!value) return 'Saved message';

	return value.length > DESCRIPTION_MAX ? `${value.slice(0, DESCRIPTION_MAX - 3)}...` : value;
}

export function getDisplayTitle(item: CopyPasta): string {
	return deriveTitle(item.content);
}

export function getDisplayDescription(item: CopyPasta): string {
	return deriveDescription(item.content);
}

export function buildSearchHaystack(item: CopyPasta): string {
	return `${deriveTitle(item.content)}\u0000${item.content}`.toLowerCase();
}
