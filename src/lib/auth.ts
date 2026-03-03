// Authentication helpers — JWT + password hashing via Web Crypto API

export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
	input: string,
	storedHash: string
): Promise<boolean> {
	const inputHash = await hashPassword(input);
	// Constant-time comparison to prevent timing attacks
	if (inputHash.length !== storedHash.length) return false;
	let mismatch = 0;
	for (let i = 0; i < inputHash.length; i++) {
		mismatch |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
	}
	return mismatch === 0;
}

// ── JWT (simple HMAC-SHA256 implementation for Workers) ─────────

function base64UrlEncode(data: string): string {
	return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
	const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
	return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmacSign(message: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(message)
	);
	const sigArray = Array.from(new Uint8Array(signature));
	return base64UrlEncode(
		String.fromCharCode(...sigArray)
	);
}

export async function createToken(secret: string): Promise<string> {
	const header = base64UrlEncode(
		JSON.stringify({ alg: "HS256", typ: "JWT" })
	);
	const payload = base64UrlEncode(
		JSON.stringify({
			sub: "admin",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
		})
	);
	const signature = await hmacSign(`${header}.${payload}`, secret);
	return `${header}.${payload}.${signature}`;
}

export async function verifyToken(
	token: string,
	secret: string
): Promise<boolean> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return false;

		const [header, payload, signature] = parts;
		const expectedSig = await hmacSign(`${header}.${payload}`, secret);

		// Constant-time comparison
		if (signature.length !== expectedSig.length) return false;
		let mismatch = 0;
		for (let i = 0; i < signature.length; i++) {
			mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
		}
		if (mismatch !== 0) return false;

		// Check expiry
		const payloadData = JSON.parse(base64UrlDecode(payload));
		if (payloadData.exp && payloadData.exp < Math.floor(Date.now() / 1000)) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

export function getTokenFromCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]*)/);
	return match ? match[1] : null;
}

export function createAuthCookie(token: string): string {
	return `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearAuthCookie(): string {
	return `admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
