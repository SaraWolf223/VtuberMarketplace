import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = {
  favorited: boolean;
  onToggle: () => void;
  loading?: boolean;
  size?: 'sm' | 'md';
};

export function FavoriteHeartButton({
  favorited,
  onToggle,
  loading,
  size = 'md',
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const isSm = size === 'sm';

  return (
    <Pressable
      style={[styles.btn, isSm && styles.btnSm]}
      onPress={(e) => {
        e?.stopPropagation?.();
        onToggle();
      }}
      disabled={loading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {loading ? (
        <ActivityIndicator size="small" color={favorited ? colors.error : colors.textMuted} />
      ) : (
        <Text style={[styles.icon, favorited && styles.iconOn, isSm && styles.iconSm]}>
          {favorited ? '♥' : '♡'}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  btn: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSm: { width: 34, height: 34 },
  icon: { fontSize: 22, color: colors.textMuted },
  iconSm: { fontSize: 18 },
  iconOn: { color: colors.error },
}));
