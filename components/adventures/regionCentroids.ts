/** Rough centroids for the regions objectives are tagged with — for a count-by-region map. */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  WA: [47.4, -120.5],
  OR: [44.0, -120.5],
  CA: [37.2, -119.4],
  NV: [39.3, -116.6],
  ID: [44.2, -114.5],
  MT: [46.9, -110.4],
  WY: [43.0, -107.5],
  UT: [39.3, -111.7],
  CO: [39.0, -105.5],
  AZ: [34.3, -111.7],
  NM: [34.4, -106.1],
  AK: [63.0, -152.0],
  TN: [35.8, -86.4],
  BC: [53.7, -125.0],
};

const REGION_NAMES: Record<string, string> = {
  WA: 'Washington',
  OR: 'Oregon',
  CA: 'California',
  NV: 'Nevada',
  ID: 'Idaho',
  MT: 'Montana',
  WY: 'Wyoming',
  UT: 'Utah',
  CO: 'Colorado',
  AZ: 'Arizona',
  NM: 'New Mexico',
  AK: 'Alaska',
  TN: 'Tennessee',
  BC: 'British Columbia',
  'UT-AZ': 'Utah / Arizona',
  'WA-MT-ID': 'Washington / Montana / Idaho',
  international: 'International',
};

export function regionName(code: string): string {
  return REGION_NAMES[code] ?? code;
}

export function regionCentroid(code: string): [number, number] | null {
  return REGION_CENTROIDS[code] ?? null;
}
