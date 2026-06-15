/**
 * Reverse geocoding via BigDataCloud's free client endpoint (no key) — used at sync time to
 * fill location when Strava returns null city/state/country. Graceful: returns null on failure.
 */

export interface GeoLocation {
  city: string | null;
  state: string | null;
  country: string | null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoLocation | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    if (!res.ok) {
      console.error(`[strava] reverse-geocode returned ${res.status}`);
      return null;
    }
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    return {
      city: j.city || j.locality || null,
      state: j.principalSubdivision || null,
      country: (j.countryName || '').replace(/\s*\(the\)$/i, '').trim() || null,
    };
  } catch (err) {
    console.error('[strava] reverse-geocode failed:', err);
    return null;
  }
}
