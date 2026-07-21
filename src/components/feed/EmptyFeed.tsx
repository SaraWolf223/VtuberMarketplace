import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  variant?: 'default' | 'college-only' | 'sold';
};

export function EmptyFeed({ variant = 'default' }: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  const copy =
    variant === 'college-only'
      ? {
          emoji: '🎓',
          title: 'No college seller listings',
          sub: 'Try turning off “College students only” or adjust your filters.',
        }
      : variant === 'sold'
        ? {
            emoji: '🏷️',
            title: 'No sold listings match',
            sub: 'Switch to Available to browse assets still for sale.',
          }
        : {
            emoji: '📦',
            title: 'No listings match your filters',
            sub: 'Try clearing filters or check back later for new VTuber assets.',
          };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{copy.emoji}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.sub}>{copy.sub}</Text>
      {variant === 'default' ? (
        <Pressable style={styles.button} onPress={() => router.push('/(tabs)/sell')}>
          <Text style={styles.buttonText}>Post a listing</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: { fontSize: 48 },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  sub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
