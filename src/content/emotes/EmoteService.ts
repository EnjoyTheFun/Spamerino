export type Emote = {
	code: string;
	url: string;
	provider: '7tv' | 'ffz' | 'bttv' | 'twitch';
};

type EmoteCache = {
	global: Map<string, Emote>;
	channel: Map<string, Emote>;
	lastGlobalFetch: number;
	lastChannelFetch: number;
	currentChannel: string;
};

const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export class EmoteService {
	private cache: EmoteCache = {
		global: new Map(),
		channel: new Map(),
		lastGlobalFetch: 0,
		lastChannelFetch: 0,
		currentChannel: '',
	};

	private fetchingGlobal = false;
	private fetchingChannel = false;

	async fetchGlobalEmotes(): Promise<void> {
		if (Date.now() - this.cache.lastGlobalFetch < CACHE_DURATION) {
			return;
		}

		if (this.fetchingGlobal) return;
		this.fetchingGlobal = true;

		try {
			const [twitch, sevenTv, ffz, bttv] = await Promise.allSettled([
				this.fetchTwitchGlobalEmotes(),
				this.fetch7TVGlobalEmotes(),
				this.fetchFFZGlobalEmotes(),
				this.fetchBTTVGlobalEmotes(),
			]);

			this.cache.global.clear();

			if (twitch.status === 'fulfilled') {
				twitch.value.forEach((emote: Emote) => this.cache.global.set(emote.code, emote));
			}
			if (sevenTv.status === 'fulfilled') {
				sevenTv.value.forEach((emote: Emote) => this.cache.global.set(emote.code, emote));
			}
			if (ffz.status === 'fulfilled') {
				ffz.value.forEach((emote: Emote) => this.cache.global.set(emote.code, emote));
			}
			if (bttv.status === 'fulfilled') {
				bttv.value.forEach((emote: Emote) => this.cache.global.set(emote.code, emote));
			}

			this.cache.lastGlobalFetch = Date.now();
		} catch (err) {
			console.error('[Spamerino] Failed to fetch global emotes:', err);
		} finally {
			this.fetchingGlobal = false;
		}
	}

	async fetchChannelEmotes(channelName: string, channelId?: string): Promise<void> {
		if (!channelName) return;

		if (
			this.cache.currentChannel === channelName &&
			Date.now() - this.cache.lastChannelFetch < CACHE_DURATION
		) {
			return;
		}

		if (this.fetchingChannel) return;
		this.fetchingChannel = true;

		try {
			const [twitchChannel, sevenTv, ffz, bttv] = await Promise.allSettled([
				this.fetchTwitchChannelEmotes(channelName, channelId),
				this.fetch7TVChannelEmotes(channelName),
				this.fetchFFZChannelEmotes(channelName),
				this.fetchBTTVChannelEmotes(channelId || channelName),
			]);

			this.cache.channel.clear();

			if (twitchChannel.status === 'fulfilled') {
				twitchChannel.value.forEach((emote: Emote) => this.cache.channel.set(emote.code, emote));
			}
			if (sevenTv.status === 'fulfilled') {
				sevenTv.value.forEach((emote: Emote) => this.cache.channel.set(emote.code, emote));
			}
			if (ffz.status === 'fulfilled') {
				ffz.value.forEach((emote: Emote) => this.cache.channel.set(emote.code, emote));
			}
			if (bttv.status === 'fulfilled') {
				bttv.value.forEach((emote: Emote) => this.cache.channel.set(emote.code, emote));
			}

			this.cache.currentChannel = channelName;
			this.cache.lastChannelFetch = Date.now();
		} catch (err) {
			console.error('[Spamerino] Failed to fetch channel emotes:', err);
		} finally {
			this.fetchingChannel = false;
		}
	}

	getEmote(code: string): Emote | undefined {
		return this.cache.channel.get(code) || this.cache.global.get(code);
	}

	getAllEmotes(): Emote[] {
		const all = new Map<string, Emote>();
		this.cache.global.forEach((emote, code) => all.set(code, emote));
		this.cache.channel.forEach((emote, code) => all.set(code, emote));
		return Array.from(all.values());
	}

	private async fetchTwitchGlobalEmotes(): Promise<Emote[]> {
		try {
			const resp = await fetch('https://emotes.adamcy.pl/v1/global/emotes/twitch');

			if (!resp.ok) throw new Error('Twitch fetch failed');

			const data = await resp.json();
			if (!Array.isArray(data)) return [];

			return data
				.map((e: any) => ({
					code: e.code,
					url: e.urls?.[0]?.url?.replace('/light/', '/dark/') || e.urls?.[0]?.url,
					provider: 'twitch' as const,
				}))
				.filter((e: Emote) => e.url);
		} catch (err) {
			console.warn('[Spamerino] Twitch global emotes fetch failed:', err);
			return [];
		}
	}

	private async fetch7TVGlobalEmotes(): Promise<Emote[]> {
		const resp = await fetch('https://7tv.io/v3/emote-sets/global');

		if (!resp.ok) throw new Error('7TV fetch failed');
		const data = await resp.json();

		return (data.emotes || []).map((e: any) => ({
			code: e.name,
			url: `https://cdn.7tv.app/emote/${e.id}/1x.webp`,
			provider: '7tv' as const,
		}));
	}

	private async fetch7TVChannelEmotes(channelName: string): Promise<Emote[]> {
		const resp = await fetch(`https://7tv.io/v3/users/twitch/${channelName}`);

		if (!resp.ok) throw new Error('7TV channel fetch failed');
		const data = await resp.json();
		const emotes = data.emote_set?.emotes || [];

		return emotes.map((e: any) => ({
			code: e.name,
			url: `https://cdn.7tv.app/emote/${e.id}/1x.webp`,
			provider: '7tv' as const,
		}));
	}

	private async fetchFFZGlobalEmotes(): Promise<Emote[]> {
		const resp = await fetch('https://api.frankerfacez.com/v1/set/global');

		if (!resp.ok) throw new Error('FFZ fetch failed');
		const data = await resp.json();
		const emotes: Emote[] = [];

		for (const setId in data.sets) {
			const set = data.sets[setId];

			if (set.emoticons) {
				set.emoticons.forEach((e: any) => {
					emotes.push({
						code: e.name,
						url: `https://cdn.frankerfacez.com/emote/${e.id}/1`,
						provider: 'ffz',
					});
				});
			}
		}
		return emotes;
	}

	private async fetchFFZChannelEmotes(channelName: string): Promise<Emote[]> {
		const resp = await fetch(`https://api.frankerfacez.com/v1/room/${channelName}`);

		if (!resp.ok) throw new Error('FFZ channel fetch failed');

		const data = await resp.json();
		const emotes: Emote[] = [];

		if (data.sets) {
			for (const setId in data.sets) {
				const set = data.sets[setId];

				if (set.emoticons) {
					set.emoticons.forEach((e: any) => {
						emotes.push({
							code: e.name,
							url: `https://cdn.frankerfacez.com/emote/${e.id}/1`,
							provider: 'ffz',
						});
					});
				}
			}
		}
		return emotes;
	}

	private async fetchBTTVGlobalEmotes(): Promise<Emote[]> {
		const resp = await fetch('https://api.betterttv.net/3/cached/emotes/global');

		if (!resp.ok) throw new Error('BTTV fetch failed');
		const data = await resp.json();

		return (data || []).map((e: any) => {
			const extension = e.imageType === 'gif' ? 'gif' : 'png';
			return {
				code: e.code,
				url: `https://cdn.betterttv.net/emote/${e.id}/1x.${extension}`,
				provider: 'bttv' as const,
			};
		});
	}

	private async fetchBTTVChannelEmotes(channelId: string): Promise<Emote[]> {
		const resp = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);

		if (!resp.ok) throw new Error('BTTV channel fetch failed');
		const data = await resp.json();

		const channelEmotes = (data.channelEmotes || []).map((e: any) => {
			const extension = e.imageType === 'gif' ? 'gif' : 'png';
			return {
				code: e.code,
				url: `https://cdn.betterttv.net/emote/${e.id}/1x.${extension}`,
				provider: 'bttv' as const,
			};
		});

		const sharedEmotes = (data.sharedEmotes || []).map((e: any) => {
			const extension = e.imageType === 'gif' ? 'gif' : 'png';
			return {
				code: e.code,
				url: `https://cdn.betterttv.net/emote/${e.id}/1x.${extension}`,
				provider: 'bttv' as const,
			};
		});

		return [...channelEmotes, ...sharedEmotes];
	}

	private async fetchTwitchChannelEmotes(channelName: string, channelId?: string): Promise<Emote[]> {
		try {
			let broadcasterId = channelId;

			if (!broadcasterId) {
				const userResp = await fetch(
					`https://api.ivr.fi/v2/twitch/user?login=${channelName}`
				);

				if (!userResp.ok) {
					throw new Error('Failed to fetch user info from ivr.fi');
				}

				const userData = await userResp.json();
				broadcasterId = userData?.[0]?.id;

				if (!broadcasterId) {
					throw new Error('Broadcaster not found');
				}
			}

			const emotesResp = await fetch(
				`https://api.ivr.fi/v2/twitch/emotes/channel/${broadcasterId}?id=true`
			);

			if (!emotesResp.ok) {
				throw new Error('Failed to fetch channel emotes from ivr.fi');
			}

			const data = await emotesResp.json();
			const emotes: Emote[] = [];

			if (Array.isArray(data.subProducts)) {
				for (const tier of data.subProducts) {
					if (Array.isArray(tier.emotes)) {
						for (const emote of tier.emotes) {
							if (emote.id && emote.code) {
								emotes.push({
									code: emote.code,
									url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`,
									provider: 'twitch',
								});
							}
						}
					}
				}
			}

			if (Array.isArray(data.bitEmotes)) {
				for (const emote of data.bitEmotes) {
					if (emote.id && emote.code) {
						emotes.push({
							code: emote.code,
							url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`,
							provider: 'twitch',
						});
					}
				}
			}

			if (Array.isArray(data.localEmotes)) {
				for (const emoteSet of data.localEmotes) {
					if (Array.isArray(emoteSet.emotes)) {
						for (const emote of emoteSet.emotes) {
							if (emote.id && emote.code) {
								emotes.push({
									code: emote.code,
									url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`,
									provider: 'twitch',
								});
							}
						}
					}
				}
			}

			return emotes;
		} catch (err) {
			console.warn('[Spamerino] Twitch channel emotes fetch failed:', err);
			return [];
		}
	}
}
