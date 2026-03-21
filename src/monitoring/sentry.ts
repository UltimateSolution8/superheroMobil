import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

type ExtraConfig = {
  sentryDsn?: string;
};

const expoConfig =
  (Constants.expoConfig as { extra?: ExtraConfig } | null) ||
  ((Constants as unknown as { manifest?: { extra?: ExtraConfig } }).manifest ?? null) ||
  ((Constants as unknown as { manifest2?: { extra?: ExtraConfig } }).manifest2 ?? null);

const dsnFromExtra = expoConfig?.extra?.sentryDsn?.trim() || '';
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || dsnFromExtra;
const tracesSampleRate = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '1.0');

declare global {
  // eslint-disable-next-line no-var
  var __SUPERHEROO_SENTRY_INIT__: boolean | undefined;
}

if (dsn && !global.__SUPERHEROO_SENTRY_INIT__) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 1.0,
    enableNativeFramesTracking: true,
    sendDefaultPii: true,
    environment: process.env.EXPO_PUBLIC_APP_ENV || (typeof __DEV__ !== 'undefined' && __DEV__ ? 'dev' : 'prod'),
  });
  global.__SUPERHEROO_SENTRY_INIT__ = true;
}

export { Sentry };

