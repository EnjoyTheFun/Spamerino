import Impulse from './Impulse';
import { CopyPasta } from './types';

export const STORAGE_KEY = 'twitch-copy-pasta::copypastas';

function readArray(key: string): any[] {
	try {
		return JSON.parse(localStorage.getItem(key) ?? '[]');
	} catch {
		return [];
	}
}

function cleanChannel(value: any): string | undefined {
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim().toLowerCase();

	if (!trimmed) return undefined;

	if (!/^[a-z0-9_]+$/.test(trimmed)) return undefined;

	return trimmed;
}

function coerceChannels(raw: any): string[] {
	const seen = new Set<string>();
	const append = (val: string | undefined) => {
		if (!val) return;
		if (seen.has(val)) return;
		seen.add(val);
	};

	if (Array.isArray(raw?.channels)) {
		for (const entry of raw.channels) append(cleanChannel(entry));
	}

	append(cleanChannel(raw?.channel));

	return Array.from(seen);
}

function coerceContent(raw: any): { value: string; mutated: boolean } {
	const sources = ['content', 'description', 'title'] as const;

	for (const key of sources) {
		if (typeof raw?.[key] === 'string' && raw[key].trim()) {
			const trimmed = raw[key].trim();
			return { value: trimmed, mutated: key !== 'content' || trimmed !== raw[key] };
		}
	}

	return { value: '', mutated: Boolean(raw?.content || raw?.description || raw?.title) };
}

function coerceTags(raw: any): { value: string[]; mutated: boolean } {
	if (!Array.isArray(raw?.tags)) return { value: [], mutated: Boolean(raw?.tags) };

	const mapped = raw.tags.map((tag: any) => String(tag).trim()).filter(Boolean);
	const mutated = mapped.length !== raw.tags.length || mapped.some((tag: any, idx: number) => tag !== String(raw.tags[idx]).trim());

	return { value: mapped, mutated };
}

function coerceItem(raw: any, idx: number): { item: CopyPasta; mutated: boolean } {
	const fallbackId = typeof raw?.id === 'number' ? raw.id : idx + 1;
	const idMutated = fallbackId !== raw?.id;
	const { value: content, mutated: contentMutated } = coerceContent(raw);
	const { value: tags, mutated: tagsMutated } = coerceTags(raw);
	const channels = coerceChannels(raw);
	const channelsMutated = Boolean(raw?.channel) || (Array.isArray(raw?.channels) && raw.channels.length !== channels.length);
	const extraFields = Boolean(raw?.title || raw?.description);
	return {
		item: { id: fallbackId, content, tags, channels },
		mutated: idMutated || contentMutated || tagsMutated || channelsMutated || extraFields,
	};
}

function normalize(items: any[]): { data: CopyPasta[]; mutated: boolean } {
	let mutated = false;
	const data = items.map((item, idx) => {
		const result = coerceItem(item, idx);
		if (result.mutated) mutated = true;
		return result.item;
	});
	return { data, mutated };
}

export default class LocalStore {
	private readonly impulse: Impulse<CopyPasta[]>;

	constructor() { this.impulse = new Impulse<CopyPasta[]>({ pulseOnDuplicate: true }); }

	private hydrate(): CopyPasta[] {
		const current = readArray(STORAGE_KEY);

		if (current.length) {
			const { data, mutated } = normalize(current);

			if (mutated) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			}

			return data;
		}

		return [];
	}
	getAll(): CopyPasta[] {
		const current = readArray(STORAGE_KEY);

		if (current.length) {
			const { data, mutated } = normalize(current);

			if (mutated) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			}

			return data;
		}

		return this.hydrate();
	}
	items(): Impulse<CopyPasta[]> {
		if (this.impulse.value() === undefined) this.impulse.pulse(this.hydrate());
		return this.impulse;
	}
	private nextId(items: CopyPasta[]): number {
		return items.length ? 1 + items.reduce((m, c) => Math.max(m, c.id), 0) : 1;
	}
	add(cp: CopyPasta): CopyPasta {
		const items = this.impulse.value() ?? this.hydrate();
		const channels = Array.isArray(cp.channels)
			? cp.channels.map(cleanChannel).filter((value): value is string => Boolean(value))
			: [];
		const normalized: CopyPasta = {
			id: this.nextId(items),
			content: (cp.content ?? '').trim(),
			tags: Array.isArray(cp.tags) ? cp.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
			channels,
		};
		items.push(normalized);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
		this.impulse.pulse(items);
		return normalized;
	}
	delete(id: number) {
		const items = this.impulse.value() ?? this.hydrate();
		const i = items.findIndex(cp => cp.id === id);

		if (i === -1) return;

		items.splice(i, 1);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
		this.impulse.pulse(items);
	}
	save(cps: CopyPasta[]) {
		const { data } = normalize(cps);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		this.impulse.pulse(data);
	}
	merge(cps: CopyPasta[]) {
		const items = this.getAll();
		const { data: normalized } = normalize(cps);

		for (let i = 0; i < normalized.length; i++) {
			const entry = normalized[i];
			const index = items.findIndex(cp => cp.id === entry.id);
			if (index === -1) {
				items.push(entry);
				continue;
			}
			entry.id = this.nextId(items);
			items.push(entry);
		}
		this.save(items);
	}
}
