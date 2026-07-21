import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Opens the photo library for listing uploads.
 * Android emulators often lack the system Photo Picker (`PICK_IMAGES`); legacy uses GET_CONTENT.
 */
export async function pickListingPhotosFromLibrary(
  selectionLimit: number
): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 1,
    exif: false,
    legacy: Platform.OS === 'android',
  });
}

export async function requestListingPhotoLibraryPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}
