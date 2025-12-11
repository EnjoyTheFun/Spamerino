import { TwitchPlatform } from '../core/TwitchPlatform';
import LocalStore from '../core/LocalStore';
import { CopyPastaWidget } from './ui/CopyPastaWidget';
import { extensionApi, MESSAGE_PREFIX } from '../shared/runtime';
import { setupToggleButton } from './ui/ToggleButton';
import { loadSettingsAsync } from '../shared/settings';
import { EmoteService } from './emotes/EmoteService';

const UNICODE_TAG_0 = '\u{34f}';
const UNICODE_TAG_0_REGEX = new RegExp(UNICODE_TAG_0, 'g');

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

async function applySettings() {
	const settings = await loadSettingsAsync();
	if (cleanupToggle) {
		cleanupToggle();
		cleanupToggle = null;
	}
	if (settings.showToggleIcon) {
		cleanupToggle = setupToggleButton(document, () => widget.toggle());
	}
	duplicateBypassEnabled = Boolean(settings.enableDuplicateBypass);
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
		void applySettings();
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

let lastSentByChannel: Record<string, { text: string; alt: boolean; ts: number; pendingAdjusted?: boolean }> = {};
const DUPLICATE_RESET_MS = 30_000;

const getDuplicateState = (channel: string) => {
	const state = lastSentByChannel[channel];
	if (!state) return { text: '', alt: false, ts: 0, pendingAdjusted: false };
	if (Date.now() - state.ts > DUPLICATE_RESET_MS) return { text: '', alt: false, ts: 0, pendingAdjusted: false };
	return state;
};

window.addEventListener(
	'keydown',
	(evt: KeyboardEvent) => {
		if (!duplicateBypassEnabled) return;
		if (evt.key !== 'Enter') return;

		const prompt = platform.getPromptElement();
		if (!prompt || document.activeElement !== prompt) return;

		const channel = platform.getChannel(location.href) || '';
		const rawText = (prompt.textContent || '').trim();
		if (!rawText) return;

		const normalized = rawText.replace(UNICODE_TAG_0_REGEX, '').trim();

		const state = getDuplicateState(channel);

		if (state.pendingAdjusted) {
			lastSentByChannel[channel] = {
				text: normalized,
				alt: rawText.includes(UNICODE_TAG_0),
				ts: Date.now(),
				pendingAdjusted: false,
			};
			return;
		}

		let next = normalized;
		let alt = state.alt;

		if (state.text === normalized) {
			alt = !alt;
			if (alt) {
				next = normalized + ' ' + UNICODE_TAG_0;
			} else {
				next = normalized;
			}
		} else {
			alt = false;
		}

		if (next !== rawText) {
			platform.setChatInput(next);
		}

		lastSentByChannel[channel] = { text: normalized, alt, ts: Date.now() };
	},
	true
);

window.addEventListener(
	'keydown',
	(evt: KeyboardEvent) => {
		if (!duplicateBypassEnabled) return;
		if (evt.key !== 'ArrowUp') return;

		const run = () => {
			const prompt = platform.getPromptElement();
			if (!prompt) return;
			const channel = platform.getChannel(location.href) || '';
			const rawText = (prompt.textContent || '').trim();
			if (!rawText) return;

			const normalized = rawText.replace(UNICODE_TAG_0_REGEX, '').trim();
			const state = getDuplicateState(channel);

			if (state.text && normalized === state.text) {
				const adjusted = normalized + ' ' + UNICODE_TAG_0;
				platform.setChatInput(adjusted);
				lastSentByChannel[channel] = { ...state, pendingAdjusted: true, ts: Date.now() };
			} else {
				lastSentByChannel[channel] = { ...state, pendingAdjusted: false, ts: Date.now() };
			}
		};

		requestAnimationFrame(run);
	},
	true
);

window.addEventListener(
	'keydown',
	(evt: KeyboardEvent) => {
		if (!duplicateBypassEnabled) return;
		if (evt.key !== 'ArrowDown') return;

		const run = () => {
			const prompt = platform.getPromptElement();
			if (!prompt) return;
			const channel = platform.getChannel(location.href) || '';
			const rawText = (prompt.textContent || '').trim();
			if (!rawText) return;

			const normalized = rawText.replace(UNICODE_TAG_0_REGEX, '').trim();
			const state = getDuplicateState(channel);

			if (state.text && normalized === state.text) {
				const adjusted = normalized + ' ' + UNICODE_TAG_0;
				platform.setChatInput(adjusted);
				lastSentByChannel[channel] = { ...state, pendingAdjusted: true, ts: Date.now() };
			} else {
				lastSentByChannel[channel] = { ...state, pendingAdjusted: false, ts: Date.now() };
			}
		};

		requestAnimationFrame(run);
	},
	true
);
