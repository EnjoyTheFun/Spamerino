import { Item } from '../../utils/copyPasta';

export class SearchFilter {
	private searchQuery = '';
	private pointer = 0;

	constructor(private items: Item[]) {}

	setSearchQuery(query: string): void {
		this.searchQuery = query;
		this.pointer = 0;
	}

	getSearchQuery(): string {
		return this.searchQuery;
	}

	setItems(items: Item[]): void {
		this.items = items;
	}

	getPointer(): number {
		return this.pointer;
	}

	setPointer(pointer: number): void {
		this.pointer = pointer;
	}

	computeVisibleItems(): Item[] {
		const query = this.searchQuery.trim().toLowerCase();
		if (!query) return [...this.items];

		const tagMatches: Item[] = [];
		const descriptionMatches: Item[] = [];

		this.items.forEach(entry => {
			const tags = entry.tags || [];
			const tagHit = tags.some(tag => tag.toLowerCase().includes(query));
			const descriptionText = entry.content.toLowerCase();
			const descriptionHit = descriptionText.includes(query);

			if (tagHit) {
				tagMatches.push(entry);
			} else if (descriptionHit) {
				descriptionMatches.push(entry);
			}
		});

		return [...tagMatches, ...descriptionMatches];
	}

	recomputeVisible(visible: Item[], preferredId?: number): number {
		if (preferredId) {
			const nextIndex = visible.findIndex(entry => entry.id === preferredId);
			if (nextIndex !== -1) {
				this.pointer = nextIndex;
				return this.pointer;
			}
		}
		this.pointer = visible.length ? Math.min(this.pointer, visible.length - 1) : 0;
		return this.pointer;
	}
}
