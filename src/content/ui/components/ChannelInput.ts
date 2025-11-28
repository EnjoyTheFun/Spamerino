import { TwitchPlatform } from '../../../core/TwitchPlatform';
import { normalizeChannelInput } from '../../utils/copyPasta';

export type ChannelInputOptions = {
	initialChannels?: string[];
	onChange: (channels: string[]) => void;
	onError: (error: string) => void;
};

export class ChannelInput {
	private channels: string[] = [];
	private input: HTMLInputElement;
	private chipContainer: HTMLDivElement;
	private readonly onChange: (channels: string[]) => void;
	private readonly onError: (error: string) => void;

	constructor(
		private readonly documentRef: Document,
		private readonly platform: TwitchPlatform,
		options: ChannelInputOptions
	) {
		this.channels = options.initialChannels?.slice() ?? [];
		this.onChange = options.onChange;
		this.onError = options.onError;
		this.input = documentRef.createElement('input');
		this.chipContainer = documentRef.createElement('div');
		this.chipContainer.className = 'channel-chips';
	}

	getInput(): HTMLInputElement {
		return this.input;
	}

	getChipContainer(): HTMLDivElement {
		return this.chipContainer;
	}

	getChannels(): string[] {
		return [...this.channels];
	}

	setChannels(channels: string[]): void {
		this.channels = channels.slice();
		this.render();
		this.onChange(this.getChannels());
	}

	initialize(): void {
		this.input.value = '';
		this.setupEventListeners();
		this.render();
	}

	private setupEventListeners(): void {
		this.input.addEventListener('keydown', evt => {
			if (evt.key === 'Enter' || evt.key === ',') {
				evt.preventDefault();
				this.commitPendingChannel();
			}
		});

		this.input.addEventListener('blur', () => {
			void this.commitPendingChannel();
		});
	}

	private commitPendingChannel(): boolean {
		const pending = this.input.value.trim();

		if (!pending) return true;

		try {
			const normalized = normalizeChannelInput(pending, this.platform);

			this.input.value = '';

			if (!normalized) return true;
			if (this.channels.includes(normalized)) return true;

			this.channels = [...this.channels, normalized];
			this.render();
			this.onChange(this.getChannels());
			return true;

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Invalid channel';
			this.onError(message);
			return false;
		}
	}

	private render(): void {
		this.chipContainer.textContent = '';

		if (!this.channels.length) {
			const empty = this.documentRef.createElement('span');
			empty.className = 'channel-chip empty';
			empty.textContent = 'Available everywhere';
			this.chipContainer.appendChild(empty);
			return;
		}

		this.channels.forEach(channel => {
			const chip = this.documentRef.createElement('span');
			chip.className = 'channel-chip';
			chip.textContent = channel;

			const removeBtn = this.documentRef.createElement('button');
			removeBtn.type = 'button';
			removeBtn.setAttribute('aria-label', `Remove ${channel}`);
			removeBtn.innerHTML = '&times;';
			removeBtn.addEventListener('click', evt => {
				evt.preventDefault();
				evt.stopPropagation();
				this.channels = this.channels.filter(entry => entry !== channel);
				this.render();
				this.onChange(this.getChannels());
			});

			chip.appendChild(removeBtn);
			this.chipContainer.appendChild(chip);
		});
	}
}
