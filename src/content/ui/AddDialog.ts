import LocalStore from '../../core/LocalStore';
import { CopyPasta } from '../../core/types';
import { TwitchPlatform } from '../../core/TwitchPlatform';
import { BACKDROP_CLASS, DIALOG_CLASS, FORM_CLASS, ERROR_CLASS } from '../constants';
import { normalizeChannelInput } from '../utils/copyPasta';
import { ensureWidgetStyles } from './styles';
import { EmoteService } from '../emotes/EmoteService';
import { TagInput } from './components/TagInput';
import { ChannelInput } from './components/ChannelInput';
import { EmotePreview } from './components/EmotePreview';
import { FormBuilder } from './components/FormBuilder';

export type EntryDialogOptions = {
	channelSuggestion?: string;
	initialItem?: CopyPasta;
	onSaved: (item: CopyPasta) => void;
	onClose?: () => void;
};

export class AddDialog {
	constructor(
		private readonly documentRef: Document,
		private readonly store: LocalStore,
		private readonly platform: TwitchPlatform,
		private readonly emoteService: EmoteService
	) { }

	open(options: EntryDialogOptions) {
		ensureWidgetStyles(this.documentRef);
		const formBuilder = new FormBuilder(this.documentRef);

		const overlay = this.documentRef.createElement('div');
		overlay.className = BACKDROP_CLASS;

		const dialog = this.documentRef.createElement('div');
		dialog.className = DIALOG_CLASS;

		const heading = this.documentRef.createElement('h2');
		const isEdit = Boolean(options.initialItem);
		heading.textContent = isEdit ? 'Edit' : 'Add';

		const form = this.documentRef.createElement('form');
		form.className = FORM_CLASS;
		form.noValidate = true;

		// Content input with emote preview
		const contentLabel = formBuilder.createLabeledTextarea('Message', '');
		const contentInput = contentLabel.querySelector('textarea')!;
		contentInput.value = options.initialItem?.content ?? '';

		const emotePreview = new EmotePreview(this.documentRef, this.emoteService, contentInput);
		contentLabel.appendChild(emotePreview.getContainer());
		emotePreview.initialize();

		// Tags input
		const tagsLabel = formBuilder.createLabeledInput('Tags', '');
		tagsLabel.appendChild(formBuilder.createHint('Press Enter to add, optional'));
		const tagsInput = tagsLabel.querySelector('input')!;

		const tagInputComponent = new TagInput(this.documentRef, {
			initialTags: options.initialItem?.tags,
			onChange: () => { /* Tags are retrieved on submit */ }
		});
		tagsLabel.appendChild(tagInputComponent.getChipContainer());

		// Replace the input element with the one from TagInput
		tagsLabel.replaceChild(tagInputComponent.getInput(), tagsInput);
		tagInputComponent.initialize();

		const channelLabel = formBuilder.createLabeledInput('Channels', '');
		channelLabel.appendChild(formBuilder.createHint('Press Enter to add, leave empty for all channels'));
		const channelInput = channelLabel.querySelector('input')!;

		const error = this.documentRef.createElement('p');
		error.className = ERROR_CLASS;
		error.textContent = '';

		let initialChannels = options.initialItem?.channels?.slice() ?? [];
		if (!initialChannels.length && options.channelSuggestion) {
			try {
				const suggested = normalizeChannelInput(options.channelSuggestion, this.platform);
				if (suggested) initialChannels.push(suggested);
			} catch { }
		}

		const channelInputComponent = new ChannelInput(this.documentRef, this.platform, {
			initialChannels,
			onChange: () => { /* Channels are retrieved on submit */ },
			onError: (message) => {
				error.textContent = message;
			}
		});
		channelLabel.appendChild(channelInputComponent.getChipContainer());

		// Replace the input element with the one from ChannelInput
		channelLabel.replaceChild(channelInputComponent.getInput(), channelInput);
		channelInputComponent.initialize();

		const info = formBuilder.createHint('You may not see scoped copypastas while viewing a different channel.');

		const controls = this.documentRef.createElement('div');
		controls.className = 'controls';

		const cancelBtn = formBuilder.createButton('button', 'cancel', 'Cancel');
		const saveBtn = formBuilder.createButton('submit', 'primary', 'Save');
		controls.append(cancelBtn, saveBtn);

		form.append(contentLabel, tagsLabel, channelLabel, error, info, controls);
		dialog.append(heading, form);
		overlay.appendChild(dialog);

		const close = () => {
			window.removeEventListener('keydown', onKeyDown, true);
			overlay.removeEventListener('pointerdown', onOverlayClick);
			overlay.remove();
			options.onClose?.();
		};

		const onOverlayClick = (evt: MouseEvent) => {
			if (evt.target === overlay) close();
		};

		const onKeyDown = (evt: KeyboardEvent) => {
			if (evt.key !== 'Escape') return;
			evt.preventDefault();
			evt.stopPropagation();
			close();
		};

		overlay.addEventListener('pointerdown', onOverlayClick);
		window.addEventListener('keydown', onKeyDown, true);
		cancelBtn.addEventListener('click', close);

		let isSubmitting = false;

		form.addEventListener('submit', evt => {
			evt.preventDefault();
			error.textContent = '';
			if (isSubmitting) return;

			const message = contentInput.value.trim();
			if (!message) {
				error.textContent = 'Message is required';
				contentInput.focus();
				return;
			}

			const channels = channelInputComponent.getChannels();
			const tags = tagInputComponent.getTags();

			const entry: CopyPasta = {
				id: options.initialItem?.id ?? 0,
				content: message,
				tags,
				channels,
			};

			isSubmitting = true;
			saveBtn.disabled = true;

			let savedEntry: CopyPasta;
			if (isEdit && options.initialItem) {
				this.updateEntry(entry);
				savedEntry = entry;
			} else {
				savedEntry = this.store.add(entry);
			}

			options.onSaved(savedEntry);
			close();
		});

		this.documentRef.body.appendChild(overlay);
		contentInput.focus();
	}

	private updateEntry(entry: CopyPasta) {
		const items = this.store.getAll();
		const index = items.findIndex(item => item.id === entry.id);
		if (index === -1) {
			this.store.add(entry);
			return;
		}
		items[index] = entry;
		this.store.save(items);
	}
}
