import Constants from 'expo-constants';

const expoConfig =
  (Constants.expoConfig as { extra?: Record<string, unknown> } | null) ||
  ((Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest ?? null) ||
  ((Constants as unknown as { manifest2?: { extra?: Record<string, unknown> } }).manifest2 ?? null);

const extra = (expoConfig && expoConfig.extra) || {};
const apiFromExtra = typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl.trim() : '';
const socketFromExtra = typeof extra.socketUrl === 'string' ? extra.socketUrl.trim() : '';
const mapsFromExtra = typeof extra.googleMapsApiKey === 'string' ? extra.googleMapsApiKey.trim() : '';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || apiFromExtra || 'http://localhost:8080';

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || socketFromExtra || 'http://localhost:8090';

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || mapsFromExtra || '';

export const DEV_SHOW_OTP = process.env.EXPO_PUBLIC_DEV_SHOW_OTP === 'true';

function parseLatLng(raw?: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export const DEMO_FALLBACK_LOCATION = parseLatLng(process.env.EXPO_PUBLIC_DEMO_FALLBACK_LOCATION);
