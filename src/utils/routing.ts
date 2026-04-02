import { decodePolyline } from './geo';

type LatLng = { lat: number; lng: number };
type RouteCoords = { latitude: number; longitude: number }[];

export type RouteResult = {
  coords: RouteCoords;
  etaMin: number | null;
};

function normalizeEta(seconds: unknown): number | null {
  const n = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n / 60));
}

async function fetchRouteFromOsrm(origin: LatLng, destination: LatLng): Promise<RouteResult | null> {
  const url =
    'https://router.project-osrm.org/route/v1/driving/' +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    '?overview=full&geometries=polyline&alternatives=false&steps=false';
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = Array.isArray(json?.routes) ? json.routes[0] : null;
  if (!route) return null;
  const geometry = typeof route.geometry === 'string' ? route.geometry : null;
  const coords = geometry ? decodePolyline(geometry) : [];
  return {
    coords,
    etaMin: normalizeEta(route.duration),
  };
}

async function fetchRouteFromGoogle(
  origin: LatLng,
  destination: LatLng,
  googleApiKey?: string | null,
): Promise<RouteResult | null> {
  if (!googleApiKey) return null;
  const url =
    'https://maps.googleapis.com/maps/api/directions/json' +
    `?origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}` +
    `&key=${encodeURIComponent(googleApiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route) return null;
  const poly = typeof route?.overview_polyline?.points === 'string' ? route.overview_polyline.points : '';
  const coords = poly ? decodePolyline(poly) : [];
  const etaMin = normalizeEta(route?.legs?.[0]?.duration?.value);
  return { coords, etaMin };
}

/**
 * Route fetch strategy:
 * 1) Use OSRM first (free, no Google bill impact).
 * 2) Fallback to Google Directions for robustness.
 */
export async function fetchBestRoute(
  origin: LatLng,
  destination: LatLng,
  googleApiKey?: string | null,
): Promise<RouteResult | null> {
  try {
    const osrm = await fetchRouteFromOsrm(origin, destination);
    if (osrm && (osrm.coords.length > 0 || osrm.etaMin != null)) {
      return osrm;
    }
  } catch {
    // fall through to Google fallback
  }

  try {
    const google = await fetchRouteFromGoogle(origin, destination, googleApiKey);
    if (google && (google.coords.length > 0 || google.etaMin != null)) {
      return google;
    }
  } catch {
    // caller handles best-effort failures
  }
  return null;
}
