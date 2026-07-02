import React from "react";
import type { ButtonProps } from "./button-types.tsx";

const baseClasses =
	"bg-white text-eb-900 border-2 border-eb-900 font-black transition-all shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-coral-100 disabled:opacity-50 disabled:cursor-not-allowed";

export const SecondaryButton: React.FC<ButtonProps> = ({
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
