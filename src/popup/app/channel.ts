export function normalizeChannel(input: string): string {
	if (!input) return '';

	let value = input.trim();

	if (!value) return '';

	try {
		const url = new URL(value);
		const parts = url.pathname.split('/').filter(Boolean);

		if (parts.length) value = parts[parts.length - 1];
	} catch { }
	value = value.trim().replace(/^@/, '').toLowerCase();

	if (!value) return '';

	if (!/^[a-z0-9_]+$/.test(value)) return '';

	return value;
}
