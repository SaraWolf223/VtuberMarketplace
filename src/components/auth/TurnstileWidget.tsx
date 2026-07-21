import { useEffect, useRef, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

/**
 * Cloudflare Turnstile bot check for the email/password sign-up form (Phase 9
 * white-label plan). Web-only: Turnstile needs a real DOM widget, which
 * react-native-web provides on web builds but native iOS/Android don't have
 * an equivalent for. Native sign-up instead relies on the existing IP/email
 * rate limiting plus app-store distribution (installing the app is already a
 * meaningfully higher bar than an open web form).
 *
 * Renders nothing (and `onToken` is never called) when
 * `EXPO_PUBLIC_TURNSTILE_SITE_KEY` isn't set, so sign-up keeps working before
 * a buyer configures Cloudflare — same fallback pattern used elsewhere.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }): React.JSX.Element | null {
  const siteKey = (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
  const containerRef = useRef<View>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !siteKey) return;

    let widgetId: string | undefined;
    let cancelled = false;

    function render() {
      const w = window as unknown as {
        turnstile?: {
          render: (
            el: Element,
            opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }
          ) => string;
        };
      };
      // react-native-web forwards View refs directly to the underlying DOM node.
      const node = containerRef.current as unknown as Element | null;
      if (cancelled || !w.turnstile || !node || !(node instanceof Element)) return;
      widgetId = w.turnstile.render(node, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
      });
      setReady(true);
    }

    const existing = document.getElementById('cf-turnstile-script');
    if (existing && (window as unknown as { turnstile?: unknown }).turnstile) {
      render();
    } else if (existing) {
      existing.addEventListener('load', render, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = 'cf-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', render, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      const w = window as unknown as { turnstile?: { remove: (id: string) => void } };
      if (widgetId && w.turnstile) {
        try {
          w.turnstile.remove(widgetId);
        } catch {
          /* widget already gone */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (Platform.OS !== 'web' || !siteKey) return null;

  return <View ref={containerRef} style={ready ? styles.wrap : styles.hidden} />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, alignItems: 'center' },
  hidden: { height: 0 },
});
