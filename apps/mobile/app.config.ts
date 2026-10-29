import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
loadEnv({ path: join(__dirname, '.env.local'), quiet: true });
import type { ExpoConfig } from 'expo/config';
const isDemo = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const api = process.env.EXPO_PUBLIC_API_URL;
if (!isDemo && (!api || !api.startsWith('https://')))
  throw new Error('EXPO_PUBLIC_API_URL HTTPS obligatoire hors démonstration.');
const config: ExpoConfig = {
  name: 'SOS DOCTEURS',
  slug: 'sos-docteurs',
  version: '0.1.0',
  orientation: 'default',
  scheme: 'sosdocteurs',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#F5F8F6' },
  android: {
    package: 'bj.sosdocteurs.mobile',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#F5F8F6' },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
    ],
  },
  plugins: [
    './plugins/with-release-signing.cjs',
    ['expo-secure-store', { configureAndroidBackup: true }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Ajouter un point d’intervention à votre demande. Vous pouvez toujours saisir l’adresse manuellement.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 24,
          buildToolsVersion: '36.0.0',
          usesCleartextTraffic: isDemo,
        },
      },
    ],
  ],
  extra: { demo: isDemo },
  experiments: {},
};
export default config;
