import { TwitchPlatform } from '../core/TwitchPlatform';
import LocalStore from '../core/LocalStore';
import { CopyPastaWidget } from './ui/CopyPastaWidget';
import { extensionApi, MESSAGE_PREFIX } from '../shared/runtime';
import { setupToggleButton } from './ui/ToggleButton';
import { loadSettingsAsync, type Settings } from '../shared/settings';
import { EmoteService } from './emotes/EmoteService';

const UNICODE_TAG_0 = '\u{34f}';
const UNICODE_TAG_0_REGEX = new RegExp(UNICODE_TAG_0, 'g');
const UNICODE_TAG_0_WITH_SPACE_REGEX = new RegExp(` ?${UNICODE_TAG_0}`, 'g');
const CHAT_BRIDGE_SEND_REQUEST_EVENT = 'twitch-copy-pasta:send-chat-message';
const CHAT_BRIDGE_SEND_RESPONSE_EVENT = `${CHAT_BRIDGE_SEND_REQUEST_EVENT}:result`;
const VISIBILITY_BRIDGE_SETTINGS_EVENT = 'twitch-copy-pasta:visibility-bypass-settings';

const platform = new TwitchPlatform();
const store = new LocalStore();
const emoteService = new EmoteService();
const widget = new CopyPastaWidget({ documentRef: document, platform, store, emoteService });

void emoteService.fetchGlobalEmotes();

let lastChannel = platform.getChannel(location.href);
(async () => {
	if (lastChannel) {
		let channelId = platform.getChannelId();
		if (!channelId) {
			channelId = await platform.getChannelIdFromApi(lastChannel);
		}
		void emoteService.fetchChannelEmotes(lastChannel, channelId || undefined);
	}
})();

setInterval(async () => {
	const channel = platform.getChannel(location.href);
	if (channel && channel !== lastChannel) {
		lastChannel = channel;
		let channelId = platform.getChannelId();
		if (!channelId) {
			channelId = await platform.getChannelIdFromApi(channel);
		}
		void emoteService.fetchChannelEmotes(channel, channelId || undefined);
	}
}, 2000);

let cleanupToggle: (() => void) | null = null;
let duplicateBypassEnabled = false;

async function applySettings(overrideSettings?: Settings) {
	const settings = overrideSettings ?? await loadSettingsAsync();
	if (cleanupToggle) {
		cleanupToggle();
		cleanupToggle = null;
	}
	if (settings.showToggleIcon) {
		cleanupToggle = setupToggleButton(document, () => widget.toggle());
	}
	duplicateBypassEnabled = Boolean(settings.enableDuplicateBypass);
	window.dispatchEvent(
		new CustomEvent(VISIBILITY_BRIDGE_SETTINGS_EVENT, {
			detail: JSON.stringify({ enabled: Boolean(settings.enableVisibilityBypass) }),
			bubbles: true,
			composed: true,
		})
	);
}

applySettings();

extensionApi.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: (response: any) => void) => {
	if (!msg) return;
	if (msg.type === `${MESSAGE_PREFIX}/paste`) {
		platform.setChatInput(msg.text || '');
		sendResponse?.({ ok: true });
	}
	if (msg.type === `${MESSAGE_PREFIX}/getChannel`) {
		sendResponse?.({ channel: platform.getChannel(location.href) });
	}
	if (msg.type === `${MESSAGE_PREFIX}/settings-changed`) {
		void applySettings(msg.settings);
		sendResponse?.({ ok: true });
	}
	if (msg.type === `${MESSAGE_PREFIX}/data-reset`) {
		localStorage.removeItem('twitch-copy-pasta::copypastas');
		store.save([]);
		widget.close();
		sendResponse?.({ ok: true });
	}
});

window.addEventListener(
	'keydown',
	(evt: KeyboardEvent) => {
		if (!(evt.key === ' ' && evt.ctrlKey && !evt.altKey)) return;
		evt.preventDefault();
		evt.stopPropagation();
		widget.toggle();
	},
	true
);

let lastSentByChannel: Record<string, { base: string; alt: boolean; ts: number }> = {};
const DUPLICATE_RESET_MS = 30_000;
let bypassSendInFlightUntil = 0;
let lastBypassSendSig = '';
let lastBypassSendTs = 0;
const BYPASS_SEND_DEDUPE_MS = 900;

const getDuplicateState = (channel: string) => {
	const state = lastSentByChannel[channel];
	if (!state) return { base: '', alt: false, ts: 0 };
	if (Date.now() - state.ts > DUPLICATE_RESET_MS) return { base: '', alt: false, ts: 0 };
	return state;
};

const normalizeDuplicateText = (text: string) => {
	return text.replace(UNICODE_TAG_0_WITH_SPACE_REGEX, '').replace(UNICODE_TAG_0_REGEX, '').trim();
};

const sendChatThroughBridge = (text: string): Promise<boolean> => {
	return new Promise(resolve => {
		const requestId = `tcp-send-${Date.now()}-${Math.random().toString(16).slice(2)}`;

		const onResponse = (event: Event) => {
			const custom = event as CustomEvent<any>;
			let payload: any = custom.detail;
			if (typeof payload === 'string') {
				try {
					payload = JSON.parse(payload);
				} catch {
					payload = null;
				}
			}

			if (!payload || payload.requestId !== requestId) return;

			window.removeEventListener(CHAT_BRIDGE_SEND_RESPONSE_EVENT, onResponse as EventListener);
			clearTimeout(timer);
			resolve(Boolean(payload.success));
		};

		const timer = window.setTimeout(() => {
			window.removeEventListener(CHAT_BRIDGE_SEND_RESPONSE_EVENT, onResponse as EventListener);
			resolve(false);
		}, 250);

		window.addEventListener(CHAT_BRIDGE_SEND_RESPONSE_EVENT, onResponse as EventListener);
		window.dispatchEvent(
			new CustomEvent(CHAT_BRIDGE_SEND_REQUEST_EVENT, {
				detail: JSON.stringify({ text, requestId }),
				bubbles: true,
				composed: true,
			})
		);
	});
};

const isPromptFocused = (prompt: HTMLElement) => {
	if (document.activeElement === prompt) {
		return true;
	}

	if (document.activeElement && prompt.contains(document.activeElement)) {
		return true;
	}

	const selection = window.getSelection();
	const anchorNode = selection?.anchorNode;
	return Boolean(anchorNode && prompt.contains(anchorNode));
};

const computeOutgoingMessage = (channel: string, rawText: string) => {
	const state = getDuplicateState(channel);
	const baseText = normalizeDuplicateText(rawText);

	let outgoing = baseText;
	let alt = false;
	const isDuplicate = state.base === baseText;

	if (isDuplicate) {
		alt = !state.alt;
		if (alt) {
			outgoing = `${baseText} ${UNICODE_TAG_0}`;
		}
	}

	return { state, baseText, outgoing, alt, isDuplicate };
};

window.addEventListener(
	'keydown',
	(evt: KeyboardEvent) => {
		if (!duplicateBypassEnabled) return;
		if (evt.key !== 'Enter' || evt.shiftKey) return;
		if (Date.now() < bypassSendInFlightUntil) return;

		const prompt = platform.getPromptElement();
		if (!prompt || !isPromptFocused(prompt)) return;

		const rawText = prompt.textContent || '';
		if (!rawText.trim()) return;

		const channel = platform.getChannel(location.href) || '';
		const { baseText, outgoing, alt, isDuplicate } = computeOutgoingMessage(channel, rawText);

		if (isDuplicate) {
			evt.preventDefault();
			evt.stopPropagation();
			(evt as any).stopImmediatePropagation?.();

			const sig = `${channel}|${outgoing}`;
			const now = Date.now();
			if (sig !== lastBypassSendSig || now - lastBypassSendTs > BYPASS_SEND_DEDUPE_MS) {
				lastBypassSendSig = sig;
				lastBypassSendTs = now;
				bypassSendInFlightUntil = now + 1000;
				void sendChatThroughBridge(outgoing);
			}
		}

		lastSentByChannel[channel] = { base: baseText, alt, ts: Date.now() };
	},
	true
);

window.addEventListener(
	'click',
	(evt: MouseEvent) => {
		if (!duplicateBypassEnabled) return;
		if (Date.now() < bypassSendInFlightUntil) return;
		if (!evt.isTrusted || evt.button !== 0 || evt.detail === 0) return;

		const target = evt.target as HTMLElement | null;
		if (!target) return;

		const sendButton = target.closest('button[data-a-target="chat-send-button"]') as HTMLButtonElement | null;
		if (!sendButton) return;

		const prompt = platform.getPromptElement();
		if (!prompt) return;

		const rawText = prompt.textContent || '';
		if (!rawText.trim()) return;

		const channel = platform.getChannel(location.href) || '';
		const { baseText, outgoing, alt, isDuplicate } = computeOutgoingMessage(channel, rawText);

		if (isDuplicate) {
			evt.preventDefault();
			evt.stopPropagation();
			(evt as any).stopImmediatePropagation?.();

			const sig = `${channel}|${outgoing}`;
			const now = Date.now();
			if (sig !== lastBypassSendSig || now - lastBypassSendTs > BYPASS_SEND_DEDUPE_MS) {
				lastBypassSendSig = sig;
				lastBypassSendTs = now;
				bypassSendInFlightUntil = now + 1000;
				void sendChatThroughBridge(outgoing);
			}
		}

		lastSentByChannel[channel] = { base: baseText, alt, ts: Date.now() };
	},
	true
);
