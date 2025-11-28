import { CopyPasta } from '../../core/types';
import { TwitchPlatform } from '../../core/TwitchPlatform';
import { getChannels } from '../../shared/channels';
import { deriveDescription, deriveTitle } from '../../shared/copyPasta';

export type Item = CopyPasta;

export function channelFilter(channel?: string) {
	const channelKey = (channel ?? '').toLowerCase();
	return (item: Item) => {
		if (!channelKey) return true;
		const list = getChannels(item);
		if (!list.length) return true;
		return list.some(entry => entry.toLowerCase() === channelKey);
	};
}

export function normalizeChannelInput(raw: string, platform: TwitchPlatform): string | undefined {
	const trimmed = raw.trim();

	if (!trimmed) return undefined;

	try {
		const detected = platform.getChannel(trimmed);
		if (detected) return detected.toLowerCase();
		const url = new URL(trimmed);
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts.length) return parts[parts.length - 1].toLowerCase();
	} catch { }

	const cleaned = trimmed.replace(/^@/, '').toLowerCase();

	if (!cleaned) return undefined;
	if (!/^[a-z0-9_]+$/.test(cleaned)) throw new Error('Please enter a valid Twitch channel URL or name');

	return cleaned;
}

export { deriveTitle, deriveDescription };
