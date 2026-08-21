import type { IncomingMessage, ServerResponse } from "node:http";

export function nodeHeader(req: IncomingMessage, name: string): string {
	const raw = req.headers[name.toLowerCase()];
	if (Array.isArray(raw)) return raw[0] ?? "";
	return raw ?? "";
}

export function sendJson(
	res: ServerResponse,
	status: number,
	data: unknown,
): void {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(data));
}

export function sendError(res: ServerResponse, error: unknown): void {
	const status =
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status: unknown }).status === "number"
			? (error as { status: number }).status
			: 500;
	const message =
		error instanceof Error ? error.message : "Internal server error";
	sendJson(res, status, { error: message, message });
}

export async function readRawBody(req: IncomingMessage): Promise<string> {
	const withBody = req as IncomingMessage & { body?: unknown };
	if (typeof withBody.body === "string") {
		return withBody.body;
	}
	if (withBody.body !== undefined) {
		return JSON.stringify(withBody.body);
	}
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}
