import { CopyPasta } from '../../core/types';
import { getChannels } from '../../shared/channels';
import { buildSearchHaystack } from '../../shared/copyPasta';

export function createFilter(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return (_: CopyPasta) => true;

  const parts = trimmed.split(/\s+/);
  const tags = new Set<string>();
  let channel = '';
  const words: string[] = [];

  for (const part of parts) {
    if (part.startsWith('#')) {
      tags.add(part.slice(1).toLowerCase());
    } else if (part.startsWith('channel:')) {
      channel = part.slice('channel:'.length).toLowerCase();
    } else {
      words.push(part.toLowerCase());
    }
  }

  return (item: CopyPasta) => {
    if (channel && channel !== '*') {
      const channels = getChannels(item);
      if (!channels.length) return false;
      const match = channels.some(entry => entry.toLowerCase() === channel);
      if (!match) return false;
    }

    if (tags.size) {
      const normalizedTags = item.tags.map(tag => tag.toLowerCase());
      for (const tag of tags) {
        if (!normalizedTags.some(existing => existing.includes(tag))) return false;
      }
    }

    if (words.length) {
      const haystack = buildSearchHaystack(item);
      for (const word of words) {
        if (!haystack.includes(word)) return false;
      }
    }

    return true;
  };
}
