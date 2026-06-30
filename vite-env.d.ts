/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GEMINI_API_KEY: string;
	readonly VITE_CUSTOM_GEMINI_API_KEY: string;
	readonly VITE_MAPILLARY_ACCESS_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
