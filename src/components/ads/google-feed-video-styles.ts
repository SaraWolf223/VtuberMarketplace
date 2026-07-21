import { StyleSheet } from 'react-native';
import {
  GOOGLE_FEED_VIDEO_ASPECT_RATIO,
  GOOGLE_FEED_VIDEO_MEDIA_MAX_HEIGHT,
  GOOGLE_FEED_AD_MAX_WIDTH,
} from '@/constants/google-feed-ads';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export const useGoogleFeedVideoStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    card: {
      width: '100%',
      maxWidth: GOOGLE_FEED_AD_MAX_WIDTH,
      alignSelf: 'center',
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sponsoredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    sponsoredBadge: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    adLabel: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    media: {
      width: '100%',
      maxHeight: GOOGLE_FEED_VIDEO_MEDIA_MAX_HEIGHT,
      aspectRatio: GOOGLE_FEED_VIDEO_ASPECT_RATIO,
      backgroundColor: colors.background,
    },
    body: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    headline: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    advertiser: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
    },
    cta: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
    },
    ctaText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: '#fff',
    },
    placeholderMediaInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
    },
    placeholderPlay: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderPlayIcon: {
      fontSize: 20,
      color: colors.text,
      marginLeft: 4,
    },
    placeholderHint: {
      marginTop: spacing.sm,
      fontSize: fontSize.caption,
      color: 'rgba(255,255,255,0.65)',
    },
    loading: {
      minHeight: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
