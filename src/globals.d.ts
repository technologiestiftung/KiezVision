declare global {
	interface Window {
		aistudio?: {
			hasSelectedApiKey: () => Promise<boolean>;
			openSelectKey: () => Promise<void>;
		};
	}
}

export {};
