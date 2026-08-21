export function isSitePasswordEnabled(): boolean {
	return __SITE_PASSWORD_ENABLED__ === "true";
}

export function getSitePasswordHash(): string {
	return __SITE_PASSWORD_HASH__;
}
