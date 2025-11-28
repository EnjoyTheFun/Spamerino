const CHAT_BRIDGE_REQUEST_EVENT = 'twitch-copy-pasta:set-chat-input';
const CHAT_BRIDGE_RESPONSE_EVENT = `${CHAT_BRIDGE_REQUEST_EVENT}:result`;

class TwitchChatBridge {
	setChatInput(text: string): boolean {
		if (!text) return false;
		if (this.setReactEditor(text)) return true;
		if (this.setDomEditor(text)) return true;
		return false;
	}

	getPromptElement(): HTMLElement | undefined {
		return document.querySelector<HTMLElement>('[data-a-target="chat-input"][contenteditable=true]') ?? undefined;
	}

	getChatInputReact(): { onChange(): void; children: any[] } | undefined {
		return this.getAutocompleteHandler();
	}

	private getAutocompleteHandler() {
		const node = this.findReactChildren(
			this.getReactInstance(this.getPromptElement()),
			(n: any) => n?.props?.node !== undefined
		);

		return node?.props?.node;
	}

	private findReactChildren(node: any, predicate: any, maxDepth = 15, depth = 0): any | null {
		let success = false;
		try {
			success = predicate(node);
		} catch {
			// ignore
		}
		if (success) {
			return node;
		}
		if (!node || depth > maxDepth) {
			return null;
		}

		if (node.children instanceof Array) {
			for (const child of node.children) {
				if (typeof child !== 'object') {
					continue;
				}

				const reactNode = this.findReactChildren(child, predicate, maxDepth, depth + 1);
				if (reactNode !== null) {
					return reactNode;
				}
			}
		} else if (typeof node.children === 'object') {
			return this.findReactChildren(node.children, predicate, maxDepth, depth + 1);
		}

		return null;
	}

	private getReactInstance(element: HTMLElement | undefined): Record<string, any> | undefined {
		let node: HTMLElement | null | undefined = element;
		while (node) {
			for (const key in node) {
				if (key.startsWith('__reactProps$')) {
					return (node as any)[key] as any;
				}
			}
			node = node.parentElement;
		}
	}

	private setReactEditor(text: string): boolean {
		const chatInput = this.getChatInputReact();
		if (!chatInput) return false;
		chatInput.children = [{ type: 'paragraph', children: [{ type: 'text', text }] }];
		chatInput.onChange();
		return true;
	}

	private setDomEditor(text: string): boolean {
		const prompt = this.getPromptElement();
		if (!prompt) return false;
		prompt.focus();
		const selection = window.getSelection();
		if (selection) {
			selection.removeAllRanges();
			const range = document.createRange();
			range.selectNodeContents(prompt);
			range.deleteContents();
			range.collapse(true);
			selection.addRange(range);
		}
		let inserted = false;
		try {
			inserted = document.execCommand('insertText', false, text);
		} catch { }
		if (!inserted) {
			prompt.textContent = text;
		}
		try {
			prompt.dispatchEvent(
				new InputEvent('input', { bubbles: true, data: text, inputType: 'insertFromPaste', composed: true })
			);
		} catch {
			prompt.dispatchEvent(new Event('input', { bubbles: true }));
		}
		return true;
	}
}

const bridge = new TwitchChatBridge();

window.addEventListener(CHAT_BRIDGE_REQUEST_EVENT, (event: Event) => {
	const custom = event as CustomEvent<string | { text?: string; requestId?: string }>;
	const payload = parseDetail(custom?.detail);
	const text = typeof payload?.text === 'string' ? payload.text : '';
	const requestId = payload?.requestId;
	let success = false;

	if (text) {
		try {
			success = bridge.setChatInput(text);
		} catch (err) {
			console.warn('[Twitch-Spamerino]: bridge error', err);
		}
	}

	if (requestId) {
		window.dispatchEvent(
			new CustomEvent(CHAT_BRIDGE_RESPONSE_EVENT, {
				detail: JSON.stringify({ requestId, success }),
				bubbles: true,
				composed: true,
			})
		);
	}
});

function parseDetail(detail: any): { text?: string; requestId?: string } | null {
	if (!detail) return null;
	if (typeof detail === 'object') return detail;
	if (typeof detail === 'string') {
		try {
			return JSON.parse(detail);
		} catch {
			return null;
		}
	}
	return null;
}

export { };
