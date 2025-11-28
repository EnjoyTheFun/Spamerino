import { STYLE_ID } from '../constants';
import widgetCss from './widget.css';

export function ensureWidgetStyles(documentRef: Document) {
	if (documentRef.getElementById(STYLE_ID)) return;

	const style = documentRef.createElement('style');
	style.id = STYLE_ID;
	style.textContent = widgetCss;
	documentRef.head.appendChild(style);
}
