import LocalStore from '../../core/LocalStore';
import { extensionApi, MESSAGE_PREFIX } from '../../shared/runtime';
import { loadSettingsAsync, saveSettings, Settings } from '../../shared/settings';

export class PopupApp {
	private readonly showToggleCheckbox: HTMLInputElement;
	private readonly resetButton: HTMLButtonElement;

	constructor(private readonly documentRef: Document, private readonly store: LocalStore) {
		this.showToggleCheckbox = documentRef.getElementById('showToggleIcon') as HTMLInputElement;
		this.resetButton = documentRef.getElementById('resetDataBtn') as HTMLButtonElement;
	}

	async init() {
		const settings = await loadSettingsAsync();
		this.showToggleCheckbox.checked = settings.showToggleIcon;

		this.showToggleCheckbox.addEventListener('change', () => {
			const updated: Settings = {
				showToggleIcon: this.showToggleCheckbox.checked,
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
		void extensionApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
			for (const tab of tabs) {
				if (tab?.id && tab.url?.includes('twitch.tv')) {
					extensionApi.tabs.sendMessage(tab.id, {
						type: `${MESSAGE_PREFIX}/settings-changed`,
						settings,
					}).catch(() => { });
				}
			}
		});
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
