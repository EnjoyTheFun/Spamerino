import { HINT_CLASS } from '../../constants';

export class FormBuilder {
	constructor(private readonly documentRef: Document) { }

	createLabeledTextarea(label: string, placeholder: string): HTMLLabelElement {
		const wrapper = this.documentRef.createElement('label');
		wrapper.textContent = label;

		const textarea = this.documentRef.createElement('textarea');
		textarea.rows = 5;
		textarea.placeholder = placeholder;

		wrapper.appendChild(textarea);
		return wrapper;
	}

	createLabeledInput(label: string, placeholder: string): HTMLLabelElement {
		const wrapper = this.documentRef.createElement('label');
		wrapper.textContent = label;

		const input = this.documentRef.createElement('input');
		input.placeholder = placeholder;

		wrapper.appendChild(input);
		return wrapper;
	}

	createButton(type: 'button' | 'submit', className: string, text: string): HTMLButtonElement {
		const btn = this.documentRef.createElement('button');
		btn.type = type;
		btn.className = className;
		btn.textContent = text;
		return btn;
	}

	createHint(text: string): HTMLSpanElement {
		const hint = this.documentRef.createElement('span');
		hint.className = HINT_CLASS;
		hint.textContent = text;
		return hint;
	}
}
