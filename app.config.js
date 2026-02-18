const { withAndroidManifest } = require('@expo/config-plugins');

function withGoogleMapsApiKey(config, apiKey) {
  if (!apiKey) return config;
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;
    app['meta-data'] = app['meta-data'] || [];
    const existing = app['meta-data'].find((item) => item.$?.['android:name'] === 'com.google.android.geo.API_KEY');
    if (existing) {
      existing.$['android:value'] = apiKey;
    } else {
      app['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': apiKey,
        },
      });
    }
    return config;
  });
}

module.exports = ({ config }) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

  const next = {
    ...config,
    extra: {
      ...(config.extra || {}),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || 'http://localhost:8090',
      googleMapsApiKey: apiKey,
    },
    android: {
      ...(config.android || {}),
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey,
        },
      },
      // Ensure react-native-maps can read the key from manifest meta-data.
      googleMapsApiKey: apiKey,
    },
  };

  return withGoogleMapsApiKey(next, apiKey);
};
