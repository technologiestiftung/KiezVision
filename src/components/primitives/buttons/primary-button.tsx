import React from "react";
import type { ButtonProps } from "./button-types.tsx";

const baseClasses =
	"bg-eb-900 text-eb-50 border-2 border-eb-900 font-black transition-all shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 disabled:opacity-50 disabled:cursor-not-allowed";

export const PrimaryButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	ariaPressed,
	ariaCurrent,
	title,
	children,
	className = "",
	testId,
}) => (
	<button
		type={type}
		onClick={onClick}
		disabled={disabled}
		aria-label={ariaLabel}
		aria-pressed={ariaPressed}
		aria-current={ariaCurrent}
		title={title}
		data-testid={testId}
		className={`${baseClasses} ${className}`.trim()}
	>
		{children}
	</button>
);
