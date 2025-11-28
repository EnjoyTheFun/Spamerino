declare const chrome: any;
declare const browser: any;

export const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
export const MESSAGE_PREFIX = 'twitch-copy-pasta';
