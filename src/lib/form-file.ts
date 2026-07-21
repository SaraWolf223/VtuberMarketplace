import { Platform } from 'react-native';

/**
 * Append a picked/compressed image to a multipart `FormData` so it uploads
 * correctly on BOTH native and web.
 *
 * React Native's `FormData` accepts the `{ uri, name, type }` shape and streams
 * the file from disk. On web that exact object has no special meaning, so
 * `FormData.append(field, { uri, ... })` coerces it to the string
 * "[object Object]" — the server then sees no `File` and rejects the request
 * ("file is required"). On web we must therefore fetch the URI (blob:/data:/http)
 * into a real `Blob` and append that.
 */
export async function appendUploadFile(
  form: FormData,
  field: string,
  uri: string,
  fileName: string,
  mimeType: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    const typed = blob.type ? blob : new Blob([blob], { type: mimeType });
    form.append(field, typed, fileName);
    return;
  }

  const nativeUri =
    uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
  form.append(field, { uri: nativeUri, name: fileName, type: mimeType } as unknown as Blob);
}
