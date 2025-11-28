export interface Platform {
	setChatInput(data: string): void;
	getChatInput(): HTMLElement | undefined;
	getPromptElement(): HTMLElement | undefined;
	getChannel(url: string | undefined): string;
	parseChannel(channel: string): string;
}
