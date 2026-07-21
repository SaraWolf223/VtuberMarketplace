const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const admobCommonJs = path.join(
  __dirname,
  'node_modules',
  'react-native-google-mobile-ads',
  'lib',
  'commonjs',
  'index.js'
);

const googleSignInEntry = path.join(
  __dirname,
  'node_modules',
  '@react-native-google-signin',
  'google-signin',
  'lib',
  'module',
  'index.js'
);

const zustandRoot = path.join(__dirname, 'node_modules', 'zustand');

function resolveZustandCommonJs(moduleName) {
  if (moduleName === 'zustand') {
    return path.join(zustandRoot, 'index.js');
  }
  if (moduleName.startsWith('zustand/')) {
    return path.join(zustandRoot, `${moduleName.slice('zustand/'.length)}.js`);
  }
  return null;
}

const defaultResolveRequest = config.resolver.resolveRequest;

/**
 * Metro prefers package.json "react-native": "src/index.ts" (missing in publish).
 * Force the compiled CommonJS entry instead.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const zustandPath = resolveZustandCommonJs(moduleName);
    if (zustandPath && fs.existsSync(zustandPath)) {
      return { type: 'sourceFile', filePath: zustandPath };
    }
  }
  if (
    (moduleName === 'react-native-google-mobile-ads' ||
      moduleName.startsWith('react-native-google-mobile-ads/')) &&
    fs.existsSync(admobCommonJs)
  ) {
    return { type: 'sourceFile', filePath: admobCommonJs };
  }
  if (
    (moduleName === '@react-native-google-signin/google-signin' ||
      moduleName.startsWith('@react-native-google-signin/google-signin/')) &&
    fs.existsSync(googleSignInEntry)
  ) {
    return { type: 'sourceFile', filePath: googleSignInEntry };
  }
  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
