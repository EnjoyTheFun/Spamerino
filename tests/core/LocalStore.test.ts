import { describe, it, expect, beforeEach } from 'vitest';
import LocalStore from '../../src/core/LocalStore';
import { CopyPasta } from '../../src/core/types';

describe('LocalStore', () => {
	let store: LocalStore;

	beforeEach(() => {
		store = new LocalStore();
		localStorage.clear();
	});

	describe('getAll', () => {
		it('should return empty array when no data exists', () => {
			const items = store.getAll();
			expect(items).toEqual([]);
		});

		it('should return stored copypastas', () => {
			const testData: CopyPasta[] = [
				{ id: 1, content: 'Test message', tags: ['test'], channels: [] },
			];
			localStorage.setItem('twitch-copy-pasta::copypastas', JSON.stringify(testData));

			const items = store.getAll();
			expect(items).toEqual(testData);
		});

		it('should normalize legacy data with title/description', () => {
			const legacyData = [
				{ id: 1, title: 'Title', description: 'Description', tags: ['test'], channels: [] },
			];
			localStorage.setItem('twitch-copy-pasta::copypastas', JSON.stringify(legacyData));

			const items = store.getAll();
			// coerceContent checks in order: content, description, title - so description comes first
			expect(items[0].content).toBe('Description');
			expect(items[0]).not.toHaveProperty('title');
			expect(items[0]).not.toHaveProperty('description');
		});
	});

	describe('save', () => {
		it('should save copypastas to localStorage', () => {
			const testData: CopyPasta[] = [
				{ id: 1, content: 'Test', tags: [], channels: [] },
			];

			store.save(testData);

			const saved = JSON.parse(localStorage.getItem('twitch-copy-pasta::copypastas') || '[]');
			expect(saved).toEqual(testData);
		});

		it('should normalize data before saving', () => {
			const dirtyData: any[] = [
				{ id: 1, content: '  Test  ', tags: ['tag', '', 'tag2'], channels: [''] },
			];

			store.save(dirtyData);

			const saved = store.getAll();
			expect(saved[0].content).toBe('Test');
			expect(saved[0].tags).toEqual(['tag', 'tag2']);
			expect(saved[0].channels).toEqual([]);
		});
	});

	describe('add', () => {
		it('should add a new copypasta with auto-generated ID', () => {
			const newItem: CopyPasta = {
				id: 0, // Will be auto-generated
				content: 'New message',
				tags: ['new'],
				channels: [],
			};

			store.add(newItem);

			const items = store.getAll();
			expect(items).toHaveLength(1);
			expect(items[0].id).toBe(1);
			expect(items[0].content).toBe('New message');
		});

		it('should assign incremental IDs', () => {
			store.add({ id: 0, content: 'First', tags: [], channels: [] });
			store.add({ id: 0, content: 'Second', tags: [], channels: [] });

			const items = store.getAll();
			expect(items).toHaveLength(2);
			expect(items[0].id).toBe(1);
			expect(items[1].id).toBe(2);
		});
	});

	describe('delete', () => {
		it('should delete copypasta by ID', () => {
			const testData: CopyPasta[] = [
				{ id: 1, content: 'First', tags: [], channels: [] },
				{ id: 2, content: 'Second', tags: [], channels: [] },
			];
			store.save(testData);

			store.delete(1);

			const items = store.getAll();
			expect(items).toHaveLength(1);
			expect(items[0].id).toBe(2);
		});

		it('should do nothing if ID not found', () => {
			const testData: CopyPasta[] = [
				{ id: 1, content: 'First', tags: [], channels: [] },
			];
			store.save(testData);

			store.delete(999);

			const items = store.getAll();
			expect(items).toHaveLength(1);
		});
	});

	describe('merge', () => {
		it('should add new items without duplicating existing IDs', () => {
			const existing: CopyPasta[] = [
				{ id: 1, content: 'Existing', tags: [], channels: [] },
			];
			store.save(existing);

			const toMerge: CopyPasta[] = [
				{ id: 1, content: 'Duplicate ID', tags: [], channels: [] },
				{ id: 5, content: 'New item', tags: [], channels: [] },
			];

			store.merge(toMerge);

			const items = store.getAll();
			expect(items).toHaveLength(3);

			// Original ID 1 should remain unchanged
			expect(items.find(i => i.id === 1)?.content).toBe('Existing');

			// Duplicate should get new ID
			expect(items.find(i => i.content === 'Duplicate ID')?.id).not.toBe(1);

			// New item should be added
			expect(items.find(i => i.id === 5)?.content).toBe('New item');
		});
	});
});
