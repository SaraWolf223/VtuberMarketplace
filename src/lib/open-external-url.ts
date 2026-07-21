import { Alert, Linking } from 'react-native';
import { isValidHttpsUrl } from '@/lib/url-validation';

/** Open HTTPS links with client-side validation. */
export async function openTrustedHttpsUrl(url: string, label = 'link'): Promise<boolean> {
  const trimmed = url.trim();
  if (!isValidHttpsUrl(trimmed)) {
    Alert.alert('Invalid link', `This ${label} is not a valid HTTPS URL.`);
    return false;
  }

  try {
    await Linking.openURL(trimmed);
    return true;
  } catch {
    Alert.alert('Could not open link', 'Try again later.');
    return false;
  }
}
