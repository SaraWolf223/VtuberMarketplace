import { LocationSetupScreen } from '@/screens/LocationSetupScreen';

/** Root-level ZIP onboarding (reachable from auth stack without nested navigation). */
export default function LocationSetupRoute(): React.JSX.Element {
  return <LocationSetupScreen isOnboarding />;
}
