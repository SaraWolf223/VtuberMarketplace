import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { syncProfileFromAuthUser } from '@/features/auth/syncProfileFromAuthUser';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function webClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

let configured = false;

/** Loaded on demand so Metro does not require the native module at app startup. */
async function loadGoogleSignIn() {
  return import('@react-native-google-signin/google-signin');
}

/** Path B — native Google token → Supabase (prompt 02b). Requires dev/production build, not Expo Go. */
export async function signInWithGoogleNative(): Promise<void> {
  if (isExpoGo()) {
    throw new Error(
      'Native Google sign-in requires a development build (npm run android or EAS). Use browser sign-in in Expo Go.'
    );
  }

  const clientId = webClientId();
  if (!clientId) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env for native Google sign-in.');
  }

  const { GoogleSignin } = await loadGoogleSignIn();

  if (!configured) {
    GoogleSignin.configure({
      webClientId: clientId,
      offlineAccess: false,
    });
    configured = true;
  }

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const result = await GoogleSignin.signIn();

  if (result.type === 'cancelled') {
    throw new Error('Sign-in cancelled');
  }

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token. Check webClientId matches Google Cloud OAuth client.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from Supabase');

  await syncProfileFromAuthUser(data.user);
}

export { isNativeGoogleSignInAvailable } from '@/lib/auth/google-native-availability';
