import { Platform } from './Platform';

const CHAT_BRIDGE_REQUEST_EVENT = 'twitch-copy-pasta:set-chat-input';
const CHAT_BRIDGE_RESPONSE_EVENT = `${CHAT_BRIDGE_REQUEST_EVENT}:result`;

export class TwitchPlatform implements Platform {
	parseChannel(channel: string): string {
		return this.getChannel(channel);
	}

	getChannel(url: string | undefined): string {
		if (url === undefined) {
			return '';
		}

		try {
			const path = new URL(url).pathname.split('/');

			for (let i = path.length - 1; i >= 0; i--) {
				if (path[i] === '') {
					continue;
				}

				return path[i];
			}

			return '';
		} catch {
			return '';
		}
	}

	getChannelId(): string | null {
		// Try to extract channel ID from various sources on the page
		try {
			// Method 1: Check meta tags
			const channelIdMeta = document.querySelector('meta[property="al:ios:url"]');
			if (channelIdMeta) {
				const content = channelIdMeta.getAttribute('content');
				const match = content?.match(/channel_id=(\d+)/);
				if (match) return match[1];
			}

			// Method 2: Check for data attributes on channel elements
			const channelElement = document.querySelector('[data-a-target="channel-home-tab"]');
			if (channelElement) {
				const parent = channelElement.closest('[data-channel-id]');
				if (parent) {
					const id = parent.getAttribute('data-channel-id');
					if (id) return id;
				}
			}

			// Method 3: Try to find in React fiber
			const root = document.querySelector('[data-a-page-loaded-name="ChannelWatchPage"]');
			if (root) {
				const fiberKey = Object.keys(root).find(key => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'));
				if (fiberKey) {
					const fiber = (root as any)[fiberKey];
					let current = fiber;
					let depth = 0;
					while (current && depth < 30) {
						const props = current.memoizedProps || current.pendingProps;
						if (props?.channelID || props?.channelId) {
							return String(props.channelID || props.channelId);
						}
						const state = current.memoizedState;
						if (state?.channelID || state?.channelId) {
							return String(state.channelID || state.channelId);
						}
						current = current.return || current.child || current.sibling;
						depth++;
					}
				}
			}

			// Method 4: Check localStorage for recent channel data
			try {
				const twilightSettings = localStorage.getItem('twilight.settings');
				if (twilightSettings) {
					const settings = JSON.parse(twilightSettings);
					// Twitch sometimes stores channel IDs in settings
					if (settings?.channelID) return String(settings.channelID);
				}
			} catch { }

			return null;
		} catch (err) {
			console.warn('[Spamerino] Failed to get channel ID:', err);
			return null;
		}
	}

	async getChannelIdFromApi(channelName: string): Promise<string | null> {
		// Fallback: query Twitch API using channel name
		try {
			const response = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${channelName}`);

			if (response.ok) {
				const data = await response.json();
				if (data && Array.isArray(data) && data[0]?.id) {
					return data[0].id;
				}
			}
		} catch (err) {
			console.warn('[Spamerino] Failed to get channel ID from API:', err);
		}
		return null;
	}

	getPromptElement(): HTMLElement | undefined {
		return document.querySelector<HTMLElement>('[data-a-target="chat-input"][contenteditable=true]') ?? undefined;
	}

	setChatInput(data: string): void {
		const text = data ?? '';
		if (text === '') {
			return;
		}

		void this.setChatInputThroughBridge(text);
	}

	getChatInput(): HTMLElement | undefined {
		return document.querySelector<HTMLElement>('.chat-input__textarea') ?? undefined;
	}

	private async setChatInputThroughBridge(text: string): Promise<void> {
		const success = await this.dispatchBridgeRequest(text);
		if (!success) {
			console.warn('[Twitch-Spamerino]: Could not find chat input editor');
		}
	}

	private dispatchBridgeRequest(text: string): Promise<boolean> {
		return new Promise((resolve) => {
			if (typeof window === 'undefined') {
				resolve(false);
				return;
			}

			const requestId = `tcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

			const handleResponse = (event: Event) => {
				const payload = this.parseBridgeDetail((event as CustomEvent<any>).detail);
				if (!payload || payload.requestId !== requestId) {
					return;
				}

				window.removeEventListener(CHAT_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
				clearTimeout(timer);
				resolve(Boolean(payload.success));
			};

			const timer = window.setTimeout(() => {
				window.removeEventListener(CHAT_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
				resolve(false);
			}, 200);

			window.addEventListener(CHAT_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
			window.dispatchEvent(
				new CustomEvent(CHAT_BRIDGE_REQUEST_EVENT, {
					detail: JSON.stringify({ text, requestId }),
					bubbles: true,
					composed: true,
				})
			);
		});
	}

	private parseBridgeDetail(detail: any): { requestId?: string; success?: boolean } | null {
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
}
