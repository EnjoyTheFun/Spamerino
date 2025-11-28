import { CopyPasta } from '../../../core/types';
import { Item } from '../../utils/copyPasta';
import { getChannels } from '../../../shared/channels';
import { deriveDescription } from '../../../shared/copyPasta';
import { EmoteService } from '../../emotes/EmoteService';
import { parseEmotesToHTML } from '../../emotes/emoteParser';

export type ListItemCallbacks = {
	onCopy: (item: Item, btn: HTMLButtonElement) => void;
	onEdit: (item: Item) => void;
	onDelete: (item: Item) => void;
	onSelect: (index: number) => void;
	onPaste: (item: Item) => void;
	onDragStart: (evt: PointerEvent, index: number, handle: HTMLButtonElement) => void;
};

export class ListItemRenderer {
	constructor(
		private readonly documentRef: Document,
		private readonly emoteService: EmoteService,
		private readonly callbacks: ListItemCallbacks
	) { }

	createListItem(item: Item, index: number, searchQuery: string, visibleLength: number): HTMLDivElement {
		const row = this.documentRef.createElement('div');
		row.className = 'item';

		const dragBtn = this.createDragButton(index, searchQuery, visibleLength);
		const bodyWrapper = this.createItemBody(item);
		const copyColumn = this.createCopyColumn(item, index);
		const actionsColumn = this.createActionsColumn(item, index);

		row.append(dragBtn, bodyWrapper, copyColumn, actionsColumn);

		row.addEventListener('pointerenter', () => {
			this.callbacks.onSelect(index);
		});

		row.addEventListener('pointerdown', () => {
			this.callbacks.onSelect(index);
			this.callbacks.onPaste(item);
		});

		return row;
	}

	private createDragButton(index: number, searchQuery: string, visibleLength: number): HTMLButtonElement {
		const dragBtn = this.documentRef.createElement('button');
		dragBtn.type = 'button';
		dragBtn.className = 'drag-handle';
		dragBtn.innerHTML =
			'<svg viewBox="0 0 20 24" aria-hidden="true" focusable="false">' +
			'<circle cx="7" cy="5" r="1.8" fill="currentColor" />' +
			'<circle cx="13" cy="5" r="1.8" fill="currentColor" />' +
			'<circle cx="7" cy="12" r="1.8" fill="currentColor" />' +
			'<circle cx="13" cy="12" r="1.8" fill="currentColor" />' +
			'<circle cx="7" cy="19" r="1.8" fill="currentColor" />' +
			'<circle cx="13" cy="19" r="1.8" fill="currentColor" />' +
			'</svg>';
		dragBtn.setAttribute('aria-label', 'Reorder entry');

		if (searchQuery.trim() || visibleLength < 2) {
			dragBtn.disabled = true;
		}

		dragBtn.addEventListener('pointerdown', evt => {
			if (dragBtn.disabled) return;
			this.callbacks.onDragStart(evt, index, dragBtn);
		});

		dragBtn.addEventListener('click', evt => evt.preventDefault());

		return dragBtn;
	}

	private createItemBody(item: Item): HTMLDivElement {
		const textValue = deriveDescription(item.content);
		const message = this.documentRef.createElement('p');
		message.className = 'message';
		const emotesHTML = parseEmotesToHTML(textValue, this.emoteService, this.documentRef);
		message.appendChild(emotesHTML);
		message.title = item.content.trim();

		const meta = this.documentRef.createElement('div');
		meta.className = 'meta';

		if (item.tags.length) {
			item.tags.forEach((tag: string) => {
				const chip = this.documentRef.createElement('span');
				chip.className = 'tag';
				chip.textContent = `#${tag}`;
				meta.appendChild(chip);
			});
		}

		const channels = getChannels(item);
		if (channels.length) {
			channels.forEach(channelName => {
				const chip = this.documentRef.createElement('span');
				chip.className = 'channel';
				chip.textContent = channelName;
				meta.appendChild(chip);
			});
		}

		const bodyWrapper = this.documentRef.createElement('div');
		bodyWrapper.className = 'item-body';
		bodyWrapper.append(message);
		if (meta.childElementCount) bodyWrapper.append(meta);

		return bodyWrapper;
	}

	private createCopyColumn(item: Item, index: number): HTMLDivElement {
		const copyBtn = this.makeIconButton(
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg>',
			'Copy to clipboard',
			'copy'
		);

		copyBtn.addEventListener('click', evt => {
			evt.stopPropagation();
			this.callbacks.onCopy(item, copyBtn);
		});

		const copyColumn = this.documentRef.createElement('div');
		copyColumn.className = 'item-copy-column';
		copyColumn.append(copyBtn);

		return copyColumn;
	}

	private createActionsColumn(item: Item, index: number): HTMLDivElement {
		const editBtn = this.makeIconButton(
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm15.71-9.04c.39-.39.39-1.02 0-1.41l-2.54-2.54a.9959.9959 0 0 0-1.41 0L12.5 5.46l3.75 3.75 2.46-2.46z"/></svg>',
			'Edit',
			'edit'
		);

		editBtn.addEventListener('click', evt => {
			evt.stopPropagation();
			this.callbacks.onEdit(item);
		});

		const deleteBtn = this.makeIconButton(
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12v12c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V7zm3-4h6l1 1h5v2H3V4h5l1-1z"/></svg>',
			'Delete',
			'delete'
		);

		deleteBtn.addEventListener('click', evt => {
			evt.stopPropagation();
			this.callbacks.onDelete(item);
		});

		const actionsColumn = this.documentRef.createElement('div');
		actionsColumn.className = 'item-actions';
		actionsColumn.append(editBtn, deleteBtn);

		return actionsColumn;
	}

	private makeIconButton(iconSvg: string, label: string, extraClass: string): HTMLButtonElement {
		const btn = this.documentRef.createElement('button');
		btn.type = 'button';
		btn.innerHTML = iconSvg;
		btn.title = label;
		btn.setAttribute('aria-label', label);
		btn.classList.add(extraClass);
		btn.dataset.originalLabel = label;
		btn.addEventListener('pointerdown', evt => evt.stopPropagation());
		return btn;
	}
}
