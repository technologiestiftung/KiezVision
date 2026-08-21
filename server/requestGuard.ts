import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
	resolveGeminiApiKey,
	resolveMapillaryAccessToken,
} from "./secrets.ts";

const SESSION_COOKIE = "kv_api_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_API_BODY_BYTES = 4_000_000;

const ALLOWED_GEMINI_MODELS = new Set([
	"gemini-2.0-flash",
	"gemini-2.5-flash-image",
	"gemini-3.1-flash-image-preview",
]);

function headerValue(
	headers: IncomingMessage["headers"],
	name: string,
): string {
	const raw = headers[name.toLowerCase()];
	if (Array.isArray(raw)) return raw[0] ?? "";
	return raw ?? "";
}

function getSessionSecret(): string {
	const material = [
		resolveGeminiApiKey(),
		resolveMapillaryAccessToken(),
		"kiezvision-api-session",
	].join("|");
	return createHash("sha256").update(material).digest("hex");
}

export function getAllowedOrigins(): string[] {
	const origins = new Set<string>();
	origins.add("http://localhost:3000");
	origins.add("http://127.0.0.1:3000");
	origins.add("http://localhost:5173");
	origins.add("http://127.0.0.1:5173");

	const vercelUrl = (process.env.VERCEL_URL ?? "").trim();
	if (vercelUrl) {
		origins.add(
			vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`,
		);
	}
	const prodUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
	if (prodUrl) {
		origins.add(prodUrl.startsWith("http") ? prodUrl : `https://${prodUrl}`);
	}
	for (const part of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
		const trimmed = part.trim().replace(/\/$/, "");
		if (trimmed) origins.add(trimmed);
	}
	return [...origins];
}

function originFromUrl(raw: string): string | null {
	try {
		const u = new URL(raw);
		return `${u.protocol}//${u.host}`;
	} catch {
		return null;
	}
}

export function assertAllowedOrigin(req: IncomingMessage): void {
	const allowed = getAllowedOrigins();
	const origin = headerValue(req.headers, "origin");
	if (origin && allowed.includes(origin.replace(/\/$/, ""))) return;

	const referer = headerValue(req.headers, "referer");
	const refererOrigin = referer ? originFromUrl(referer) : null;
	if (refererOrigin && allowed.includes(refererOrigin)) return;

	const fetchSite = headerValue(req.headers, "sec-fetch-site");
	if (fetchSite === "same-origin" && refererOrigin) {
		if (allowed.includes(refererOrigin)) return;
	}

	throw Object.assign(new Error("Forbidden origin"), { status: 403 });
}

function signPayload(payload: string): string {
	return createHmac("sha256", getSessionSecret())
		.update(payload)
		.digest("base64url");
}

export function createSessionToken(ttlMs = SESSION_TTL_MS): string {
	const payload = Buffer.from(
		JSON.stringify({ exp: Date.now() + ttlMs }),
		"utf8",
	).toString("base64url");
	return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
	if (!token || !token.includes(".")) return false;
	const [payload, sig] = token.split(".");
	if (!payload || !sig) return false;
	const expected = signPayload(payload);
	try {
		const a = Buffer.from(sig);
		const b = Buffer.from(expected);
		if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
	} catch {
		return false;
	}
	try {
		const data = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as { exp?: number };
		return typeof data.exp === "number" && data.exp > Date.now();
	} catch {
		return false;
	}
}

export function parseCookies(
	req: IncomingMessage,
): Record<string, string> {
	const raw = headerValue(req.headers, "cookie");
	const out: Record<string, string> = {};
	for (const part of raw.split(";")) {
		const idx = part.indexOf("=");
		if (idx === -1) continue;
		const key = part.slice(0, idx).trim();
		const value = part.slice(idx + 1).trim();
		if (key) out[key] = decodeURIComponent(value);
	}
	return out;
}

export function getSessionCookieName(): string {
	return SESSION_COOKIE;
}

export function buildSessionCookie(token: string): string {
	const secure =
		process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
	const parts = [
		`${SESSION_COOKIE}=${encodeURIComponent(token)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Strict",
		`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function isSitePasswordRequired(): boolean {
	const enabled = ["true", "1", "yes"].includes(
		(process.env.ENABLE_SITE_PASSWORD ?? "").trim().toLowerCase(),
	);
	return enabled && (process.env.SITE_PASSWORD ?? "").trim().length > 0;
}

export function verifySitePassword(password: string): boolean {
	const expected = (process.env.SITE_PASSWORD ?? "").trim();
	if (!expected) return false;
	const a = Buffer.from(password);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export function assertValidSession(req: IncomingMessage): void {
	const cookies = parseCookies(req);
	if (!verifySessionToken(cookies[SESSION_COOKIE])) {
		throw Object.assign(new Error("API session required"), { status: 401 });
	}
}

export function assertProtectedApiRequest(req: IncomingMessage): void {
	assertAllowedOrigin(req);
	assertValidSession(req);
}

export function assertAllowedGeminiModel(model: string): void {
	if (!ALLOWED_GEMINI_MODELS.has(model)) {
		throw Object.assign(new Error(`Model not allowed: ${model}`), {
			status: 400,
		});
	}
}

export function assertBodySize(byteLength: number): void {
	if (byteLength > MAX_API_BODY_BYTES) {
		throw Object.assign(
			new Error(
				`Request body too large (${byteLength} bytes). Max is ${MAX_API_BODY_BYTES}. Try a smaller image or area.`,
			),
			{ status: 413 },
		);
	}
}
