import { Item } from '../../utils/copyPasta';

export type DragState = {
	sourceIndex: number;
	insertIndex: number;
	pointerId: number;
	handle: HTMLButtonElement;
};

export type DragDropCallbacks = {
	onReorder: (sourceIndex: number, targetIndex: number) => void;
	onDragStart: () => void;
	onDragEnd: () => void;
};

export class DragDropManager {
	private dragState: DragState | null = null;
	private dropIndicatorIndex = -1;
	private dropAfterLast = false;

	constructor(
		private readonly root: HTMLElement,
		private readonly callbacks: DragDropCallbacks
	) {}

	startDrag(evt: PointerEvent, sourceIndex: number, handle: HTMLButtonElement, rows: HTMLDivElement[]): void {
		if (evt.button !== 0) return;
		if (this.dragState || rows.length < 2) return;

		evt.preventDefault();
		evt.stopPropagation();

		this.dragState = {
			sourceIndex,
			insertIndex: sourceIndex,
			pointerId: evt.pointerId,
			handle
		};

		handle.setPointerCapture?.(evt.pointerId);
		this.root.classList.add('dragging');
		rows[sourceIndex]?.classList.add('drag-source');
		this.setDropIndicator(sourceIndex, rows);

		this.callbacks.onDragStart();

		const onMove = (e: PointerEvent) => this.onDragMove(e, rows);
		const onUp = (e: PointerEvent) => this.handlePointerUp(e, rows, onMove, onCancel);
		const onCancel = (e: PointerEvent) => this.handlePointerCancel(e, rows, onMove, onUp);

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, true);
		window.addEventListener('pointercancel', onCancel, true);
	}

	private onDragMove(evt: PointerEvent, rows: HTMLDivElement[]): void {
		if (!this.dragState) return;
		evt.preventDefault();

		const insertIndex = this.computeInsertIndex(evt.clientY, rows);
		this.dragState.insertIndex = insertIndex;
		this.setDropIndicator(insertIndex, rows);
	}

	private handlePointerUp(
		evt: PointerEvent,
		rows: HTMLDivElement[],
		onMove: (e: PointerEvent) => void,
		onCancel: (e: PointerEvent) => void
	): void {
		if (!this.dragState || evt.pointerId !== this.dragState.pointerId) return;
		evt.preventDefault();
		this.teardownDrag(true, rows, onMove, onCancel);
	}

	private handlePointerCancel(
		evt: PointerEvent,
		rows: HTMLDivElement[],
		onMove: (e: PointerEvent) => void,
		onUp: (e: PointerEvent) => void
	): void {
		if (!this.dragState || evt.pointerId !== this.dragState.pointerId) return;
		evt.preventDefault();
		this.teardownDrag(false, rows, onMove, onUp);
	}

	private teardownDrag(
		commit: boolean,
		rows: HTMLDivElement[],
		onMove: (e: PointerEvent) => void,
		onOther: (e: PointerEvent) => void
	): void {
		if (!this.dragState) return;

		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onOther, true);
		window.removeEventListener('pointercancel', onOther, true);
		this.dragState.handle.releasePointerCapture?.(this.dragState.pointerId);

		const currentState = this.dragState;
		this.dragState = null;
		this.root.classList.remove('dragging');
		this.clearDropIndicator(rows);

		this.callbacks.onDragEnd();

		if (commit) {
			this.applyReorder(currentState);
		}
	}

	private applyReorder(state: DragState): void {
		const { sourceIndex } = state;
		let targetIndex = state.insertIndex;

		if (targetIndex > sourceIndex) {
			targetIndex -= 1;
		}

		if (targetIndex !== sourceIndex) {
			this.callbacks.onReorder(sourceIndex, targetIndex);
		}
	}

	private computeInsertIndex(clientY: number, rows: HTMLDivElement[]): number {
		for (let i = 0; i < rows.length; i++) {
			const rect = rows[i].getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			if (clientY < midpoint) return i;
		}
		return rows.length;
	}

	private setDropIndicator(insertIndex: number, rows: HTMLDivElement[]): void {
		this.dropAfterLast = insertIndex >= rows.length;
		this.dropIndicatorIndex = this.dropAfterLast ? -1 : insertIndex;

		rows.forEach((row, idx) => {
			row.classList.toggle('drop-indicator', idx === this.dropIndicatorIndex);
		});

		this.root.querySelector('.list')?.classList.toggle('drop-after-last', this.dropAfterLast);
	}

	private clearDropIndicator(rows: HTMLDivElement[]): void {
		this.dropIndicatorIndex = -1;
		this.dropAfterLast = false;
		rows.forEach(row => row.classList.remove('drop-indicator', 'drag-source'));
		this.root.querySelector('.list')?.classList.remove('drop-after-last');
	}

	isDragging(): boolean {
		return this.dragState !== null;
	}
}
