import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import {
  updateSellerProfileLinks,
  uploadPortfolioImage,
  fetchSellerPortfolioItems,
  portfolioPublicUrl,
  type SocialLinks,
  type PortfolioItem,
} from '@/features/profile/portfolio-service';
import {
  pickListingPhotosFromLibrary,
  requestListingPhotoLibraryPermission,
} from '@/lib/listing-photo-picker';
import { compressListingPhoto } from '@/lib/image-compress';
import { Image } from 'expo-image';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SellerShopSettingsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { data: profile, refetch } = useProfile();
  const [website, setWebsite] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);
  const [showcase, setShowcase] = useState<PortfolioItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const p = profile as {
      id: string;
      website_url?: string | null;
      portfolio_url?: string | null;
      social_links?: SocialLinks | null;
    };
    setWebsite(p.website_url ?? '');
    setPortfolio(p.portfolio_url ?? '');
    setSocials(p.social_links ?? {});
    void fetchSellerPortfolioItems(p.id)
      .then(setShowcase)
      .catch(() => setShowcase([]));
  }, [profile]);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateSellerProfileLinks({
        website_url: website.trim() || null,
        portfolio_url: portfolio.trim() || null,
        social_links: socials,
      });
      await refetch();
      showAlert('Saved', 'Your shop profile links were updated.');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Sign in to edit your shop profile.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Shop profile' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Portfolio URL (required to publish)</Text>
        <TextInput
          style={styles.input}
          value={portfolio}
          onChangeText={setPortfolio}
          autoCapitalize="none"
          placeholder="https://…"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Website</Text>
        <TextInput
          style={styles.input}
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          placeholder="https://…"
          placeholderTextColor={colors.textMuted}
        />
        {(
          [
            ['twitter', 'X / Twitter'],
            ['youtube', 'YouTube'],
            ['twitch', 'Twitch'],
            ['discord', 'Discord'],
            ['booth', 'Booth'],
            ['other', 'Other'],
          ] as const
        ).map(([key, label]) => (
          <View key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={socials[key] ?? ''}
              onChangeText={(v) => setSocials((s) => ({ ...s, [key]: v }))}
              autoCapitalize="none"
              placeholder="https://…"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}
        <Text style={styles.label}>Showcase gallery (up to 6)</Text>
        <View style={styles.showcaseRow}>
          {showcase.map((item) => (
            <Image
              key={item.id}
              source={{ uri: portfolioPublicUrl(item.image_storage_path) }}
              style={styles.showcaseThumb}
            />
          ))}
        </View>
        <Pressable
          style={styles.secondary}
          disabled={uploading || showcase.length >= 6}
          onPress={async () => {
            const granted = await requestListingPhotoLibraryPermission();
            if (!granted) {
              showAlert('Photos', 'Allow photo access to upload showcase images.');
              return;
            }
            setUploading(true);
            try {
              const result = await pickListingPhotosFromLibrary(1);
              if (result.canceled || !result.assets?.[0]) return;
              const photo = await compressListingPhoto(result.assets[0]);
              const item = await uploadPortfolioImage(photo.uri, showcase.length);
              setShowcase((prev) => [...prev, item].slice(0, 6));
            } catch (e) {
              showAlert('Upload', e instanceof Error ? e.message : 'Upload failed');
            } finally {
              setUploading(false);
            }
          }}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryText}>
              {showcase.length >= 6 ? 'Showcase full' : 'Add showcase image'}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.button} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Save</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          Portfolio URL is required before publishing listings. Showcase gallery is optional (0–6).
        </Text>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    button: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    secondary: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    secondaryText: { color: colors.text, fontWeight: fontWeight.semibold },
    showcaseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    showcaseThumb: { width: 72, height: 72, borderRadius: radius.sm },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  })
);
