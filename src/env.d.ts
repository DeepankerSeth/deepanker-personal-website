/// <reference path="../.astro/types.d.ts" />

interface Env {
	DB: D1Database;
	ADMIN_PASSWORD_HASH: string;
	JWT_SECRET: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}
