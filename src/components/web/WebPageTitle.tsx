import { View, Text, StyleSheet } from 'react-native';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  title: string;
  subtitle?: string;
};

/** Marketplace-style page heading for desktop web tab routes. */
export function WebPageTitle({ title, subtitle }: Props): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: {
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: fontSize.h1,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    subtitle: {
      marginTop: spacing.xs,
      fontSize: fontSize.body,
      color: colors.textSecondary,
    },
  })
);
