import { TwitchPlatform } from '../core/TwitchPlatform';
import LocalStore from '../core/LocalStore';
import { CopyPastaWidget } from './ui/CopyPastaWidget';
import { extensionApi, MESSAGE_PREFIX } from '../shared/runtime';
import { setupToggleButton } from './ui/ToggleButton';
import { loadSettingsAsync } from '../shared/settings';
import { EmoteService } from './emotes/EmoteService';

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

async function applySettings() {
	const settings = await loadSettingsAsync();
	if (cleanupToggle) {
		cleanupToggle();
		cleanupToggle = null;
	}
	if (settings.showToggleIcon) {
		cleanupToggle = setupToggleButton(document, () => widget.toggle());
	}
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
