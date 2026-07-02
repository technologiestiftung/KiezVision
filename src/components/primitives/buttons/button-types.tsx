import type { ReactNode } from "react";

export interface ButtonProps {
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit";
	ariaLabel?: string;
	ariaPressed?: boolean;
	ariaCurrent?: boolean | "page";
	title?: string;
	children?: ReactNode;
	className?: string;
	testId?: string;
}
