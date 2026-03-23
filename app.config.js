const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const appJson = require('./app.json');

const expo = appJson.expo || {};
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.mysuperhero.xyz';
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://superheroorealtime.onrender.com';
const appVariantRaw = (process.env.EXPO_PUBLIC_APP_VARIANT || process.env.APP_VARIANT || 'unified').trim().toLowerCase();
const appVariant = appVariantRaw === 'buyer' || appVariantRaw === 'helper' ? appVariantRaw : 'unified';
const variantMeta =
  appVariant === 'buyer'
    ? {
        name: 'Superherooo',
        slug: 'superheroo-citizen',
        androidPackage: 'com.helpinminutes.citizen',
        iosBundleIdentifier: 'com.helpinminutes.citizen',
        icon: './assets/icon-citizen.png',
        adaptiveIcon: './assets/adaptive-icon-citizen.png',
        adaptiveBackgroundColor: '#1D4ED8',
      }
    : appVariant === 'helper'
    ? {
        name: 'Partner',
        slug: 'superheroo-partner',
        androidPackage: 'com.helpinminutes.partner',
        iosBundleIdentifier: 'com.helpinminutes.partner',
        icon: './assets/icon-partner.png',
        adaptiveIcon: './assets/adaptive-icon-partner.png',
        adaptiveBackgroundColor: '#0B1220',
      }
    : {
        name: expo.name,
        slug: expo.slug,
        androidPackage: expo.android && expo.android.package ? expo.android.package : undefined,
        iosBundleIdentifier: expo.ios && expo.ios.bundleIdentifier ? expo.ios.bundleIdentifier : undefined,
        icon: expo.icon,
        adaptiveIcon:
          expo.android && expo.android.adaptiveIcon ? expo.android.adaptiveIcon.foregroundImage : undefined,
        adaptiveBackgroundColor:
          expo.android && expo.android.adaptiveIcon ? expo.android.adaptiveIcon.backgroundColor : undefined,
      };
const googleServicesFile = path.join(__dirname, 'google-services.json');
const hasGoogleServices =
  fs.existsSync(googleServicesFile) && fs.statSync(googleServicesFile).size > 0;
const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const plugins = Array.from(
  new Set([
    ...basePlugins,
    'expo-image-picker',
    'expo-location',
    'expo-document-picker',
    'expo-notifications',
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
  NSCameraUsageDescription: 'Allow Superherooo to access the camera for selfie verification.',
  NSPhotoLibraryUsageDescription: 'Allow Superherooo to access your photos for KYC and task selfies.',
  NSLocationWhenInUseUsageDescription: 'Allow Superherooo to access your location for nearby tasks.',
};

function withNetworkSecurity(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(__dirname, 'assets', 'network_security_config.xml');
      const dest = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
        'network_security_config.xml'
      );
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      return config;
    },
  ]);
}

function withManifestNetworkSecurity(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest?.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
}

function withAndroidBuildGradleCompat(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const appBuildGradle = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'build.gradle'
      );
      let source = await fs.promises.readFile(appBuildGradle, 'utf8');

      if (!source.includes('exclude group: "com.android.support", module: "support-compat"')) {
        source += `

configurations.all {
    exclude group: "com.android.support", module: "support-compat"
    exclude group: "com.android.support", module: "support-v4"
    exclude group: "com.android.support", module: "versionedparcelable"
    exclude group: "com.android.support", module: "localbroadcastmanager"
    exclude group: "com.android.support", module: "customview"
}
`;
      }

      const legacyResourceExcludes = `resources {
            excludes += [
                "META-INF/*.version",
                "META-INF/androidx.legacy_legacy-support-core-ui.version",
                "META-INF/androidx.legacy_legacy-support-core-utils.version",
                "META-INF/androidx.versionedparcelable_versionedparcelable.version",
                "META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version",
                "META-INF/androidx.customview_customview.version",
                "META-INF/androidx.drawerlayout_drawerlayout.version"
            ]
        }`;

      if (!source.includes('META-INF/androidx.customview_customview.version')) {
        source = source.replace(
          /packagingOptions\s*\{\s*jniLibs\s*\{[\s\S]*?useLegacyPackaging enableLegacyPackaging\.toBoolean\(\)\s*\}\s*\}/m,
          (match) => {
            if (match.includes('resources {')) {
              return match;
            }
            return match.replace(/\}\s*$/, `\n        ${legacyResourceExcludes}\n    }`);
          }
        );
      }

      await fs.promises.writeFile(appBuildGradle, source, 'utf8');
      return config;
    },
  ]);
}

module.exports = {
  expo: {
    ...expo,
    name: variantMeta.name || expo.name,
    slug: variantMeta.slug || expo.slug,
    icon: variantMeta.icon || expo.icon,
    plugins: [
      ...plugins,
      withNetworkSecurity,
      withManifestNetworkSecurity,
      withAndroidBuildGradleCompat,
    ],
    extra: {
      ...(expo.extra || {}),
      apiBaseUrl,
      socketUrl,
      googleMapsApiKey,
      sentryDsn,
      appVariant,
    },
    android: {
      ...(expo.android || {}),
      package: variantMeta.androidPackage || (expo.android && expo.android.package ? expo.android.package : undefined),
      googleServicesFile: hasGoogleServices ? googleServicesFile : undefined,
      usesCleartextTraffic: true,
      permissions: androidPermissions,
      config: {
        ...(expo.android && expo.android.config ? expo.android.config : {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      adaptiveIcon: {
        foregroundImage:
          variantMeta.adaptiveIcon ||
          (expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.foregroundImage) ||
          './assets/adaptive-icon.png',
        backgroundColor:
          variantMeta.adaptiveBackgroundColor ||
          (expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.backgroundColor) ||
          '#1E3A8A',
      },
    },
    ios: {
      ...(expo.ios || {}),
      bundleIdentifier:
        variantMeta.iosBundleIdentifier || (expo.ios && expo.ios.bundleIdentifier ? expo.ios.bundleIdentifier : undefined),
      infoPlist: iosInfoPlist,
      config: {
        ...(expo.ios && expo.ios.config ? expo.ios.config : {}),
        googleMapsApiKey,
      },
    },
  },
};
