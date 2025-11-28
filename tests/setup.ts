import { beforeEach } from 'vitest';

const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

globalThis.localStorage = localStorageMock as any;

const chromeMock = {
	storage: {
		local: {
			get: (key: string) => Promise.resolve({}),
			set: (data: any) => Promise.resolve(),
		},
	},
};

(globalThis as any).chrome = chromeMock;
(globalThis as any).browser = chromeMock;

beforeEach(() => {
	localStorage.clear();
});
