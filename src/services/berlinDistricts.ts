export interface BerlinDistrictGeocode {
	lat: number;
	lng: number;
	displayName: string;
}

/** Stable district centres for quick picks — avoids Nominatim rate limits on rapid clicks. */
export const BERLIN_DISTRICT_GEOCODES: Record<string, BerlinDistrictGeocode> = {
	Mitte: { lat: 52.5178855, lng: 13.4040601, displayName: "Mitte, Berlin" },
	Friedrichshain: {
		lat: 52.5122154,
		lng: 13.4502904,
		displayName: "Friedrichshain, Berlin",
	},
	Kreuzberg: {
		lat: 52.4976443,
		lng: 13.411914,
		displayName: "Kreuzberg, Berlin",
	},
	Tempelhof: {
		lat: 52.4649016,
		lng: 13.3959089,
		displayName: "Tempelhof, Berlin",
	},
	Schöneberg: {
		lat: 52.482157,
		lng: 13.3551901,
		displayName: "Schöneberg, Berlin",
	},
	Neukölln: {
		lat: 52.4811497,
		lng: 13.4353501,
		displayName: "Neukölln, Berlin",
	},
	Pankow: { lat: 52.5979174, lng: 13.435316, displayName: "Pankow, Berlin" },
	Charlottenburg: {
		lat: 52.515747,
		lng: 13.3096834,
		displayName: "Charlottenburg, Berlin",
	},
	Wilmersdorf: {
		lat: 52.4871152,
		lng: 13.3203298,
		displayName: "Wilmersdorf, Berlin",
	},
	Spandau: { lat: 52.535788, lng: 13.1977924, displayName: "Spandau, Berlin" },
	Steglitz: {
		lat: 52.4572569,
		lng: 13.3222865,
		displayName: "Steglitz, Berlin",
	},
	Zehlendorf: {
		lat: 52.4343217,
		lng: 13.2589298,
		displayName: "Zehlendorf, Berlin",
	},
	Treptow: { lat: 52.417893, lng: 13.6001848, displayName: "Treptow, Berlin" },
	Köpenick: {
		lat: 52.4450491,
		lng: 13.5754153,
		displayName: "Köpenick, Berlin",
	},
	Marzahn: { lat: 52.5429481, lng: 13.563142, displayName: "Marzahn, Berlin" },
	Hellersdorf: {
		lat: 52.5366956,
		lng: 13.6048728,
		displayName: "Hellersdorf, Berlin",
	},
	Lichtenberg: {
		lat: 52.5321606,
		lng: 13.5118927,
		displayName: "Lichtenberg, Berlin",
	},
	Reinickendorf: {
		lat: 52.6047631,
		lng: 13.2952872,
		displayName: "Reinickendorf, Berlin",
	},
};

export function geocodeBerlinDistrict(
	query: string,
): BerlinDistrictGeocode | null {
	const key = query.trim();
	return BERLIN_DISTRICT_GEOCODES[key] ?? null;
}

export function isBerlinDistrict(query: string): boolean {
	return query.trim() in BERLIN_DISTRICT_GEOCODES;
}

export const BERLIN_DISTRICT_SEARCH_RADIUS_M = 320;
