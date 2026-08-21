export const BERLIN_DISTRICTS = [
	"Mitte",
	"Friedrichshain",
	"Kreuzberg",
	"Tempelhof",
	"Schöneberg",
	"Neukölln",
	"Pankow",
	"Charlottenburg",
	"Wilmersdorf",
	"Spandau",
	"Steglitz",
	"Zehlendorf",
	"Treptow",
	"Köpenick",
	"Marzahn",
	"Hellersdorf",
	"Lichtenberg",
	"Reinickendorf",
] as const;

export const KIEZVISION_LOGO_URL = "/kiezvision_logo.png";

export const DEFAULT_IMAGERY_SEARCH_RADIUS_M = 120;

import {
	getSitePasswordHash,
	isSitePasswordEnabled,
} from "./lib/env.ts";

export const isPasswordProtectionActive =
	isSitePasswordEnabled() && getSitePasswordHash().length > 0;
