import LocalStore from '../../core/LocalStore';
import { CopyPasta } from '../../core/types';

export type ImportExportDeps = {
	documentRef: Document;
	store: LocalStore;
	onImportComplete: () => void;
};

export class ImportExportManager {
	private readonly fileInput: HTMLInputElement;

	constructor(private readonly deps: ImportExportDeps) {
		const input = deps.documentRef.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.hidden = true;
		deps.documentRef.body.appendChild(input);
		this.fileInput = input;
		this.fileInput.addEventListener('change', () => this.handleImportSelection());
	}

	bind(importButton: HTMLElement, exportButton: HTMLElement) {
		importButton.addEventListener('click', () => this.fileInput.click());
		exportButton.addEventListener('click', () => this.exportItems());
	}

	private async handleImportSelection() {
		const file = this.fileInput.files?.[0];

		if (!file) return;

		try {
			const contents = await file.text();
			const parsed = JSON.parse(contents);

			if (!Array.isArray(parsed)) throw new Error('Invalid JSON format');

			const all = this.deps.store.getAll();
			const nextId = (items: CopyPasta[]) => (items.length ? 1 + items.reduce((m, c) => Math.max(m, c.id), 0) : 1);
			const toChannel = (value: any) => {
				if (typeof value !== 'string') return undefined;
				const trimmed = value.trim().replace(/^@/, '').toLowerCase();
				if (!trimmed) return undefined;
				if (!/^[a-z0-9_]+$/.test(trimmed)) return undefined;
				return trimmed;
			};

			const collectChannels = (entry: any) => {
				const set = new Set<string>();
				if (Array.isArray(entry?.channels)) {
					for (const value of entry.channels) {
						const channel = toChannel(value);
						if (channel) set.add(channel);
					}
				}
				const legacy = toChannel(entry?.channel);
				if (legacy) set.add(legacy);
				return Array.from(set);
			};

			for (const entry of parsed) {
				if (!entry) continue;
				const contentSource = [entry.content, entry.description, entry.title].find(
					value => typeof value === 'string' && value.trim()
				) as string | undefined;
				const content = contentSource ? contentSource.trim() : '';
				if (!content) continue;
				const item: CopyPasta = {
					id: typeof entry.id === 'number' ? entry.id : 0,
					content,
					tags: Array.isArray(entry.tags) ? entry.tags.map(String).filter(Boolean) : [],
					channels: collectChannels(entry),
				};

				if (!item.id || all.some(existing => existing.id === item.id)) item.id = nextId(all);
				all.push(item);
			}

			this.deps.store.save(all);
			this.deps.onImportComplete();

		} catch {
			alert('Invalid JSON file');
		} finally {
			this.fileInput.value = '';
		}
	}

	private exportItems() {
		const data = this.deps.store.getAll();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = this.deps.documentRef.createElement('a');
		anchor.href = url;
		anchor.download = 'spamerino-export.json';
		this.deps.documentRef.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	}
}
