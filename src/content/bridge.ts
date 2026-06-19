const CHAT_BRIDGE_REQUEST_EVENT = 'twitch-copy-pasta:set-chat-input';
const CHAT_BRIDGE_RESPONSE_EVENT = `${CHAT_BRIDGE_REQUEST_EVENT}:result`;
const CHAT_BRIDGE_SEND_REQUEST_EVENT = 'twitch-copy-pasta:send-chat-message';
const CHAT_BRIDGE_SEND_RESPONSE_EVENT = `${CHAT_BRIDGE_SEND_REQUEST_EVENT}:result`;
const VISIBILITY_BRIDGE_SETTINGS_EVENT = 'twitch-copy-pasta:visibility-bypass-settings';

type VisibilityPropertyName = 'hidden' | 'visibilityState' | 'webkitHidden' | 'webkitVisibilityState' | 'hasFocus';

type VisibilityOriginalDescriptor = {
	hidden?: PropertyDescriptor;
	visibilityState?: PropertyDescriptor;
	webkitHidden?: PropertyDescriptor;
	webkitVisibilityState?: PropertyDescriptor;
	hasFocus?: PropertyDescriptor;
};

let visibilityOriginalDescriptors: VisibilityOriginalDescriptor | null = null;
let visibilityBypassEnabled = false;

function loadVisibilityBypassSetting(): boolean {
	try {
		const raw = localStorage.getItem('spamerino-settings');
		if (!raw) return false;
		const parsed = JSON.parse(raw);
		return Boolean(parsed?.enableVisibilityBypass);
	} catch {
		return false;
	}
}

function applyVisibilityBypass(enabled: boolean): void {
	if (enabled === visibilityBypassEnabled) {
		return;
	}
	visibilityBypassEnabled = enabled;
	if (enabled) {
		installVisibilityBypass();
	} else {
		restoreVisibilityBypass();
	}
}

function installVisibilityBypass(): void {
	if (visibilityOriginalDescriptors) {
		return;
	}

	const documentPrototype = Document.prototype as Document & Record<string, any>;
	const originals: VisibilityOriginalDescriptor = {};

	const define = (property: VisibilityPropertyName, descriptor: PropertyDescriptor) => {
		const current = Object.getOwnPropertyDescriptor(documentPrototype, property);
		if (!current) {
			return;
		}
		originals[property] = current;
		try {
			Object.defineProperty(documentPrototype, property, descriptor);
		} catch { }
	};

	define('hidden', {
		configurable: true,
		enumerable: true,
		get: () => false,
	});
	define('visibilityState', {
		configurable: true,
		enumerable: true,
		get: () => 'visible',
	});
	define('webkitHidden', {
		configurable: true,
		enumerable: true,
		get: () => false,
	});
	define('webkitVisibilityState', {
		configurable: true,
		enumerable: true,
		get: () => 'visible',
	});
	define('hasFocus', {
		configurable: true,
		enumerable: true,
		value: () => true,
		writable: true,
	});

	visibilityOriginalDescriptors = originals;
}

function restoreVisibilityBypass(): void {
	if (!visibilityOriginalDescriptors) {
		return;
	}

	const documentPrototype = Document.prototype as Document & Record<string, any>;
	for (const property of Object.keys(visibilityOriginalDescriptors) as VisibilityPropertyName[]) {
		const original = visibilityOriginalDescriptors[property];
		if (!original) {
			delete documentPrototype[property];
			continue;
		}
		try {
			Object.defineProperty(documentPrototype, property, original);
		} catch {}
	}

	visibilityOriginalDescriptors = null;
}

applyVisibilityBypass(loadVisibilityBypassSetting());

window.addEventListener(VISIBILITY_BRIDGE_SETTINGS_EVENT, (event: Event) => {
	const custom = event as CustomEvent<string | { enabled?: boolean }>;
	let payload: any = custom.detail;
	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload);
		} catch {
			payload = null;
		}
	}
	applyVisibilityBypass(Boolean(payload?.enabled));
});

class TwitchChatBridge {
	setChatInput(text: string): boolean {
		if (!text) return false;
		if (this.setReactEditor(text)) return true;
		if (this.setDomEditor(text)) return true;
		return false;
	}

	sendChatMessage(text: string): boolean {
		const content = text ?? '';
		if (!content.trim()) return false;

		if (this.sendMessageWithReactHandler(content)) {
			this.clearChatInput();
			return true;
		}

		const sendButton = document.querySelector<HTMLButtonElement>('button[data-a-target="chat-send-button"]');
		if (!sendButton || sendButton.disabled) {
			return false;
		}

		if (!this.setChatInput(content)) {
			return false;
		}

		sendButton.click();
		return true;
	}

	clearChatInput(): boolean {
		if (this.setReactEditor('')) return true;
		if (this.setDomEditor('')) return true;
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
		} catch { }
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

	private getReactFiber(element: HTMLElement | undefined): any {
		let node: HTMLElement | null | undefined = element;
		while (node) {
			for (const key in node) {
				if (key.startsWith('__reactFiber$')) {
					return (node as any)[key];
				}
			}
			node = node.parentElement;
		}

		return undefined;
	}

	private findInReactFiber(start: any, predicate: (fiber: any) => boolean, maxDepth = 100): any | null {
		if (!start) {
			return null;
		}

		const queue: Array<{ fiber: any; depth: number }> = [{ fiber: start, depth: 0 }];
		const seen = new Set<any>();

		while (queue.length) {
			const item = queue.shift();
			if (!item) continue;

			const { fiber, depth } = item;
			if (!fiber || seen.has(fiber) || depth > maxDepth) {
				continue;
			}

			seen.add(fiber);

			try {
				if (predicate(fiber)) {
					return fiber;
				}
			} catch { }

			if (fiber.return) queue.push({ fiber: fiber.return, depth: depth + 1 });
			if (fiber.child) queue.push({ fiber: fiber.child, depth: depth + 1 });
			if (fiber.sibling) queue.push({ fiber: fiber.sibling, depth: depth + 1 });
		}

		return null;
	}

	private sendMessageWithReactHandler(text: string): boolean {
		const prompt = this.getPromptElement();
		if (!prompt) {
			return false;
		}

		const fiber = this.getReactFiber(prompt);
		const chatInputFiber = this.findInReactFiber(fiber, (f: any) => {
			const props = f?.memoizedProps ?? f?.pendingProps;
			return (
				typeof props?.onSendMessage === 'function' ||
				typeof props?.chatConnectionAPI?.sendMessage === 'function' ||
				typeof f?.stateNode?.onSendMessage === 'function' ||
				typeof f?.stateNode?.props?.onSendMessage === 'function' ||
				typeof f?.stateNode?.props?.chatConnectionAPI?.sendMessage === 'function'
			);
		});

		if (!chatInputFiber) {
			return false;
		}

		const props = chatInputFiber.memoizedProps ?? chatInputFiber.pendingProps;
		const stateNode = chatInputFiber.stateNode;
		const onSendMessage =
			props?.onSendMessage ?? stateNode?.onSendMessage ?? stateNode?.props?.onSendMessage;
		const sendMessage =
			props?.chatConnectionAPI?.sendMessage ??
			stateNode?.props?.chatConnectionAPI?.sendMessage ??
			stateNode?.chatConnectionAPI?.sendMessage;

		if (typeof onSendMessage === 'function') {
			onSendMessage(text, null);
			return true;
		}

		if (typeof sendMessage === 'function') {
			sendMessage(text);
			return true;
		}

		return false;
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

window.addEventListener(CHAT_BRIDGE_SEND_REQUEST_EVENT, (event: Event) => {
	const custom = event as CustomEvent<string | { text?: string; requestId?: string }>;
	const payload = parseDetail(custom?.detail);
	const text = typeof payload?.text === 'string' ? payload.text : '';
	const requestId = payload?.requestId;
	let success = false;

	if (text) {
		try {
			success = bridge.sendChatMessage(text);
		} catch (err) {
			console.warn('[Twitch-Spamerino]: send bridge error', err);
		}
	}

	if (requestId) {
		window.dispatchEvent(
			new CustomEvent(CHAT_BRIDGE_SEND_RESPONSE_EVENT, {
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
