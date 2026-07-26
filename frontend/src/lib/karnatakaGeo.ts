import raw from '../assets/karnataka-districts.json';

/**
 * Karnataka district boundaries (simplified from the 2011 census shapefiles,
 * ~131 KB). Coordinates are converted once at module load into Leaflet's
 * [lat, lng] order, along with per-district bounds and a world-sized mask
 * polygon whose holes are the districts — rendering it dims everything
 * outside the state.
 */

export type LatLng = [number, number];
/** One district = multipolygon = polygons -> rings -> [lat, lng] points. */
export type DistrictRings = LatLng[][][];

export interface DistrictShape {
  /** Name as it appears in the census boundary data. */
  geoName: string;
  /** Matching district name in the Vyuha backend, when one exists. */
  dbName: string;
  polygons: DistrictRings;
  bounds: [LatLng, LatLng];
}

interface RawFeature {
  properties: { district: string };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/** Census boundary name -> backend district name (where they differ). */
const GEO_TO_DB: Record<string, string> = {
  Bangalore: 'Bengaluru Urban',
  Dharwad: 'Hubballi-Dharwad',
  'Dakshina Kannada': 'Mangaluru',
};

function toLatLng(ring: number[][]): LatLng[] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

function buildShape(feature: RawFeature): DistrictShape {
  const { type, coordinates } = feature.geometry;
  const polygons: DistrictRings =
    type === 'Polygon'
      ? [(coordinates as number[][][]).map(toLatLng)]
      : (coordinates as number[][][][]).map((polygon) => polygon.map(toLatLng));

  let minLat = 90;
  let minLng = 180;
  let maxLat = -90;
  let maxLng = -180;
  for (const polygon of polygons) {
    for (const [lat, lng] of polygon[0]) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  const geoName = feature.properties.district;
  return {
    geoName,
    dbName: GEO_TO_DB[geoName] ?? geoName,
    polygons,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
}

export const DISTRICT_SHAPES: DistrictShape[] = (raw as { features: RawFeature[] }).features.map(
  buildShape,
);

export const KARNATAKA_BOUNDS: [LatLng, LatLng] = (() => {
  let minLat = 90;
  let minLng = 180;
  let maxLat = -90;
  let maxLng = -180;
  for (const shape of DISTRICT_SHAPES) {
    minLat = Math.min(minLat, shape.bounds[0][0]);
    minLng = Math.min(minLng, shape.bounds[0][1]);
    maxLat = Math.max(maxLat, shape.bounds[1][0]);
    maxLng = Math.max(maxLng, shape.bounds[1][1]);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
})();

/**
 * Mask polygon: a world-sized outer ring with every district's outer ring as
 * a hole, so filling it covers everything except Karnataka.
 */
export const KARNATAKA_MASK: LatLng[][] = [
  [
    [-89, -179],
    [-89, 179],
    [89, 179],
    [89, -179],
  ],
  ...DISTRICT_SHAPES.flatMap((shape) => shape.polygons.map((polygon) => polygon[0])),
];
