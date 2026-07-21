import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenScrollView } from '@/components/layout/ScreenScrollView';
import { WebDesktopPage } from '@/components/web/WebDesktopPage';
import { PageFooterAds } from '@/components/ads/PageFooterAds';
import { ThemedTextInput } from '@/components/ui/ThemedTextInput';
import { useAuth } from '@/hooks/useAuth';
import { useLocationPrefs } from '@/hooks/useLocationPrefs';
import { useDraftListingStore } from '@/stores/draft-listing-store';
import { compressListingPhoto } from '@/lib/image-compress';
import {
  pickListingPhotosFromLibrary,
  requestListingPhotoLibraryPermission,
} from '@/lib/listing-photo-picker';
import { listingSchema } from '@/features/listings/listing-schema';
import { categoryLabel } from '@/features/listings/category-labels';
import { useListingCategories } from '@/hooks/useListingCategories';
import type { ListingCategory } from '@/types/enums';
import {
  createListingDraft,
  uploadListingImage,
  finalizeListingImages,
  uploadAndSetFeedThumbnail,
} from '@/features/listings/listing-service';
import { updateListingMetadata } from '@/features/listings/my-listings-service';
import { invalidateFeedQueries } from '@/features/profile/prefs-service';
import { queryKeys } from '@/lib/query-keys';
import { parsePriceInput, sanitizePriceInput } from '@/utils/price-input';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import { PREMIUM_LISTINGS_PER_MONTH } from '@/constants/listings';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { useThemedInputStyles } from '@/theme/useThemedInputStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { showAlert } from '@/lib/cross-platform-alert';

const ALL_STEPS = ['Photos', 'Thumbnail', 'Details', 'ZIP', 'Publish'] as const;
type FlowStep = (typeof ALL_STEPS)[number];

export default function SellScreen(): React.JSX.Element {
  const styles = useStyles();
  const inputStyles = useThemedInputStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { homeZip } = useLocationPrefs();
  const { requireVerification } = usePhoneVerificationGate();
  const draft = useDraftListingStore();
  const listingCategories = useListingCategories();
  const [publishing, setPublishing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isEditing = !!draft.editListingId;
  const { listingsRemaining, listingsLimit, premiumActive } = useSellerBenefits();
  const homeZipClean = homeZip.replace(/\D/g, '').slice(0, 5);
  const skipZipStep = !isEditing && homeZipClean.length === 5;
  const flowSteps: readonly FlowStep[] = skipZipStep
    ? ['Photos', 'Thumbnail', 'Details', 'Publish']
    : ALL_STEPS;

  const step = Math.min(draft.step, flowSteps.length - 1);
  const currentStep = flowSteps[step];

  const pickPhotos = async (mode: 'gallery' | 'thumbnail' = 'gallery') => {
    const remaining = mode === 'thumbnail' ? 1 : 5 - draft.photos.length;
    if (remaining <= 0) {
      showAlert('Photos', 'You can add up to 5 gallery photos.');
      return;
    }

    const granted = await requestListingPhotoLibraryPermission();
    if (!granted) {
      showAlert('Photos', 'Allow photo access to add listing images.');
      return;
    }

    setPicking(true);
    try {
    const result = await pickListingPhotosFromLibrary(remaining);

      if (result.canceled || !result.assets?.length) return;

      const accepted: ReturnType<typeof useDraftListingStore.getState>['photos'] = [];
      const rejected: string[] = [];

      for (let index = 0; index < result.assets.length; index += 1) {
        const asset = result.assets[index];
        try {
          const photo = await compressListingPhoto(asset);
          accepted.push({
            ...photo,
            id: `${Date.now()}-${index}`,
          });
        } catch (e) {
          rejected.push(e instanceof Error ? e.message : 'Invalid photo');
        }
      }

      if (accepted.length) {
        if (mode === 'thumbnail') {
          draft.setFeedThumbnail(accepted[0]);
        } else {
          draft.addPhotos(accepted);
        }
      }
      if (rejected.length) {
        showAlert(
          'Some photos skipped',
          rejected.slice(0, 3).join('\n') +
            (rejected.length > 3 ? `\n…and ${rejected.length - 3} more.` : '')
        );
      }
    } catch (e) {
      showAlert('Photos', e instanceof Error ? e.message : 'Could not process photos');
    } finally {
      setPicking(false);
    }
  };

  const goNext = () => {
    if (currentStep === 'Photos' && draft.photos.length < 3) {
      showAlert('Photos', 'Add at least 3 gallery photos.');
      return;
    }
    if (currentStep === 'Thumbnail' && !draft.feedThumbnail) {
      showAlert('Thumbnail', 'Add a dedicated feed thumbnail (separate from gallery photos).');
      return;
    }
    if (currentStep === 'Details') {
      if (!validateDetailsFields()) return;
    }
    if (currentStep === 'ZIP') {
      const zip = draft.zipCode.replace(/\D/g, '').slice(0, 5);
      if (zip.length !== 5) {
        showAlert('ZIP', 'Enter a valid 5-digit US ZIP.');
        return;
      }
      draft.setZipCode(zip);
    }
    draft.setStep(Math.min(step + 1, flowSteps.length - 1));
  };

  const validateDetailsFields = (): boolean => {
    const price = parsePriceInput(draft.priceText);
    const parsed = listingSchema.safeParse({
      title: draft.title,
      description: draft.description || undefined,
      price: price ?? NaN,
      category: draft.category ?? undefined,
      zip_code: draft.zipCode || homeZipClean,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.errors) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const goBack = () => {
    if (step === 0) return;
    draft.setStep(step - 1);
  };

  const publish = async () => {
    if (!user || !session?.access_token) {
      showAlert('Sign in', 'Sign in to post a listing.');
      return;
    }

    if (!requireVerification('Publishing a listing')) {
      return;
    }

    const price = parsePriceInput(draft.priceText);
    const parsed = listingSchema.safeParse({
      title: draft.title,
      description: draft.description || undefined,
      price: price ?? NaN,
      category: draft.category,
      zip_code: draft.zipCode || homeZip,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.errors) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      showAlert('Listing', parsed.error.errors[0]?.message ?? 'Invalid listing');
      return;
    }

    if (draft.photos.length < 3) {
      showAlert('Photos', 'Add at least 3 gallery photos.');
      return;
    }
    if (!draft.feedThumbnail) {
      showAlert('Thumbnail', 'Add a dedicated feed thumbnail before publishing.');
      return;
    }

    if (!isEditing && listingsRemaining <= 0) {
      showAlert(
        'Monthly limit reached',
        premiumActive
          ? `Premium sellers can post ${listingsLimit} listings per month.`
          : `Free accounts can post ${listingsLimit} listings per month. Upgrade to Premium for ${PREMIUM_LISTINGS_PER_MONTH} posts.`
      );
      return;
    }

    setPublishing(true);
    try {
      if (isEditing && draft.editListingId) {
        await updateListingMetadata(session.access_token, draft.editListingId, parsed.data);
        invalidateFeedQueries(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ['my-listings'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.listing(draft.editListingId) });
        const listingId = draft.editListingId;
        draft.reset();
        showAlert('Saved', 'Your listing was updated.', [
          {
            text: 'View listing',
            onPress: () => router.push(`/listing/${listingId}`),
          },
          { text: 'OK' },
        ]);
        return;
      }

      const created = await createListingDraft(
        session.access_token,
        parsed.data,
        draft.photos.length
      );

      for (let i = 0; i < draft.photos.length; i += 1) {
        const slot = created.upload_urls.find((u) => u.sort_order === i);
        if (!slot) throw new Error('Missing upload slot from server');
        await uploadListingImage(slot.signed_url, draft.photos[i].uri, draft.photos[i].byteSize);
      }

      await finalizeListingImages(
        session.access_token,
        created.listing_id,
        draft.photos.map((photo, index) => ({
          sort_order: index,
          storage_path: created.upload_urls[index].storage_path,
          byte_size: photo.byteSize,
          width: photo.width,
          height: photo.height,
        }))
      );

      await uploadAndSetFeedThumbnail(
        session.access_token,
        user.id,
        created.listing_id,
        draft.feedThumbnail.uri,
        draft.feedThumbnail.byteSize
      );

      invalidateFeedQueries(queryClient, user.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });
      draft.reset();
      showAlert('Published', 'Your listing is live.', [
        {
          text: 'View listing',
          onPress: () => router.push(`/listing/${created.listing_id}`),
        },
        { text: 'OK' },
      ]);
    } catch (e) {
      showAlert('Publish failed', e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!draft.zipCode && homeZip) {
      draft.setZipCode(homeZip);
    }
    // Deliberately narrow deps to the two fields this effect actually reads/calls (both
    // listed above) instead of the whole `draft` object — `useDraftListingStore()` returns a
    // new object reference on every store field change (title, price, photos, ...), so
    // depending on `draft` itself would re-run this on every keystroke elsewhere in the form.
    // `setZipCode` is a stable action reference from the store, so this is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeZip, draft.zipCode, draft.setZipCode]);

  return (
    <WebDesktopPage title="Post a listing" subtitle="List a digital VTuber asset for sale">
      <ScreenScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{isEditing ? 'Edit listing' : 'Post a listing'}</Text>
      {isEditing ? (
        <Text style={styles.hint}>
          Photos stay as-is for now. Update details, ZIP, then save.
        </Text>
      ) : null}
      {!isEditing ? (
        <Text style={styles.quotaHint}>
          {listingsRemaining} of {listingsLimit} listings left this month
          {premiumActive ? ' (Premium)' : ''}
        </Text>
      ) : null}
      <Text style={styles.stepLabel}>
        Step {step + 1} of {flowSteps.length}: {currentStep}
      </Text>

      {currentStep === 'Thumbnail' ? (
        <View style={styles.section}>
          <Text style={styles.hint}>
            Feed thumbnail is shown on browse cards. It is separate from your ≥3 gallery photos.
          </Text>
          {draft.feedThumbnail ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: draft.feedThumbnail.uri }} style={styles.photo} />
              <Pressable
                style={styles.removePhoto}
                onPress={() => draft.setFeedThumbnail(null)}
                accessibilityLabel="Remove feed thumbnail"
              >
                <Text style={styles.removePhotoText}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void pickPhotos('thumbnail')}
            disabled={picking}
          >
            <Text style={styles.secondaryButtonText}>
              {draft.feedThumbnail ? 'Replace thumbnail' : 'Add feed thumbnail'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {currentStep === 'Photos' ? (
        <View style={styles.section}>
          {!isEditing ? (
            <Text style={styles.hint}>
              JPG/PNG/WebP only · up to 4096px · saved as JPEG under 2MB (max 2048px).
            </Text>
          ) : null}
          <View style={styles.photoGrid}>
            {draft.photos.map((photo) => (
              <View key={photo.id} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                {/* Edits don't touch photos server-side (see hint above) — removing
                    one here would only look like it worked, then silently revert. */}
                {!isEditing ? (
                  <Pressable
                    style={styles.removePhoto}
                    onPress={() => draft.removePhoto(photo.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          {!isEditing ? (
            <Pressable style={styles.secondaryButton} onPress={() => void pickPhotos('gallery')} disabled={picking}>
              {picking ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Add photos</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {currentStep === 'Details' ? (
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <ThemedTextInput
            value={draft.title}
            onChangeText={(text) => {
              draft.setTitle(text);
              if (fieldErrors.title) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.title;
                  return next;
                });
              }
            }}
            maxLength={80}
            placeholder="What are you selling?"
            accessibilityLabel="Listing title"
          />
          {fieldErrors.title ? <Text style={styles.fieldError}>{fieldErrors.title}</Text> : null}
          <Text style={styles.label}>Description (optional)</Text>
          <ThemedTextInput
            style={inputStyles.multiline}
            value={draft.description}
            onChangeText={draft.setDescription}
            maxLength={500}
            multiline
            placeholder="Asset details, setup notes, included files…"
          />
          <Text style={styles.label}>Price</Text>
          <View style={styles.priceRow}>
            <Text style={styles.pricePrefix}>$</Text>
            <ThemedTextInput
              style={styles.priceInput}
              value={draft.priceText}
              onChangeText={(t) => {
                draft.setPriceText(sanitizePriceInput(t));
                if (fieldErrors.price) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.price;
                    return next;
                  });
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              maxLength={8}
              accessibilityLabel="Listing price"
            />
          </View>
          {fieldErrors.price ? <Text style={styles.fieldError}>{fieldErrors.price}</Text> : null}
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {listingCategories.map(({ slug: cat }) => (
              <Pressable
                key={cat}
                style={[styles.chip, draft.category === cat && styles.chipActive]}
                onPress={() => {
                  draft.setCategory(cat as ListingCategory);
                  if (fieldErrors.category) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.category;
                      return next;
                    });
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.category === cat }}
                accessibilityLabel={categoryLabel(cat)}
              >
                <Text style={[styles.chipText, draft.category === cat && styles.chipTextActive]}>
                  {categoryLabel(cat)}
                </Text>
              </Pressable>
            ))}
          </View>
          {fieldErrors.category ? <Text style={styles.fieldError}>{fieldErrors.category}</Text> : null}
        </View>
      ) : null}

      {currentStep === 'ZIP' ? (
        <View style={styles.section}>
          <Text style={styles.hint}>
            Buyers see listings near this ZIP. Defaults to your home ZIP ({homeZipClean || 'not set'}
            ).
          </Text>
          <Text style={styles.label}>Listing ZIP</Text>
          <ThemedTextInput
            value={draft.zipCode || homeZip}
            onChangeText={draft.setZipCode}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="e.g. 10001"
          />
        </View>
      ) : null}

      {currentStep === 'Publish' ? (
        <View style={styles.section}>
          <Text style={styles.previewTitle}>{draft.title}</Text>
          <Text style={styles.previewPrice}>
            ${(parsePriceInput(draft.priceText) ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.previewMeta}>
            {draft.category ? categoryLabel(draft.category) : ''} · ZIP{' '}
            {draft.zipCode || homeZip}
          </Text>
          <Text style={styles.previewMeta}>{draft.photos.length} photo(s)</Text>
          {draft.description ? (
            <Text style={styles.previewDesc}>{draft.description}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.navRow}>
        {step > 0 ? (
          <Pressable style={styles.backButton} onPress={goBack} disabled={publishing}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step < flowSteps.length - 1 ? (
          <Pressable style={styles.button} onPress={goNext}>
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={publish} disabled={publishing}>
            {publishing ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{isEditing ? 'Save changes' : 'Publish'}</Text>
            )}
          </Pressable>
        )}
      </View>

      <PageFooterAds slotPrefix="sell" />
    </ScreenScrollView>
    </WebDesktopPage>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  heading: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  quotaHint: {
    fontSize: fontSize.caption,
    color: colors.billGreen,
    fontWeight: fontWeight.semibold,
  },
  stepLabel: { fontSize: fontSize.caption, color: colors.textSecondary },
  section: { gap: spacing.sm },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary },
  fieldError: { fontSize: fontSize.caption, color: colors.error, marginTop: spacing.xs },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pricePrefix: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  priceInput: { flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: fontSize.caption, color: colors.text },
  chipTextActive: { color: colors.onPrimary },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: fontWeight.semibold },
  previewTitle: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  previewPrice: { fontSize: fontSize.h1, color: colors.price, fontWeight: fontWeight.bold },
  previewMeta: { fontSize: fontSize.body, color: colors.textSecondary },
  previewDesc: { fontSize: fontSize.body, color: colors.text },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  backButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  backButtonText: { color: colors.primary, fontWeight: fontWeight.semibold },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
