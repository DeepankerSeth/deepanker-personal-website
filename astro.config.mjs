// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
	site: "https://deepankerseth.com",
	output: "server",
	// Editorial authentication uses its existing signed cookie, not Astro sessions.
	session: false,
	// Preserve pre-migration inline whitespace in the accepted templates.
	compressHTML: true,
	devToolbar: { enabled: false },
	// Database-backed essays are listed by the runtime /sitemap.xml route.
	// Build-time discovery included private fixed routes and missed essay slugs.
	adapter: cloudflare({
		// Art and author images are served directly. Do not expose an unused
		// image optimizer or decode author-supplied images through Sharp.
		imageService: "passthrough",
		// Keep fixture persistence local; the Vite adapter uses the v3 parent.
		remoteBindings: false,
		persistState: { path: process.env.DEEPANKER_D1_PERSIST_TO || ".local/state" },
	}),
});
