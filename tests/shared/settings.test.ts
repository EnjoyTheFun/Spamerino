import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings } from '../../src/shared/settings';

describe('Settings', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('loadSettings', () => {
		it('should return default settings when none exist', () => {
			const settings = loadSettings();
			expect(settings).toEqual({ showToggleIcon: true, enableDuplicateBypass: false, enableVisibilityBypass: false });
		});

		it('should load settings from localStorage', () => {
			localStorage.setItem('spamerino-settings', JSON.stringify({ showToggleIcon: false }));

			const settings = loadSettings();
			expect(settings.showToggleIcon).toBe(false);
			expect(settings.enableDuplicateBypass).toBe(false);
			expect(settings.enableVisibilityBypass).toBe(false);
		});

		it('should handle invalid JSON gracefully', () => {
			localStorage.setItem('spamerino-settings', 'invalid json');

			const settings = loadSettings();
			expect(settings).toEqual({ showToggleIcon: true, enableDuplicateBypass: false, enableVisibilityBypass: false });
		});

		it('should validate boolean type', () => {
			localStorage.setItem('spamerino-settings', JSON.stringify({ showToggleIcon: 'not-a-boolean', enableDuplicateBypass: 'nope' }));

			const settings = loadSettings();
			expect(settings.showToggleIcon).toBe(true);
			expect(settings.enableDuplicateBypass).toBe(false);
			expect(settings.enableVisibilityBypass).toBe(false);
		});
	});

	describe('saveSettings', () => {
		it('should save settings to localStorage', () => {
			saveSettings({ showToggleIcon: false, enableDuplicateBypass: true, enableVisibilityBypass: true });

			const saved = JSON.parse(localStorage.getItem('spamerino-settings') || '{}');
			expect(saved.showToggleIcon).toBe(false);
			expect(saved.enableDuplicateBypass).toBe(true);
			expect(saved.enableVisibilityBypass).toBe(true);
		});

		it('should update existing settings', () => {
			saveSettings({ showToggleIcon: true, enableDuplicateBypass: false, enableVisibilityBypass: false });
			saveSettings({ showToggleIcon: false, enableDuplicateBypass: true, enableVisibilityBypass: true });

			const saved = JSON.parse(localStorage.getItem('spamerino-settings') || '{}');
			expect(saved.showToggleIcon).toBe(false);
			expect(saved.enableDuplicateBypass).toBe(true);
			expect(saved.enableVisibilityBypass).toBe(true);
		});
	});
});
