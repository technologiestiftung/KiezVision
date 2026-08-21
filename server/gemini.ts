import { GoogleGenAI } from "@google/genai";
import { assertAllowedGeminiModel } from "./requestGuard.ts";
import { resolveGeminiApiKey } from "./secrets.ts";

export type GeminiGenerateBody = {
	model: string;
	contents: unknown;
	config?: unknown;
};

function uint8ToBase64(value: Uint8Array): string {
	let binary = "";
	const chunk = 8192;
	for (let i = 0; i < value.length; i += chunk) {
		binary += String.fromCharCode(...value.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function serializeGeminiResponse(response: {
	text?: string;
	data?: string;
	[key: string]: unknown;
}): unknown {
	const serialized = JSON.parse(
		JSON.stringify(response, (_key, value) => {
			if (value instanceof Uint8Array) return uint8ToBase64(value);
			return value;
		}),
	) as Record<string, unknown>;

	if (typeof response.text === "string") {
		serialized.text = response.text;
	} else if (!serialized.text) {
		const fromParts = extractTextFromCandidates(serialized);
		if (fromParts) serialized.text = fromParts;
	}

	if (typeof response.data === "string") {
		serialized.data = response.data;
	}

	return serialized;
}

function extractTextFromCandidates(payload: Record<string, unknown>): string {
	const candidates = payload.candidates as
		| Array<{
				content?: { parts?: Array<{ text?: string; thought?: boolean }> };
		  }>
		| undefined;
	const pieces: string[] = [];
	for (const cand of candidates ?? []) {
		for (const part of cand.content?.parts ?? []) {
			if (part.thought) continue;
			if (part.text?.trim()) pieces.push(part.text.trim());
		}
	}
	return pieces.join("\n").trim();
}

export async function generateContentViaServer(
	body: GeminiGenerateBody,
): Promise<unknown> {
	const apiKey = resolveGeminiApiKey();
	if (!apiKey) {
		throw Object.assign(
			new Error("Gemini API key is not configured on the server."),
			{ status: 503 },
		);
	}
	if (!body?.model || body.contents === undefined) {
		throw Object.assign(new Error("Request must include model and contents."), {
			status: 400,
		});
	}
	assertAllowedGeminiModel(body.model);

	const ai = new GoogleGenAI({ apiKey });
	const response = await ai.models.generateContent({
		model: body.model,
		contents: body.contents as never,
		config: body.config as never,
	});

	return serializeGeminiResponse(response as never);
}

export function geminiConfigured(): boolean {
	return Boolean(resolveGeminiApiKey());
}
