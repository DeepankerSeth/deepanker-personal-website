export const COVER_VARIANTS = [
	"topographic",
	"horizon",
	"mineral",
	"weather",
	"signal",
	"field-note",
] as const;

export const COVER_ACCENTS = [
	"moss",
	"river",
	"brass",
	"dawn",
] as const;

export type CoverVariant = (typeof COVER_VARIANTS)[number];
export type CoverAccent = (typeof COVER_ACCENTS)[number];

function normalizeCoverValue<T extends readonly string[]>(
	value: unknown,
	allowedValues: T
): T[number] | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return null;
	}

	return allowedValues.includes(trimmedValue as T[number])
		? (trimmedValue as T[number])
		: null;
}

export function normalizeCoverVariant(value: unknown): CoverVariant | null {
	return normalizeCoverValue(value, COVER_VARIANTS);
}

export function normalizeCoverAccent(value: unknown): CoverAccent | null {
	return normalizeCoverValue(value, COVER_ACCENTS);
}
