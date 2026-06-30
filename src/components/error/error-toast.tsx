import React from "react";
import { AlertCircle } from "lucide-react";
import type { Language } from "../../content.ts";

export interface ErrorToastProps {
	message: string;
	language: Language;
	onDismiss: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
	message,
	language,
	onDismiss,
}) => (
	<div
		role="alert"
		className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-900/95 text-red-100 px-8 py-4 rounded-2xl border border-red-700 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-bottom-4 shadow-2xl z-[100] max-w-[90vw]"
	>
		<div className="flex items-center gap-4">
			<AlertCircle
				className="w-5 h-5 text-red-300 flex-shrink-0"
				aria-hidden="true"
			/>
			<p className="text-sm font-bold tracking-tight">{message}</p>
		</div>
		<div className="flex items-center gap-3">
			<button
				onClick={onDismiss}
				aria-label={language === "en" ? "Dismiss error" : "Fehler schließen"}
				className="text-eb-50 hover:bg-white/10 p-2 rounded-full transition-colors"
			>
				<span aria-hidden="true">✕</span>
			</button>
		</div>
	</div>
);
