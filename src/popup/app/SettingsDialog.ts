import LocalStore from '../../core/LocalStore';

const SETTINGS_KEY = 'spamerino-settings';

export type Settings = {
	showToggleIcon: boolean;
};

export class SettingsDialog {
	private readonly dialog: HTMLDialogElement;
	private readonly form: HTMLFormElement;
	private readonly showToggleCheckbox: HTMLInputElement;
	private readonly resetButton: HTMLButtonElement;

	constructor(
		private readonly documentRef: Document,
		private readonly store: LocalStore,
		private readonly onSettingsChanged: (settings: Settings) => void
	) {
		this.dialog = documentRef.getElementById('settingsDialog') as HTMLDialogElement;
		this.form = documentRef.getElementById('settingsForm') as HTMLFormElement;
		this.showToggleCheckbox = documentRef.getElementById('showToggleIcon') as HTMLInputElement;
		this.resetButton = documentRef.getElementById('resetDataBtn') as HTMLButtonElement;
	}

	open() {
		const settings = this.loadSettings();
		this.showToggleCheckbox.checked = settings.showToggleIcon;

		const handleChange = () => {
			const updated: Settings = {
				showToggleIcon: this.showToggleCheckbox.checked,
			};
			this.saveSettings(updated);
			this.onSettingsChanged(updated);
		};

		const handleReset = () => {
			if (!confirm('Are you sure you want to delete all saved messages? This cannot be undone.')) {
				return;
			}
			this.store.save([]);
			alert('All data has been reset.');
			this.dialog.close();
		};

		const cleanup = () => {
			this.showToggleCheckbox.removeEventListener('change', handleChange);
			this.resetButton.removeEventListener('click', handleReset);
			this.dialog.removeEventListener('close', cleanup);
		};

		this.showToggleCheckbox.addEventListener('change', handleChange);
		this.resetButton.addEventListener('click', handleReset);
		this.dialog.addEventListener('close', cleanup, { once: true });
		this.dialog.showModal();
	}

	loadSettings(): Settings {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				return {
					showToggleIcon: typeof parsed.showToggleIcon === 'boolean' ? parsed.showToggleIcon : true,
				};
			}
		} catch { }
		return { showToggleIcon: true };
	}

	private saveSettings(settings: Settings) {
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
		} catch { }
	}
}
