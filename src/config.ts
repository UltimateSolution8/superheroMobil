import Constants from 'expo-constants';
import * as Application from 'expo-application';

const expoConfig =
  (Constants.expoConfig as
    | {
        name?: string;
        slug?: string;
        android?: { package?: string };
        extra?: Record<string, unknown>;
      }
    | null) ||
  ((Constants as unknown as {
    manifest?: {
      name?: string;
      slug?: string;
      android?: { package?: string };
      extra?: Record<string, unknown>;
    };
  }).manifest ?? null) ||
  ((Constants as unknown as {
    manifest2?: {
      name?: string;
      slug?: string;
      android?: { package?: string };
      extra?: Record<string, unknown>;
    };
  }).manifest2 ?? null);

const extra = (expoConfig && expoConfig.extra) || {};
const apiFromExtra = typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl.trim() : '';
const socketFromExtra = typeof extra.socketUrl === 'string' ? extra.socketUrl.trim() : '';
const mapsFromExtra = typeof extra.googleMapsApiKey === 'string' ? extra.googleMapsApiKey.trim() : '';
const presignedFromExtra = typeof extra.enablePresignedSelfies === 'string'
  ? extra.enablePresignedSelfies.trim()
  : typeof extra.enablePresignedSelfies === 'boolean'
  ? String(extra.enablePresignedSelfies)
  : '';
const appVariantFromExtra = typeof extra.appVariant === 'string' ? extra.appVariant.trim() : '';
const appVariantFromEnv = process.env.EXPO_PUBLIC_APP_VARIANT?.trim() || '';
const applicationId = Application.applicationId || '';
const packageFromExpoConfig =
  expoConfig && expoConfig.android && typeof expoConfig.android.package === 'string'
    ? expoConfig.android.package.trim()
    : '';
const appNameFromExpoConfig = expoConfig && typeof expoConfig.name === 'string' ? expoConfig.name.trim() : '';
const appSlugFromExpoConfig = expoConfig && typeof expoConfig.slug === 'string' ? expoConfig.slug.trim() : '';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || apiFromExtra || 'https://api.mysuperhero.xyz';

const presignedEnv = process.env.EXPO_PUBLIC_ENABLE_PRESIGNED_SELFIES?.trim();
export const ENABLE_PRESIGNED_SELFIES =
  presignedEnv ? presignedEnv === 'true' : presignedFromExtra ? presignedFromExtra === 'true' : false;

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim() ||
  socketFromExtra ||
  'https://superheroorealtime.onrender.com';

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || mapsFromExtra || '';

export const DEV_SHOW_OTP = process.env.EXPO_PUBLIC_DEV_SHOW_OTP === 'true';

export type AppVariant = 'unified' | 'buyer' | 'helper';

function normalizeAppVariant(raw?: string | null): AppVariant {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'buyer') return 'buyer';
  if (value === 'helper') return 'helper';
  return 'unified';
}

function inferVariantFromAppId(raw?: string | null): AppVariant {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'com.helpinminutes.citizen') return 'buyer';
  if (value === 'com.helpinminutes.partner') return 'helper';
  if (value.includes('citizen') || value.includes('buyer')) return 'buyer';
  if (value.includes('partner') || value.includes('helper') || value.includes('superheroo.partner')) return 'helper';
  return 'unified';
}

function inferVariantFromName(raw?: string | null): AppVariant {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return 'unified';
  if (value.includes('citizen') || value.includes('buyer')) return 'buyer';
  if (value.includes('partner') || value.includes('helper')) return 'helper';
  return 'unified';
}

export const APP_VARIANT = normalizeAppVariant(
  // In release APKs, rely on app.config extra + package inference first.
  // This avoids accidental cross-build env leakage (buyer/helper) from JS bundling.
  (appVariantFromExtra && appVariantFromExtra.toLowerCase() !== 'unified'
    ? appVariantFromExtra
    : inferVariantFromAppId(applicationId) ||
      inferVariantFromAppId(packageFromExpoConfig) ||
      inferVariantFromName(appNameFromExpoConfig) ||
      inferVariantFromName(appSlugFromExpoConfig) ||
      (appVariantFromEnv && appVariantFromEnv.toLowerCase() !== 'unified' ? appVariantFromEnv : '')) ||
    'unified',
);

export const LOCKED_ROLE: 'BUYER' | 'HELPER' | null =
  APP_VARIANT === 'buyer' ? 'BUYER' : APP_VARIANT === 'helper' ? 'HELPER' : null;

export const APP_DISPLAY_NAME =
  APP_VARIANT === 'buyer'
    ? 'Superherooo'
    : APP_VARIANT === 'helper'
    ? 'Partner'
    : 'Superherooo';

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
