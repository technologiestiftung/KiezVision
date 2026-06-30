import type { AppView } from "../components/header/app-header.tsx";

export function normalizePath(pathname: string): string {
	if (pathname === "/libray") return "/library";
	return pathname;
}

export function pathnameToView(pathname: string): AppView {
	const path = normalizePath(pathname);
	if (path === "/edit") return "editor";
	if (path === "/library") return "library";
	if (path === "/image-gallery") return "image-gallery";
	if (path === "/about") return "about";
	return "home";
}
