import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = ScrollViewProps & {
  children: ReactNode;
  /** Extra bottom padding below content (above tab bar). */
  bottomInset?: number;
};

/** Full-height scroll container — content grows with screen, scrolls when taller. */
export function ScreenScrollView({
  children,
  bottomInset = spacing.xl * 2,
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
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      padding: spacing.lg,
      gap: spacing.md,
    },
  })
);
