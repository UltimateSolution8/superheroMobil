const appJson = require('./app.json');

const expo = appJson.expo || {};
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const plugins = Array.from(
  new Set([
    ...basePlugins,
    'expo-image-picker',
    'expo-location',
    'expo-document-picker',
  ])
);
const androidPermissions = Array.from(
  new Set([
    ...(expo.android && Array.isArray(expo.android.permissions) ? expo.android.permissions : []),
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION',
    'FOREGROUND_SERVICE',
    'CAMERA',
    'READ_MEDIA_IMAGES',
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'INTERNET',
  ]),
);
const iosInfoPlist = {
  ...(expo.ios && expo.ios.infoPlist ? expo.ios.infoPlist : {}),
  NSCameraUsageDescription: 'Allow Superheroo to access the camera for selfie verification.',
  NSPhotoLibraryUsageDescription: 'Allow Superheroo to access your photos for KYC and task selfies.',
  NSLocationWhenInUseUsageDescription: 'Allow Superheroo to access your location for nearby tasks.',
};

module.exports = {
  expo: {
    ...expo,
    plugins,
    extra: {
      ...(expo.extra || {}),
      googleMapsApiKey,
    },
    android: {
      ...(expo.android || {}),
      permissions: androidPermissions,
      config: {
        ...(expo.android && expo.android.config ? expo.android.config : {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...(expo.ios || {}),
      infoPlist: iosInfoPlist,
      config: {
        ...(expo.ios && expo.ios.config ? expo.ios.config : {}),
        googleMapsApiKey,
      },
    },
  },
};
