/** Great-circle distance in metres between two WGS84 points. */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Approximate degree delta for a bbox radius at a given latitude. */
export function metresToDegreeDelta(metres: number, atLat: number): number {
  const latRad = (atLat * Math.PI) / 180;
  const metresPerDegreeLat = 111320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos(latRad);
  return metres / Math.min(metresPerDegreeLat, metresPerDegreeLng);
}
