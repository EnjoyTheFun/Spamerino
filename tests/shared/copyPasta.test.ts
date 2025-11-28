import { describe, it, expect } from 'vitest';
import { deriveTitle, deriveDescription } from '../../src/shared/copyPasta';

describe('copyPasta helpers', () => {
	describe('deriveTitle', () => {
		it('should return first line as title', () => {
			const content = 'First line\nSecond line\nThird line';
			expect(deriveTitle(content)).toBe('First line');
		});

		it('should truncate long titles', () => {
			const longLine = 'a'.repeat(100);
			const title = deriveTitle(longLine);
			expect(title.length).toBeLessThanOrEqual(60);
			expect(title).toContain('...');
		});

		it('should handle single line content', () => {
			const content = 'Single line message';
			expect(deriveTitle(content)).toBe('Single line message');
		});

		it('should handle empty content', () => {
			expect(deriveTitle('')).toBe('Copypasta');
		});

		it('should trim whitespace', () => {
			const content = '  \n  First line  \n  Second line  ';
			expect(deriveTitle(content)).toBe('First line');
		});
	});

	describe('deriveDescription', () => {
		it('should return truncated preview of content', () => {
			const content = 'First line\nSecond line\nThird line';
			const description = deriveDescription(content);
			expect(description).toContain('First line');
		});

		it('should keep newlines in description', () => {
			const content = 'Line 1\nLine 2\nLine 3';
			const description = deriveDescription(content);
			expect(description).toBe(content); // Short content is preserved as-is
		});

		it('should truncate long content', () => {
			const longContent = 'a'.repeat(200);
			const description = deriveDescription(longContent);
			expect(description.length).toBeLessThanOrEqual(160);
			expect(description).toContain('...');
		});

		it('should handle empty content', () => {
			expect(deriveDescription('')).toBe('Saved message');
		});
	});
});
