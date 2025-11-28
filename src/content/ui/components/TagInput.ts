export type TagInputOptions = {
	initialTags?: string[];
	onChange: (tags: string[]) => void;
};

export class TagInput {
	private tags: string[] = [];
	private input: HTMLInputElement;
	private chipContainer: HTMLDivElement;
	private readonly onChange: (tags: string[]) => void;

	constructor(
		private readonly documentRef: Document,
		options: TagInputOptions
	) {
		this.tags = options.initialTags?.slice() ?? [];
		this.onChange = options.onChange;
		this.input = documentRef.createElement('input');
		this.chipContainer = documentRef.createElement('div');
		this.chipContainer.className = 'tag-chips';
	}

	getInput(): HTMLInputElement {
		return this.input;
	}

	getChipContainer(): HTMLDivElement {
		return this.chipContainer;
	}

	getTags(): string[] {
		return [...this.tags];
	}

	setTags(tags: string[]): void {
		this.tags = tags.slice();
		this.render();
		this.onChange(this.getTags());
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
				this.commitPendingTag();
			}
		});

		this.input.addEventListener('blur', () => {
			void this.commitPendingTag();
		});
	}

	private commitPendingTag(): boolean {
		const pending = this.input.value.trim();
		if (!pending) return true;

		this.input.value = '';
		let changed = false;

		pending
			.split(/[,]+/)
			.map(part => part.trim())
			.filter(Boolean)
			.forEach(raw => {
				const normalized = raw.replace(/^#/, '').trim();
				if (!normalized) return;
				if (this.tags.includes(normalized)) return;
				this.tags = [...this.tags, normalized];
				changed = true;
			});

		if (changed) {
			this.render();
			this.onChange(this.getTags());
		}
		return true;
	}

	private render(): void {
		this.chipContainer.textContent = '';

		if (!this.tags.length) {
			const empty = this.documentRef.createElement('span');
			empty.className = 'tag-chip empty';
			empty.textContent = 'No tags';
			this.chipContainer.appendChild(empty);
			return;
		}

		this.tags.forEach(tag => {
			const chip = this.documentRef.createElement('span');
			chip.className = 'tag-chip';
			chip.textContent = tag;

			const removeBtn = this.documentRef.createElement('button');
			removeBtn.type = 'button';
			removeBtn.setAttribute('aria-label', `Remove ${tag}`);
			removeBtn.innerHTML = '&times;';
			removeBtn.addEventListener('click', evt => {
				evt.preventDefault();
				evt.stopPropagation();
				this.tags = this.tags.filter(entry => entry !== tag);
				this.render();
				this.onChange(this.getTags());
			});

			chip.appendChild(removeBtn);
			this.chipContainer.appendChild(chip);
		});
	}
}
