import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = ScrollViewProps & {
  children: ReactNode;
  bottomInset?: number;
};

/** Web desktop: centered page column with website-style padding. */
export function ScreenScrollView({
  children,
  bottomInset = spacing.lg,
  contentContainerStyle,
  style,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  ...rest
}: Props): React.JSX.Element {
  const styles = useStyles();

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      gap: spacing.md,
    },
  })
);
