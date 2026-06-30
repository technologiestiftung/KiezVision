import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useFocusTrap(
	active: boolean,
	containerRef: RefObject<HTMLDivElement | null>,
	onEscape?: () => void,
) {
	const previousFocusRef = useRef<HTMLElement | null>(null);

	const trapFocus = useCallback((ref: RefObject<HTMLDivElement | null>) => {
		const el = ref.current;
		if (!el) return undefined;
		const focusable = el.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		if (focusable.length) focusable[0].focus();

		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Tab" || !focusable.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		el.addEventListener("keydown", handler);
		return () => el.removeEventListener("keydown", handler);
	}, []);

	useEffect(() => {
		if (!active) return undefined;

		previousFocusRef.current = document.activeElement as HTMLElement | null;
		const cleanup = trapFocus(containerRef);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onEscape?.();
		};
		document.addEventListener("keydown", onKey);

		return () => {
			cleanup?.();
			document.removeEventListener("keydown", onKey);
			previousFocusRef.current?.focus?.();
		};
	}, [active, containerRef, onEscape, trapFocus]);
}
