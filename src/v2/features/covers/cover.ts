import type { Post } from "../../../lib/db";
import {
	COVER_ACCENTS,
	COVER_VARIANTS,
	type CoverAccent,
	type CoverVariant,
	normalizeCoverAccent,
	normalizeCoverVariant,
} from "../../../shared/public/covers";

type CoverSource = Pick<
	Post,
	"title" | "slug" | "tags" | "cover_variant" | "cover_accent"
>;

export interface CoverModel {
	variant: CoverVariant;
	accent: CoverAccent;
	seed: number;
	variantLabel: string;
	accentLabel: string;
}

const accentPalettes: Record<
	CoverAccent,
	{
		start: string;
		mid: string;
		end: string;
		line: string;
		glow: string;
	}
> = {
	moss: {
		start: "#dbe3d7",
		mid: "#93a58d",
		end: "#40534b",
		line: "rgba(222, 232, 220, 0.64)",
		glow: "rgba(134, 160, 128, 0.28)",
	},
	river: {
		start: "#dee9f0",
		mid: "#7d96ac",
		end: "#334c64",
		line: "rgba(231, 240, 247, 0.68)",
		glow: "rgba(123, 156, 189, 0.28)",
	},
	brass: {
		start: "#f3e7cf",
		mid: "#c59f69",
		end: "#6b4a25",
		line: "rgba(252, 244, 225, 0.7)",
		glow: "rgba(197, 159, 105, 0.3)",
	},
	dawn: {
		start: "#f1f4f7",
		mid: "#c8d6e3",
		end: "#6d8093",
		line: "rgba(255, 255, 255, 0.72)",
		glow: "rgba(191, 210, 229, 0.3)",
	},
};

function hashString(input: string): number {
	let hash = 0;
	for (let index = 0; index < input.length; index += 1) {
		hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
	}
	return Math.abs(hash);
}

function parseTagList(tags: string): string[] {
	try {
		const parsed = JSON.parse(tags);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function labelize(value: string): string {
	return value
		.split("-")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function deriveCover(source: CoverSource): CoverModel {
	const tags = parseTagList(source.tags);
	const seed = hashString([source.slug, source.title, tags.join("|")].join("::"));
	const fallbackVariant = COVER_VARIANTS[seed % COVER_VARIANTS.length];
	const fallbackAccent =
		COVER_ACCENTS[Math.floor(seed / 7) % COVER_ACCENTS.length];
	const variant = normalizeCoverVariant(source.cover_variant) ?? fallbackVariant;
	const accent = normalizeCoverAccent(source.cover_accent) ?? fallbackAccent;

	return {
		variant,
		accent,
		seed,
		variantLabel: labelize(variant),
		accentLabel: labelize(accent),
	};
}

export function coverPalette(accent: CoverAccent) {
	return accentPalettes[accent];
}
