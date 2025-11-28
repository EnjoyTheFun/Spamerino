import { CopyPasta } from '../core/types';

export function getChannels(item: CopyPasta): string[] {
	if (Array.isArray(item.channels)) return item.channels;

	return [];
}

export function hasChannelMatch(item: CopyPasta, channel?: string): boolean {
	const normalized = (channel ?? '').trim().toLowerCase();

	if (!normalized) return true;


	const channels = getChannels(item);

	if (!channels.length) return true;

	return channels.some(entry => entry.toLowerCase() === normalized);
}
