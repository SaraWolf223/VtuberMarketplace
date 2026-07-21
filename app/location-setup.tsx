import { Redirect } from 'expo-router';
import { useAuthContext } from '@/providers/AuthProvider';
import { LocationSetupScreen } from '@/screens/LocationSetupScreen';

/** Legacy route — redirects to the catalog (geo discovery removed). */
export default function LocationSetupRoute(): React.JSX.Element {
  const { isSignedIn } = useAuthContext();
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }
  return <LocationSetupScreen isOnboarding />;
}
