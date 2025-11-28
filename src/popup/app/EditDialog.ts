import { CopyPasta } from '../../core/types';
import { normalizeChannel } from './channel';

export type EditDialogDeps = {
  documentRef: Document;
  getNextId: () => number;
};

export class EditDialog {
  private readonly dialog: HTMLDialogElement;
  private readonly form: HTMLFormElement;
  private readonly contentInput: HTMLTextAreaElement;
  private readonly tagsInput: HTMLInputElement;
  private readonly channelInput: HTMLInputElement;
  private readonly titleEl: HTMLElement;

  constructor(private readonly deps: EditDialogDeps) {
    const doc = deps.documentRef;
    this.dialog = doc.getElementById('editDialog') as HTMLDialogElement;
    this.form = doc.getElementById('editForm') as HTMLFormElement;
    this.contentInput = doc.getElementById('content') as HTMLTextAreaElement;
    this.tagsInput = doc.getElementById('tags') as HTMLInputElement;
    this.channelInput = doc.getElementById('channel') as HTMLInputElement;
    this.titleEl = doc.getElementById('dlgTitle') as HTMLElement;
  }

  open(item: CopyPasta | null, onSave: (payload: CopyPasta) => void) {
    this.titleEl.textContent = item ? 'Edit Copypasta' : 'Add Copypasta';
    this.contentInput.value = item?.content || '';
    this.tagsInput.value = item?.tags.join(' ') || '';
    this.channelInput.value = item?.channels?.join(', ') || '';

    const submit = (event: Event) => {
      event.preventDefault();
      const payload = this.buildPayload(item);
      if (!payload) return;
      onSave(payload);
      this.dialog.close();
      this.form.removeEventListener('submit', submit);
    };

    const close = () => {
      this.form.removeEventListener('submit', submit);
      this.dialog.removeEventListener('close', close);
    };

    this.form.addEventListener('submit', submit);
    this.dialog.addEventListener('close', close, { once: true });
    this.dialog.showModal();
  }

  private buildPayload(existing: CopyPasta | null): CopyPasta | null {
    const content = this.contentInput.value.trim();
    if (!content) return null;

    const tags = this.tagsInput.value.split(/\s+/).filter(Boolean);
    const channels = Array.from(
      new Set(
        this.channelInput.value
          .split(/[\s,]+/)
          .map(part => normalizeChannel(part))
          .filter(Boolean)
      )
    );

    return {
      id: existing ? existing.id : this.deps.getNextId(),
      content,
      tags,
      channels,
    };
  }
}
