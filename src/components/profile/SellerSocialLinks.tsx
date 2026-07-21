import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import type { SocialLinks } from '@/features/profile/portfolio-service';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  websiteUrl?: string | null;
  portfolioUrl?: string | null;
  socialLinks?: SocialLinks | null;
};

const LABELS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitch', label: 'Twitch' },
  { key: 'discord', label: 'Discord' },
  { key: 'booth', label: 'Booth' },
  { key: 'other', label: 'Other' },
];

export function SellerSocialLinks({
  websiteUrl,
  portfolioUrl,
  socialLinks,
}: Props): React.JSX.Element | null {
  const styles = useStyles();
  const links: { label: string; url: string }[] = [];
  if (portfolioUrl) links.push({ label: 'Portfolio', url: portfolioUrl });
  if (websiteUrl) links.push({ label: 'Website', url: websiteUrl });
  for (const { key, label } of LABELS) {
    const url = socialLinks?.[key];
    if (url) links.push({ label, url });
  }
  if (links.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {links.map((l) => (
        <Pressable
          key={`${l.label}-${l.url}`}
          style={styles.chip}
          onPress={() => void Linking.openURL(l.url)}
        >
          <Text style={styles.chipText}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.sm,
      width: '100%',
    },
    chip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.full ?? 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
  })
);
