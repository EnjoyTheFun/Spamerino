import { TwitchPlatform } from '../../core/TwitchPlatform';

export function getChatInputRect(platform: TwitchPlatform): DOMRect | null {
	const chat = platform.getChatInput() || platform.getPromptElement();
	return chat ? chat.getBoundingClientRect() : null;
}

export function calcWidgetPosition(rect: DOMRect) {
	return {
		bottom: `${Math.round(window.innerHeight - rect.bottom)}px`,
		right: `${Math.round(window.innerWidth - rect.right + rect.width + 20)}px`,
	};
}
