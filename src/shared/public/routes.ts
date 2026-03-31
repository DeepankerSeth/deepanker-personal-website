export type PublicVersion = "v1" | "v2";
export type PublicRouteKind = "home" | "writing" | "post";

export function publicUrl(
	version: PublicVersion,
	kind: PublicRouteKind,
	slug?: string
): string {
	const prefix = version === "v1" ? "/classic" : "";

	if (kind === "home") {
		return prefix || "/";
	}

	if (kind === "writing") {
		return `${prefix}/writing`;
	}

	if (!slug) {
		throw new Error("publicUrl requires a slug for post routes");
	}

	return `${prefix}/writing/${slug}`;
}
