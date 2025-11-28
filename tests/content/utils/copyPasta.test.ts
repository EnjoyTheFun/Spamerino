import { describe, it, expect } from 'vitest';
import { channelFilter } from '../../../src/content/utils/copyPasta';
import { CopyPasta } from '../../../src/core/types';

describe('copyPasta utils', () => {
	describe('channelFilter', () => {
		const allChannelsItem: CopyPasta = {
			id: 1,
			content: 'Global message',
			tags: [],
			channels: [],
		};

		const channelSpecificItem: CopyPasta = {
			id: 2,
			content: 'Channel specific',
			tags: [],
			channels: ['xqc', 'shroud'],
		};

		it('should include items with no channel restriction', () => {
			const filter = channelFilter('forsen');
			expect(filter(allChannelsItem)).toBe(true);
		});

		it('should include items matching current channel', () => {
			const filter = channelFilter('xqc');
			expect(filter(channelSpecificItem)).toBe(true);
		});

		it('should exclude items not matching current channel', () => {
			const filter = channelFilter('forsen');
			expect(filter(channelSpecificItem)).toBe(false);
		});

		it('should handle empty channel name', () => {
			const filter = channelFilter('');
			expect(filter(allChannelsItem)).toBe(true);
			// Empty channel name matches all items (no filtering)
			expect(filter(channelSpecificItem)).toBe(true);
		});

		it('should be case-insensitive', () => {
			const filter = channelFilter('XQC');
			expect(filter(channelSpecificItem)).toBe(true);
		});
	});
});
