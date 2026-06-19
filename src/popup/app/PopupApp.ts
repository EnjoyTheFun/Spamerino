import LocalStore from '../../core/LocalStore';
import { extensionApi, MESSAGE_PREFIX } from '../../shared/runtime';
import { loadSettingsAsync, saveSettings, Settings } from '../../shared/settings';

export class PopupApp {
	private readonly showToggleCheckbox: HTMLInputElement;
	private readonly duplicateBypassCheckbox: HTMLInputElement;
	private readonly visibilityBypassCheckbox: HTMLInputElement;
	private readonly resetButton: HTMLButtonElement;

	constructor(private readonly documentRef: Document, private readonly store: LocalStore) {
		this.showToggleCheckbox = documentRef.getElementById('showToggleIcon') as HTMLInputElement;
		this.duplicateBypassCheckbox = documentRef.getElementById('enableDuplicateBypass') as HTMLInputElement;
		this.visibilityBypassCheckbox = documentRef.getElementById('enableVisibilityBypass') as HTMLInputElement;
		this.resetButton = documentRef.getElementById('resetDataBtn') as HTMLButtonElement;
	}

	async init() {
		const settings = await loadSettingsAsync();
		this.showToggleCheckbox.checked = settings.showToggleIcon;
		this.duplicateBypassCheckbox.checked = settings.enableDuplicateBypass;
		this.visibilityBypassCheckbox.checked = settings.enableVisibilityBypass;

		this.showToggleCheckbox.addEventListener('change', () => {
			const updated: Settings = {
				showToggleIcon: this.showToggleCheckbox.checked,
				enableDuplicateBypass: this.duplicateBypassCheckbox.checked,
				enableVisibilityBypass: this.visibilityBypassCheckbox.checked,
			};
			saveSettings(updated);
			this.notifySettingsChanged(updated);
		});

		this.duplicateBypassCheckbox.addEventListener('change', () => {
			const updated: Settings = {
				showToggleIcon: this.showToggleCheckbox.checked,
				enableDuplicateBypass: this.duplicateBypassCheckbox.checked,
				enableVisibilityBypass: this.visibilityBypassCheckbox.checked,
			};
			saveSettings(updated);
			this.notifySettingsChanged(updated);
		});

		this.visibilityBypassCheckbox.addEventListener('change', () => {
			const updated: Settings = {
				showToggleIcon: this.showToggleCheckbox.checked,
				enableDuplicateBypass: this.duplicateBypassCheckbox.checked,
				enableVisibilityBypass: this.visibilityBypassCheckbox.checked,
			};
			saveSettings(updated);
			this.notifySettingsChanged(updated);
		});

		this.resetButton.addEventListener('click', () => {
			if (!confirm('Are you sure you want to delete all saved copypastas? This cannot be undone.')) {
				return;
			}
			this.store.save([]);
			this.notifyDataReset();
			alert('All data has been reset.');
		});
	}

	private notifySettingsChanged(settings: Settings) {
		void extensionApi.tabs.query({}, (tabs: any[]) => {
			for (const tab of tabs) {
				if (tab?.id && tab.url?.includes('twitch.tv')) {
					this.persistSettingsToTwitchTab(tab.id, settings);
					extensionApi.tabs.sendMessage(tab.id, {
						type: `${MESSAGE_PREFIX}/settings-changed`,
						settings,
					}).catch(() => { });
				}
			}
		});
	}

	private persistSettingsToTwitchTab(tabId: number, settings: Settings) {
		try {
			void extensionApi.scripting.executeScript({
				target: { tabId },
				func: (settingsJson: string) => {
					try {
						localStorage.setItem('spamerino-settings', settingsJson);
					} catch { }
				},
				args: [JSON.stringify(settings)],
			});
		} catch { }
	}

	private notifyDataReset() {
		void extensionApi.tabs.query({}, (tabs: any[]) => {
			for (const tab of tabs) {
				if (tab?.id && tab.url?.includes('twitch.tv')) {
					extensionApi.tabs.sendMessage(tab.id, {
						type: `${MESSAGE_PREFIX}/data-reset`,
					}).catch(() => { });
				}
			}
		});
	}
}
