import type { ReactNode } from 'react';
import { View, StyleSheet , Platform } from 'react-native';
import { WebPageTitle } from '@/components/web/WebPageTitle';
import { useWebViewport } from '@/hooks/useWebViewport';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/** Adds a website-style page header on desktop web; no-op on native / mobile web. */
export function WebDesktopPage({ title, subtitle, children }: Props): React.JSX.Element {
  const { isDesktopWeb } = useWebViewport();
  const styles = useStyles();

  if (Platform.OS !== 'web' || !isDesktopWeb) {
    return <>{children}</>;
  }

  return (
    <View style={styles.page}>
      {title ? <WebPageTitle title={title} subtitle={subtitle} /> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const useStyles = () =>
  StyleSheet.create({
    page: {
      flex: 1,
      width: '100%',
    },
    body: {
      flex: 1,
      width: '100%',
    },
  });
