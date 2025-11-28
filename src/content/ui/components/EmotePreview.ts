import { EmoteService } from '../../emotes/EmoteService';
import { parseEmotesToHTML } from '../../emotes/emoteParser';

export class EmotePreview {
	private container: HTMLDivElement;
	private contentInput: HTMLTextAreaElement;
	private lastRenderedText: string = '';

	constructor(
		private readonly documentRef: Document,
		private readonly emoteService: EmoteService,
		contentInput: HTMLTextAreaElement
	) {
		this.contentInput = contentInput;
		this.container = documentRef.createElement('div');
		this.container.className = 'emote-preview';
	}

	getContainer(): HTMLDivElement {
		return this.container;
	}

	initialize(): void {
		this.contentInput.addEventListener('input', () => this.update());
		this.update();
	}

	private update(): void {
		const text = this.contentInput.value;

		if (text === this.lastRenderedText) {
			return;
		}

		this.lastRenderedText = text;

		if (!text.trim()) {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = 'block';
		this.container.textContent = '';

		const emotesHTML = parseEmotesToHTML(text, this.emoteService, this.documentRef);
		this.container.appendChild(emotesHTML);
	}
}
