import { useEffect } from "react";

/** Prevents interaction with page content behind an open modal. */
export function useModalInert(active: boolean) {
	useEffect(() => {
		if (!active) return undefined;

		const targets = [
			document.querySelector("header"),
			document.getElementById("main-content"),
			document.querySelector("footer"),
		].filter((el): el is HTMLElement => el instanceof HTMLElement);

		for (const el of targets) {
			el.inert = true;
		}

		return () => {
			for (const el of targets) {
				el.inert = false;
			}
		};
	}, [active]);
}
