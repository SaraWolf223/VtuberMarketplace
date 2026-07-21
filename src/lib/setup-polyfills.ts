/**
 * Required for Supabase PKCE (SHA-256 code challenge) on React Native.
 * Without subtle crypto, auth falls back to "plain" and Google OAuth can fail.
 */
import 'react-native-get-random-values';
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';
import { installWebAlertShim } from '@/lib/cross-platform-alert';

function hexToBuffer(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

function ensureWebCrypto(): void {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };

  if ((g as { __cryptoPatched?: boolean }).__cryptoPatched) {
    return;
  }

  if (typeof g.crypto?.subtle?.digest === 'function') {
    (g as { __cryptoPatched?: boolean }).__cryptoPatched = true;
    return;
  }

  // On web, `window.crypto` is a read-only accessor and `crypto.subtle` is only
  // exposed in secure contexts (HTTPS or localhost). Assigning `g.crypto` here
  // throws ("Cannot set property crypto … which has only a getter") and crashes
  // boot on insecure origins (e.g. http://<lan-ip>:8081). Don't patch it — and
  // don't shim a broken expo-based digest (expo-crypto's web path also needs
  // subtle); supabase-js falls back to plain PKCE when subtle is unavailable.
  if (Platform.OS === 'web') {
    (g as { __cryptoPatched?: boolean }).__cryptoPatched = true;
    return;
  }

  const subtle = {
    async digest(_algorithm: AlgorithmIdentifier, data: ArrayBuffer): Promise<ArrayBuffer> {
      const text = new TextDecoder().decode(data);
      const hex = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        text,
        { encoding: ExpoCrypto.CryptoEncoding.HEX }
      );
      return hexToBuffer(hex);
    },
  };

  try {
    g.crypto = {
      ...(g.crypto ?? {}),
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = ExpoCrypto.getRandomValues(new Uint8Array(array.byteLength));
        const target = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        target.set(bytes.subarray(0, target.length));
        return array;
      },
      subtle,
    } as Crypto;
  } catch {
    // Some runtimes expose a read-only `crypto`; shim just `subtle` instead.
    try {
      Object.defineProperty(g.crypto as Crypto, 'subtle', { value: subtle, configurable: true });
    } catch {
      /* give up — auth will fall back to plain PKCE */
    }
  }
  (g as { __cryptoPatched?: boolean }).__cryptoPatched = true;
}

ensureWebCrypto();
installWebAlertShim();
