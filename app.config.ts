import fs from 'node:fs';
import path from 'node:path';
import type { ExpoConfig } from 'expo/config';
import type { ConfigPlugin } from 'expo/config-plugins';
import { withProjectBuildGradle } from 'expo/config-plugins';

type ExpoPlugin = NonNullable<ExpoConfig['plugins']>[number] | ConfigPlugin;
type AppExpoConfig = Omit<ExpoConfig, 'plugins'> & { plugins?: ExpoPlugin[] };

/** EAS cloud builds target real devices; local Windows emulator builds stay x86_64-only. */
const isEasBuild = process.env.EAS_BUILD === 'true';

// FCM credentials are only needed for Android push delivery (see docs/00-Developer_Setup.md
// §8b) — everything else about the app works fine without them. Only set
// `googleServicesFile` when that file actually exists, so a fresh clone / buyer who hasn't
// set up Firebase yet can still run `expo prebuild`/`android:build` for every other feature
// instead of hard-crashing with an ENOENT from the google-services config plugin.
const googleServicesJsonPath = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const hasGoogleServicesJson = fs.existsSync(path.resolve(process.cwd(), googleServicesJsonPath));

const easProjectId = process.env.EAS_PROJECT_ID;
const expoOwner = process.env.EXPO_OWNER ?? 'your-eas-account';
const expoSlug = process.env.EXPO_SLUG ?? 'local-marketplace';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const appDisplayName = process.env.APP_DISPLAY_NAME ?? 'Local Marketplace';
const appScheme = process.env.APP_SCHEME ?? 'localmarketplace';
const appDomain = process.env.APP_DOMAIN ?? 'yourdomain.com';
const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@yourdomain.com';
const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.example.localmarketplace';
const androidPackage = process.env.ANDROID_PACKAGE ?? 'com.example.localmarketplace';
const iosMerchantIdentifier =
  process.env.IOS_MERCHANT_IDENTIFIER ?? `merchant.${iosBundleIdentifier}`;
const admobAndroidAppId =
  process.env.ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-3940256099942544~3347511713';
const admobIosAppId =
  process.env.ADMOB_IOS_APP_ID ?? 'ca-app-pub-3940256099942544~1458002511';

function googleIosUrlScheme(webClientId: string | undefined): string | undefined {
  if (!webClientId?.endsWith('.apps.googleusercontent.com')) return undefined;
  const id = webClientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${id}`;
}

const googleIosScheme = googleIosUrlScheme(googleWebClientId);
const webBasePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH?.trim();
const androidNdkVersionBlockId = 'local-marketplace-android-ndk-version';

const withConsistentAndroidNdkVersion: ConfigPlugin = (expoConfig) =>
  withProjectBuildGradle(expoConfig, (config) => {
    if (config.modResults.language !== 'groovy') return config;

    const block = `// @generated begin ${androidNdkVersionBlockId}
// Keep every Android app/library module on React Native's NDK version.
subprojects { subproject ->
  ['com.android.application', 'com.android.library'].each { androidPlugin ->
    subproject.plugins.withId(androidPlugin) {
      subproject.extensions.configure('android') { androidExt ->
        androidExt.ndkVersion = rootProject.ext.ndkVersion
      }
    }
  }
}

// Google Mobile Ads SDK 25.x is compiled with newer Kotlin metadata than this
// Expo/RN stack checks by default. Scope the compatibility flag to the Ads
// module so the rest of the native build keeps strict Kotlin metadata checks.
subprojects { subproject ->
  if (subproject.name == 'react-native-google-mobile-ads') {
    subproject.tasks.matching { task ->
      task.name in ['compileDebugKotlin', 'compileReleaseKotlin']
    }.configureEach { task ->
      if (task.hasProperty('kotlinOptions') &&
          !task.kotlinOptions.freeCompilerArgs.contains('-Xskip-metadata-version-check')) {
        task.kotlinOptions.freeCompilerArgs += '-Xskip-metadata-version-check'
      }
    }
  }
}
// @generated end ${androidNdkVersionBlockId}`;
    const existingBlock = new RegExp(
      `\\n?// @generated begin ${androidNdkVersionBlockId}[\\s\\S]*?// @generated end ${androidNdkVersionBlockId}\\n?`,
      'm'
    );

    config.modResults.contents = `${config.modResults.contents
      .replace(existingBlock, '')
      .trimEnd()}\n\n${block}\n`;
    return config;
  });

const config: AppExpoConfig = {
  name: appDisplayName,
  slug: expoSlug,
  // Set this to your own Expo/EAS account username after `eas init`.
  owner: expoOwner,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/splash-icon.png',
  scheme: appScheme,
  userInterfaceStyle: 'automatic',
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    appIdentity: { appDisplayName, appScheme, appDomain, supportEmail, iosMerchantIdentifier },
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
  ...(easProjectId
    ? {
        updates: {
          url: `https://u.expo.dev/${easProjectId}`,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        },
      }
    : {}),
  // SDK 55+ is New Architecture-only. Keep local Windows builds x86_64-only below
  // for lighter emulator builds; EAS cloud builds still include real-device ABIs.
  ios: {
    supportsTablet: false,
    bundleIdentifier: iosBundleIdentifier,
    buildNumber: '1',
    associatedDomains: [`applinks:${appDomain}`],
    // Adds the "Sign In with Apple" capability + entitlement (required once the
    // app offers other account-creation methods — App Store Guideline 4.8).
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        `${appDisplayName} uses the camera when you choose to take listing photos.`,
      NSPhotoLibraryUsageDescription:
        `${appDisplayName} needs photo library access so you can add images to listings.`,
      NSPhotoLibraryAddUsageDescription:
        `${appDisplayName} may save processed listing photos to your library when you choose to.`,
      NSLocationWhenInUseUsageDescription:
        `${appDisplayName} uses your approximate location to show listings near your ZIP code.`,
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyTracking: false,
    },
  },
  android: {
    versionCode: 1,
    // FCM config for push. Local builds read the repo file; EAS overrides via a
    // file-type env var (GOOGLE_SERVICES_JSON) so the secret never lives in git.
    // Omitted entirely when the file doesn't exist yet — see hasGoogleServicesJson above.
    ...(hasGoogleServicesJson ? { googleServicesFile: googleServicesJsonPath } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0F',
    },
    package: androidPackage,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [
          { scheme: appScheme, pathPrefix: '/callback' },
          { scheme: appScheme, pathPrefix: '/auth/callback' },
          { scheme: appScheme, pathPrefix: '/reset-password' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: appDomain, pathPrefix: '/callback' },
          { scheme: 'https', host: appDomain, pathPrefix: '/auth/callback' },
          { scheme: 'https', host: appDomain, pathPrefix: '/reset-password' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  ...(webBasePath ? { experiments: { baseUrl: webBasePath } } : {}),
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          buildArchs: isEasBuild ? ['arm64-v8a', 'armeabi-v7a', 'x86_64'] : ['x86_64'],
        },
      },
    ],
    withConsistentAndroidNdkVersion,
    'expo-updates',
    'expo-asset',
    'expo-font',
    'expo-image',
    ...(googleIosScheme
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: googleIosScheme },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
    'expo-router',
    'expo-status-bar',
    [
      'expo-splash-screen',
      {
        image: './assets/logo-mark.png',
        backgroundColor: '#0A0A0F',
        imageWidth: 200,
      },
    ],
    'expo-web-browser',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/logo-mark.png',
        color: '#0A0A0F',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          `${appDisplayName} needs access to your photos so you can add images to listings.`,
        // The marketplace only selects still images; do not request Android RECORD_AUDIO.
        microphonePermission: false,
        // Android crop toolbar defaults can be invisible in light mode.
        colors: {
          cropToolbarColor: '#FFFFFF',
          cropToolbarIconColor: '#1A1A1A',
          cropToolbarActionTextColor: '#1A1A1A',
          cropBackButtonIconColor: '#1A1A1A',
          cropBackgroundColor: '#000000',
        },
        dark: {
          colors: {
            cropToolbarColor: '#1A1A1A',
            cropToolbarIconColor: '#FFFFFF',
            cropToolbarActionTextColor: '#FFFFFF',
            cropBackButtonIconColor: '#FFFFFF',
            cropBackgroundColor: '#000000',
          },
        },
      },
    ],
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: iosMerchantIdentifier,
        enableGooglePay: false,
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        // Google's public test app IDs — replace with your own AdMob app IDs before release.
        androidAppId: admobAndroidAppId,
        iosAppId: admobIosAppId,
      },
    ],
    [
      'expo-tracking-transparency',
      {
        userTrackingPermission:
          `${appDisplayName} uses this identifier to deliver relevant ads and measure ad performance.`,
      },
    ],
  ],
};

export default config;
