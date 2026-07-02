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

/** Approximate offset in metres (north = +y, east = +x). */
export function offsetPointM(
  lat: number,
  lng: number,
  metresNorth: number,
  metresEast: number,
): { lat: number; lng: number } {
  const latRad = (lat * Math.PI) / 180;
  const dLat = metresNorth / 111320;
  const dLng = metresEast / (111320 * Math.cos(latRad));
  return { lat: lat + dLat, lng: lng + dLng };
}
