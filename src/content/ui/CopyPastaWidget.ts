import LocalStore from '../../core/LocalStore';
import { CopyPasta } from '../../core/types';
import { TwitchPlatform } from '../../core/TwitchPlatform';
import { ROOT_CLASS } from '../constants';
import { channelFilter, Item } from '../utils/copyPasta';
import { calcWidgetPosition, getChatInputRect } from '../utils/dom';
import { ensureWidgetStyles } from './styles';
import { AddDialog, EntryDialogOptions } from './AddDialog';
import { EmoteService } from '../emotes/EmoteService';
import { ClipboardService } from './utilities/ClipboardService';
import { SearchFilter } from './utilities/SearchFilter';
import { DragDropManager } from './utilities/DragDropManager';
import { ListItemRenderer } from './components/ListItemRenderer';

export type WidgetDependencies = {
	documentRef: Document;
	platform: TwitchPlatform;
	store: LocalStore;
	emoteService: EmoteService;
};

type WidgetControls = {
	selectNext: () => void;
	selectPrev: () => void;
	getSelected: () => Item | undefined;
};

type WidgetView = {
	root: HTMLDivElement;
	controls: WidgetControls;
	focusSearch: () => void;
};

export class CopyPastaWidget {
	private readonly addDialog: AddDialog;
	private readonly clipboardService: ClipboardService;
	private root: HTMLElement | null = null;
	private controls: WidgetControls | null = null;
	private pointerHandler?: (event: Event) => void;
	private keyHandler?: (event: KeyboardEvent) => void;
	private dialogOpen = false;

	constructor(private readonly deps: WidgetDependencies) {
		this.addDialog = new AddDialog(deps.documentRef, deps.store, deps.platform, deps.emoteService);
		this.clipboardService = new ClipboardService(deps.documentRef);
	}

	open() {
		if (this.root) return;

		const { documentRef, platform, store } = this.deps;

		ensureWidgetStyles(documentRef);

		const items = store.getAll();
		const channel = platform.getChannel(location.href) || '';
		const filtered = items.filter(channelFilter(channel));
		const view = this.buildWidget(filtered, channel);

		this.root = view.root;
		this.controls = view.controls;
		documentRef.body.appendChild(view.root);
		view.focusSearch();
		this.attachGlobalHandlers();
	}

	close() {
		if (!this.root) return;

		this.pointerHandler && window.removeEventListener('pointerdown', this.pointerHandler);
		this.keyHandler && window.removeEventListener('keydown', this.keyHandler, true);
		this.root.remove();
		this.root = null;
		this.controls = null;
		this.pointerHandler = undefined;
		this.keyHandler = undefined;
	}

	toggle() {
		if (this.root) this.close();
		else this.open();
	}

	pasteSelectedAndClose() {
		const selected = this.controls?.getSelected();
		if (!selected) return;
		this.pasteItemIntoChat(selected);
		this.close();
	}

	private attachGlobalHandlers() {
		if (!this.root) return;

		this.pointerHandler = evt => {
			if (this.dialogOpen) return;

			const target = evt.target as HTMLElement | null;

			if (target && this.root && this.root.contains(target)) return;

			window.removeEventListener('pointerdown', this.pointerHandler!);
			window.removeEventListener('keydown', this.keyHandler!, true);
			this.close();
		};
		this.keyHandler = evt => {
			if (this.dialogOpen) return;
			if (!this.root) return;
			if (evt.key === 'Escape') {
				evt.preventDefault();
				evt.stopPropagation();
				this.close();
				return;
			}
			if (evt.key === 'ArrowDown') {
				evt.preventDefault();
				evt.stopPropagation();
				this.controls?.selectNext();
				return;
			}
			if (evt.key === 'ArrowUp') {
				evt.preventDefault();
				evt.stopPropagation();
				this.controls?.selectPrev();
				return;
			}
			if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar' || evt.key === 'Space') {
				evt.preventDefault();
				evt.stopPropagation();
				this.pasteSelectedAndClose();
			}
		};
		window.addEventListener('pointerdown', this.pointerHandler);
		window.addEventListener('keydown', this.keyHandler, true);
	}

	private buildWidget(initialItems: Item[], channel: string): WidgetView {
		const { platform } = this.deps;
		const documentRef = this.deps.documentRef;
		const scopedFilter = channelFilter(channel);
		const items = [...initialItems];

		const searchFilter = new SearchFilter(items);
		const listItemRenderer = new ListItemRenderer(documentRef, this.deps.emoteService, {
			onCopy: async (item, btn) => {
				const success = await this.clipboardService.copyToClipboard(item.content.trim());
				this.clipboardService.flashCopyButton(btn, success);
			},
			onEdit: (item) => {
				this.openEntryDialog({
					initialItem: item,
					onSaved: (updated: CopyPasta) => {
						if (!scopedFilter(updated)) {
							refreshFromStore();
							return;
						}
						const idx = items.findIndex(entry => entry.id === updated.id);
						if (idx > -1) {
							items[idx] = updated;
						}
						searchFilter.setItems(items);
						visible = searchFilter.computeVisibleItems();
						searchFilter.recomputeVisible(visible, updated.id);
						render();
					},
				});
			},
			onDelete: (item) => {
				this.deps.store.delete(item.id);
				const idx = items.findIndex(entry => entry.id === item.id);

				if (idx > -1) {
					items.splice(idx, 1);
					searchFilter.setItems(items);
					visible = searchFilter.computeVisibleItems();
					searchFilter.recomputeVisible(visible);
				}

				render();
			},
			onSelect: (index) => {
				if (dragDropManager.isDragging()) return;
				if (searchFilter.getPointer() === index) return;
				searchFilter.setPointer(index);
				select();
			},
			onPaste: (item) => {
				if (dragDropManager.isDragging()) return;
				this.pasteItemIntoChat(item);
				this.close();
			},
			onDragStart: (evt, index, handle) => {
				dragDropManager.startDrag(evt, index, handle, rows);
			}
		});

		let visible = searchFilter.computeVisibleItems();
		const rect = getChatInputRect(platform);
		const root = documentRef.createElement('div');
		root.className = ROOT_CLASS;

		const persistChannelOrder = () => {
			const allItems = this.deps.store.getAll();
			const replacementQueue = [...items];
			const nextAll = allItems.map(entry => {
				if (!scopedFilter(entry)) return entry;
				const replacement = replacementQueue.shift();
				return replacement ?? entry;
			});
			this.deps.store.save(nextAll);
		};

		const dragDropManager = new DragDropManager(root, {
			onReorder: (sourceIndex, targetIndex) => {
				const [moved] = items.splice(sourceIndex, 1);
				items.splice(targetIndex, 0, moved);
				searchFilter.setItems(items);
				visible = searchFilter.computeVisibleItems();
				searchFilter.recomputeVisible(visible, moved.id);
				render();
				persistChannelOrder();
			},
			onDragStart: () => { },
			onDragEnd: () => { }
		});

		const header = documentRef.createElement('header');
		const details = documentRef.createElement('div');
		details.className = 'details';
		const title = documentRef.createElement('span');
		title.textContent = 'Spamerino';
		const subtitle = documentRef.createElement('span');
		subtitle.className = 'subtitle';
		subtitle.textContent = 'by EnjoyTheFun';
		details.append(title, subtitle);

		const actions = documentRef.createElement('div');
		actions.className = 'actions';

		const refreshFromStore = () => {
			const next = this.deps.store.getAll().filter(scopedFilter);
			items.splice(0, items.length, ...next);
			searchFilter.setItems(items);
			visible = searchFilter.computeVisibleItems();
			searchFilter.recomputeVisible(visible);
			render();
		};

		const addBtn = this.createActionButton({
			svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4v7H4v2h7v7h2v-7h7v-2h-7V4z"/></svg>',
			label: 'Add',
			onClick: () =>
				this.openEntryDialog({
					channelSuggestion: channel || '',
					onSaved: (item: CopyPasta) => {
						if (!scopedFilter(item)) return;
						items.unshift(item);
						searchFilter.setItems(items);
						visible = searchFilter.computeVisibleItems();
						searchFilter.recomputeVisible(visible, item.id);
						render();
					},
				}),
		});

		const hiddenImport = documentRef.createElement('input');
		hiddenImport.type = 'file';
		hiddenImport.accept = 'application/json,.json';
		hiddenImport.style.display = 'none';
		hiddenImport.addEventListener('change', async () => {
			const file = hiddenImport.files?.[0];

			if (!file) return;

			try {
				const text = await file.text();
				const parsed = JSON.parse(text);
				const payload = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;

				if (!payload) throw new Error('Expected an array of copypastas');

				this.deps.store.merge(payload as CopyPasta[]);

				refreshFromStore();
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Unable to import copypastas';
				window.alert(message);
			} finally {
				hiddenImport.value = '';
			}
		});

		const importBtn = this.createActionButton({
			svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14v-2H5v2zm7-18-5.5 6.5h4v6h3v-6h4L12 2z"/></svg>',
			label: 'Import',
			onClick: () => hiddenImport.click(),
		});

		const exportBtn = this.createActionButton({
			svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9v10H5V9H3v12h18V9h-2zM13 3h-2v7H7l5 5 5-5h-4z"/></svg>',
			label: 'Export',
			onClick: () => this.exportCopypastas(),
		});

		const closeBtn = this.createActionButton({
			svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"/></svg>',
			label: 'Close',
			onClick: () => this.close(),
		});

		actions.append(addBtn, importBtn, exportBtn, closeBtn, hiddenImport);
		header.append(details, actions);

		const searchBar = documentRef.createElement('div');
		searchBar.className = 'search-bar';
		const searchInput = documentRef.createElement('input');
		searchInput.type = 'search';
		searchInput.placeholder = 'Search tags or message';
		searchInput.setAttribute('aria-label', 'Search copypastas');
		searchInput.className = 'search-input';
		searchInput.value = searchFilter.getSearchQuery();
		searchInput.addEventListener('input', () => {
			searchFilter.setSearchQuery(searchInput.value);
			searchFilter.setPointer(0);
			visible = searchFilter.computeVisibleItems();
			searchFilter.recomputeVisible(visible);
			render();
		});
		searchInput.addEventListener('keydown', evt => evt.stopPropagation(), true);
		searchBar.appendChild(searchInput);

		const listEl = documentRef.createElement('div');
		listEl.className = 'list';
		let rows: HTMLDivElement[] = [];

		const focusSearch = () => {
			if (!searchInput.isConnected) return;
			requestAnimationFrame(() => searchInput.focus());
		};

		const render = () => {
			listEl.textContent = '';

			if (!visible.length) {
				searchFilter.setPointer(0);
				const empty = documentRef.createElement('p');
				empty.className = 'desc';
				empty.textContent = searchFilter.getSearchQuery().trim()
					? 'No copypastas match your search.'
					: 'No copypastas yet. Use + Add to create one.';
				listEl.appendChild(empty);
				rows = [];
				return;
			}

			const pointer = searchFilter.getPointer();
			const clampedPointer = Math.min(pointer, Math.max(0, visible.length - 1));
			searchFilter.setPointer(clampedPointer);

			rows = visible.map((item, index) =>
				listItemRenderer.createListItem(item, index, searchFilter.getSearchQuery(), visible.length)
			);

			rows.forEach(row => listEl.appendChild(row));
			select();
		};

		const select = () => {
			const pointer = searchFilter.getPointer();
			rows.forEach((row, idx) => row.classList.toggle('selected', idx === pointer));
			const selected = rows[pointer];
			if (selected) selected.scrollIntoView({ block: 'nearest' });
		};

		const selectNext = () => {
			if (!rows.length) return;
			const newPointer = (searchFilter.getPointer() + 1) % rows.length;
			searchFilter.setPointer(newPointer);
			select();
		};

		const selectPrev = () => {
			if (!rows.length) return;
			const current = searchFilter.getPointer();
			const newPointer = (current - 1 + rows.length) % rows.length;
			searchFilter.setPointer(newPointer);
			select();
		};

		const getSelected = () => {
			return rows.length ? visible[searchFilter.getPointer()] : undefined;
		};

		render();
		root.append(header, searchBar, listEl);

		if (rect) {
			const pos = calcWidgetPosition(rect);
			root.style.bottom = pos.bottom;
			root.style.right = pos.right;
		} else {
			root.style.bottom = '20px';
			root.style.right = '20px';
		}

		return { root, controls: { selectNext, selectPrev, getSelected }, focusSearch };
	}

	private openEntryDialog(options: Omit<EntryDialogOptions, 'onClose'>) {
		if (this.dialogOpen) return;
		this.dialogOpen = true;
		this.addDialog.open({
			...options,
			onClose: () => {
				this.dialogOpen = false;
			},
		});
	}

	private createActionButton({ svg, label, onClick }: { svg: string; label: string; onClick: () => void }) {
		const btn = this.deps.documentRef.createElement('button');
		btn.type = 'button';
		btn.innerHTML = svg;
		btn.title = label;
		btn.setAttribute('aria-label', label);
		btn.addEventListener('click', evt => {
			evt.stopPropagation();
			onClick();
		});
		return btn;
	}

	private exportCopypastas() {
		const data = this.deps.store.getAll();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = this.deps.documentRef.createElement('a');
		anchor.href = url;
		anchor.download = 'spamerino-export.json';
		this.deps.documentRef.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 500);
	}

	private pasteItemIntoChat(item: CopyPasta) {
		const text = item.content.trim();
		if (!text) return;
		this.deps.platform.setChatInput(text);
		this.refocusChatInput();
	}

	private refocusChatInput() {
		const win = this.deps.documentRef.defaultView;
		const schedule = win?.requestAnimationFrame ?? win?.setTimeout;
		const runner = () => {
			const target = this.deps.platform.getPromptElement() || this.deps.platform.getChatInput();
			if (!target) return;
			target.focus();
			if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
				const len = target.value.length;
				target.setSelectionRange?.(len, len);
				return;
			}
			if (target.isContentEditable) {
				const selection = this.deps.documentRef.getSelection();
				if (!selection) return;
				selection.removeAllRanges();
				const range = this.deps.documentRef.createRange();
				range.selectNodeContents(target);
				range.collapse(false);
				selection.addRange(range);
			}
		};
		if (typeof schedule === 'function') schedule.call(win, runner);
		else runner();
	}
}
