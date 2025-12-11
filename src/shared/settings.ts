import { extensionApi } from './runtime';

const SETTINGS_KEY = 'spamerino-settings';

export type Settings = {
	showToggleIcon: boolean;
	enableDuplicateBypass: boolean;
};

const DEFAULT_SETTINGS: Settings = { showToggleIcon: true, enableDuplicateBypass: false };

export function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);

		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				showToggleIcon: typeof parsed.showToggleIcon === 'boolean' ? parsed.showToggleIcon : true,
				enableDuplicateBypass: typeof parsed.enableDuplicateBypass === 'boolean' ? parsed.enableDuplicateBypass : false,
			};
		}

	} catch { }

	return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
	const json = JSON.stringify(settings);

	try {
		localStorage.setItem(SETTINGS_KEY, json);
	} catch { }
	try {
		extensionApi.storage.local.set({ [SETTINGS_KEY]: settings });
	} catch { }
}

export async function loadSettingsAsync(): Promise<Settings> {
	try {

		const result = await extensionApi.storage.local.get(SETTINGS_KEY);

		if (result && result[SETTINGS_KEY]) {
			const parsed = result[SETTINGS_KEY];
			const settings = {
				showToggleIcon: typeof parsed.showToggleIcon === 'boolean' ? parsed.showToggleIcon : true,
				enableDuplicateBypass: typeof parsed.enableDuplicateBypass === 'boolean' ? parsed.enableDuplicateBypass : false,
			};
			try {
				localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			} catch { }
			return settings;
		}

	} catch { }

	return DEFAULT_SETTINGS;
}
