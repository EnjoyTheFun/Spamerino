import { EmoteService } from './EmoteService';

export function parseEmotesToHTML(text: string, emoteService: EmoteService, documentRef: Document): DocumentFragment {
	const fragment = documentRef.createDocumentFragment();
	const words = text.split(/(\s+)/);

	words.forEach(word => {
		const trimmed = word.trim();

		if (!trimmed) {
			fragment.appendChild(documentRef.createTextNode(word));
			return;
		}

		const emote = emoteService.getEmote(trimmed);

		if (emote) {
			const img = documentRef.createElement('img');

			img.className = 'emote';
			img.src = emote.url;
			img.alt = emote.code;
			img.title = emote.code;
			img.loading = 'lazy';
			img.decoding = 'async';

			fragment.appendChild(img);

			const trailingSpace = word.substring(trimmed.length);

			if (trailingSpace) {
				fragment.appendChild(documentRef.createTextNode(trailingSpace));
			}
		} else {
			fragment.appendChild(documentRef.createTextNode(word));
		}
	});

	return fragment;
}
