import { ensureWidgetStyles } from './styles';

const BUTTON_ID = 'twitch-copy-pasta-toggle-button';
const OUTER_CONTAINER_SELECTORS = [
	'[data-a-target="chat-input-buttons-container"]',
	'.chat-input__buttons-container',
	'.chat-input__buttons',
];
const INNER_GROUP_SELECTORS = [
	'[data-test-selector="chat-input-buttons-container"] > .Layout-sc-1xcs6mc-0',
	'[data-a-target="chat-input-buttons-container"] > .Layout-sc-1xcs6mc-0',
	'.chat-input__buttons-container > .Layout-sc-1xcs6mc-0',
];
const SETTINGS_SELECTORS = [
	'button[data-a-target="chat-settings-button"]',
	'button[data-a-target="chat-settings"]',
];
const SEND_BUTTON_SELECTOR = 'button[data-a-target="chat-send-button"]';
const ACTION_ELEMENT_SELECTOR = 'button, a';

const ICON_SVG = `
<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="tcp-toggle-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#b17dff" />
      <stop offset="100%" stop-color="#6f2ce0" />
    </linearGradient>
  </defs>
  <path d="M20 4C10.611 4 3 10.513 3 18.55c0 4.354 2.004 8.244 5.333 10.957-.228 2.382-1.038 4.698-2.39 6.732a1 1 0 0 0 1.03 1.52c3.44-.45 6.63-1.796 9.372-3.92 1.129.226 2.298.35 3.655.35 9.389 0 17-6.513 17-14.55C37 10.513 29.389 4 20 4z" fill="url(#tcp-toggle-gradient)" />
  <rect x="13" y="16" width="14" height="3" rx="1.5" fill="#fff" opacity="0.9" />
  <rect x="13" y="22" width="14" height="3" rx="1.5" fill="#fff" opacity="0.9" />
</svg>`;

function findButtonsContainer(documentRef: Document): HTMLElement | null {
	const structuralContainer = findStructuralButtonsContainer(documentRef);

	if (structuralContainer) {
		return structuralContainer;
	}
	for (const selector of INNER_GROUP_SELECTORS) {
		const el = documentRef.querySelector<HTMLElement>(selector);
		if (el) return el;
	}
	for (const selector of OUTER_CONTAINER_SELECTORS) {
		const el = documentRef.querySelector<HTMLElement>(selector);
		if (el) return el;
	}

	return null;
}

function findStructuralButtonsContainer(documentRef: Document): HTMLElement | null {
	const settingsButton = findSettingsButton(documentRef);
	const sendButton = findSendButton(documentRef);

	if (settingsButton && sendButton) {
		let current: HTMLElement | null = sendButton.parentElement as HTMLElement | null;

		while (current && current !== documentRef.body) {
			if (current.contains(settingsButton)) {
				return current;
			}
			current = current.parentElement as HTMLElement | null;
		}
	}

	const fallbacks: (HTMLElement | null)[] = [settingsButton, sendButton];

	for (const anchor of fallbacks) {
		if (!anchor) continue;

		let current: HTMLElement | null = anchor.parentElement as HTMLElement | null;

		while (current && current !== documentRef.body) {
			const element = current;

			if (
				element.querySelector(SEND_BUTTON_SELECTOR) &&
				SETTINGS_SELECTORS.some(selector => element.querySelector(selector))
			) {
				return element;
			}

			current = element.parentElement as HTMLElement | null;
		}
	}

	return null;
}

function findSettingsButton(documentRef: Document): HTMLElement | null {
	for (const selector of SETTINGS_SELECTORS) {
		const el = documentRef.querySelector<HTMLElement>(selector);
		if (el) return el;
	}

	return null;
}

function findSendButton(documentRef: Document): HTMLElement | null {
	return documentRef.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
}

export function setupToggleButton(documentRef: Document, onToggle: () => void) {
	ensureWidgetStyles(documentRef);

	let button = documentRef.getElementById(BUTTON_ID) as HTMLButtonElement | null;
	let host = documentRef.getElementById(`${BUTTON_ID}-host`) as HTMLDivElement | null;

	if (!button) {
		button = documentRef.createElement('button');
		button.id = BUTTON_ID;
		button.type = 'button';
		button.className = 'twitch-copy-pasta-toggle';
		button.innerHTML = ICON_SVG;
		button.setAttribute('aria-label', 'Toggle Spamerino panel');
		button.title = 'Spamerino';
		button.addEventListener('click', evt => {
			evt.preventDefault();
			evt.stopPropagation();
			onToggle();
		});

		button.addEventListener('pointerdown', evt => evt.stopPropagation());
	}

	if (!host) {
		host = documentRef.createElement('div');
		host.id = `${BUTTON_ID}-host`;
		host.className = 'twitch-copy-pasta-toggle-host';
		host.appendChild(button);
	}

	const placeButton = () => {
		const container = findButtonsContainer(documentRef);

		if (!container) return false;
		const firstActionChild = Array.from(container.children).find(child => {
			if (!(child instanceof HTMLElement)) return false;
			if (child === host) return false;

			return Boolean(child.querySelector(ACTION_ELEMENT_SELECTOR));
		}) as HTMLElement | undefined;

		if (firstActionChild) {
			const alreadyBefore = host!.parentElement === container && host!.nextElementSibling === firstActionChild;

			if (!alreadyBefore) {
				container.insertBefore(host!, firstActionChild);
			}
		} else if (host!.parentElement !== container || host!.nextElementSibling) {
			container.appendChild(host!);
		}
		return true;
	};

	placeButton();
	const observer = new MutationObserver(() => placeButton());
	observer.observe(documentRef.body, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
		host?.remove();
	};
}
