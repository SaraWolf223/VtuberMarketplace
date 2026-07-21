import Constants, { ExecutionEnvironment } from 'expo-constants';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** True on dev/EAS builds when web client ID is configured (no native module import). */
export function isNativeGoogleSignInAvailable(): boolean {
  return !isExpoGo() && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}
