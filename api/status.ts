import type { IncomingMessage, ServerResponse } from "node:http";
import { geminiConfigured } from "../server/gemini.ts";
import { mapillaryConfigured } from "../server/mapillary.ts";

export default async function handler(
	req: IncomingMessage & { method?: string },
	res: ServerResponse & {
		status: (code: number) => typeof res;
		json: (body: unknown) => void;
	},
): Promise<void> {
	if (req.method === "OPTIONS") {
		res.statusCode = 204;
		res.end();
		return;
	}
	if (req.method !== "GET") {
		res.status(405).json({ message: "Method not allowed" });
		return;
	}

	res.setHeader("Cache-Control", "no-store");
	res.status(200).json({
		gemini: geminiConfigured(),
		mapillary: mapillaryConfigured(),
	});
}
