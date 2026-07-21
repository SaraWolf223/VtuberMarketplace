import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import type { ProfileRow } from '@/features/profile/profile-service';
import { AVATAR_LIMITS_LABEL } from '@/features/profile/avatar-service';
import { AvatarRing } from '@/components/profile/AvatarRing';
import { isPremiumActive } from '@/features/monetization/premium-service';

type Props = {
  profile: ProfileRow;
  displayName: string;
  onChangeDisplayName: (value: string) => void;
  onSaveDisplayName: () => void;
  onChangePhoto: () => void;
  savingName: boolean;
  uploadingPhoto: boolean;
};

export function SettingsProfileSection({
  profile,
  displayName,
  onChangeDisplayName,
  onSaveDisplayName,
  onChangePhoto,
  savingName,
  uploadingPhoto,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const busy = uploadingPhoto || savingName;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.avatarTap}
        onPress={onChangePhoto}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        <AvatarRing
          size={104}
          isAdmin={profile.role === 'admin'}
          isPremium={isPremiumActive(profile.is_premium, profile.premium_until)}
        >
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {profile.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </AvatarRing>
        {uploadingPhoto ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.hintCenter}>Tap photo to crop & update ({AVATAR_LIMITS_LABEL})</Text>

      <Text style={styles.fieldLabel}>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={onChangeDisplayName}
        maxLength={50}
        autoCapitalize="words"
      />
      <Text style={styles.hint}>Shown on your profile and listings.</Text>
      <Pressable style={styles.button} onPress={onSaveDisplayName} disabled={busy}>
        {savingName ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Save display name</Text>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    width: '100%',
  },
  avatarTap: {
    position: 'relative',
    marginTop: spacing.sm,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    backgroundColor: colors.priceBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.background,
  },
  editBadgeText: {
    color: colors.onPrimary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  hintCenter: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fieldLabel: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  hint: {
    alignSelf: 'stretch',
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
