import { LogBox } from 'react-native';

/** Native Stripe SDK noise on emulators — not app bugs. */
if (__DEV__) {
  LogBox.ignoreLogs([
    'PushProvisioning dependency not found',
    'Could not find generated setter for class com.reactnativestripesdk',
    'ViewManagerPropertyUpdater',
    'new NativeEventEmitter',
    'Non-serializable values were found in the navigation state',
    'RNGoogleMobileAds',
    'google-mobile-ads',
  ]);
}
