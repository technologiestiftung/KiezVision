import React from "react";
import { ArrowLeft } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";

export interface BackToHomeButtonProps {
	navigate: NavigateFunction;
	label: string;
	className?: string;
}

export const BackToHomeButton: React.FC<BackToHomeButtonProps> = ({
	navigate,
	label,
	className = "",
}) => (
	<button
		type="button"
		onClick={() => navigate("/")}
		className={`flex items-center gap-2 text-eb-900 font-black border-2 border-eb-900 px-4 h-10 bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all${className ? ` ${className}` : ""}`}
	>
		<ArrowLeft className="w-4 h-4" aria-hidden="true" />
		{label}
	</button>
);
