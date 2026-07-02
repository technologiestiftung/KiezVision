import React from "react";
import { AlertCircle } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import { PrimaryButton } from "../primitives/buttons/primary-button.tsx";
import { SecondaryButton } from "../primitives/buttons/secondary-button.tsx";

export interface EditorEmptyStateProps {
	navigate: NavigateFunction;
	title: string;
	subtitle: string;
	backLabel: string;
	libraryLabel: string;
}

export const EditorEmptyState: React.FC<EditorEmptyStateProps> = ({
	navigate,
	title,
	subtitle,
	backLabel,
	libraryLabel,
}) => (
	<div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
		<AlertCircle className="w-14 h-14 text-coral-500 mb-4" aria-hidden />
		<h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-3 text-eb-900">
			{title}
		</h2>
		<p className="text-sm md:text-base font-bold text-eb-900/70 mb-8 leading-relaxed">
			{subtitle}
		</p>
		<div className="flex flex-col sm:flex-row gap-4 w-full sm:justify-center">
			<PrimaryButton
				onClick={() => navigate("/", { replace: true })}
				className="px-8 py-4 text-xs"
			>
				{backLabel}
			</PrimaryButton>
			<SecondaryButton
				onClick={() => navigate("/library", { replace: true })}
				className="px-8 py-4 text-xs"
			>
				{libraryLabel}
			</SecondaryButton>
		</div>
	</div>
);
