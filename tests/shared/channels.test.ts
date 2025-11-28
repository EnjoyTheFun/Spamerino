import { describe, it, expect } from 'vitest';
import { getChannels } from '../../src/shared/channels';
import { CopyPasta } from '../../src/core/types';

describe('channels utils', () => {
	describe('getChannels', () => {
		it('should return empty array for item with no channels', () => {
			const item: CopyPasta = {
				id: 1,
				content: 'Test',
				tags: [],
				channels: [],
			};

			expect(getChannels(item)).toEqual([]);
		});

		it('should return channels array', () => {
			const item: CopyPasta = {
				id: 1,
				content: 'Test',
				tags: [],
				channels: ['xqc', 'shroud'],
			};

			expect(getChannels(item)).toEqual(['xqc', 'shroud']);
		});

		it('should handle invalid data gracefully', () => {
			const item = {
				id: 1,
				content: 'Test',
				tags: [],
			} as any;

			expect(getChannels(item)).toEqual([]);
		});
	});
});
