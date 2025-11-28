export class ClipboardService {
	constructor(private readonly documentRef: Document) { }

	async copyToClipboard(text: string): Promise<boolean> {
		if (!text.trim()) return false;
		return this.writeToClipboard(text);
	}

	flashCopyButton(btn: HTMLButtonElement, success: boolean): void {
		const originalLabel = btn.dataset.originalLabel || btn.getAttribute('aria-label') || 'Copy';
		const stateClass = success ? 'copied' : 'copy-error';
		const stateLabel = success ? 'Copied!' : 'Copy failed';

		btn.classList.remove('copied', 'copy-error');
		btn.classList.add(stateClass);
		btn.setAttribute('aria-label', stateLabel);
		btn.title = stateLabel;

		setTimeout(() => {
			btn.classList.remove(stateClass);
			btn.setAttribute('aria-label', originalLabel);
			btn.title = originalLabel;
		}, 1200);
	}

	private async writeToClipboard(text: string): Promise<boolean> {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch { }

		try {
			const doc = this.documentRef;
			const textarea = doc.createElement('textarea');

			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			textarea.style.opacity = '0';
			doc.body.appendChild(textarea);
			textarea.focus();
			textarea.select();

			const result = doc.execCommand('copy');
			textarea.remove();

			return Boolean(result);

		} catch {
			return false;
		}
	}
}
