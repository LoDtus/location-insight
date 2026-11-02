export interface MapSuggestion {
  refId: string;
  name: string;
  address: string;
  addressOld: string | null;
  display: string;
  distanceKm: number | null;
}

export interface MapPlace {
  lat: number;
  lng: number;
  name: string;
  address: string;
  addressOld: string | null;
  display: string;
}

export type Congestion = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export interface MapRouteStep {
  text: string;
  distanceM: number;
  durationS: number;
  sign: number;
  street: string;
}

export interface MapRoute {
  distanceM: number;
  durationS: number;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** [lng, lat] */
  geometry: Array<[number, number]>;
  steps: MapRouteStep[];
  congestion: Congestion[] | null;
}

export interface MapConfigPayload {
  styles: Array<{ id: string; url: string }>;
  trafficStyleUrl: string | null;
  center: [number, number];
  zoom: number;
  maxBounds: [number, number, number, number];
  searchEnabled: boolean;
  tilesEnabled: boolean;
}

export interface MapUsagePayload {
  date: string;
  budget: number;
  upstream: Record<string, number>;
  cacheHits: Record<string, number>;
}
