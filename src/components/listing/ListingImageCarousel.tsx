import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import { BoostBadge } from '@/components/listing/BoostBadge';
import { isBoostActive } from '@/utils/boost-countdown';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const WIDTH = Dimensions.get('window').width;

type Props = {
  images: { storage_path: string; sort_order: number }[];
  status: string;
  boostedUntil?: string | null;
  /** When false, hide boost badge (e.g. public feed cards). Default true for detail. */
  showBoostBadge?: boolean;
};

export function ListingImageCarousel({
  images,
  status,
  boostedUntil,
  showBoostBadge = true,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isInactive = status === 'sold' || status === 'expired';
  const showBoost = showBoostBadge && isBoostActive(boostedUntil) && !isInactive;
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const canPopOut = Platform.OS === 'web';

  const goToInline = (i: number) => {
    const clamped = Math.max(0, Math.min(i, sorted.length - 1));
    const w = trackWidth || WIDTH;
    scrollRef.current?.scrollTo({ x: clamped * w, animated: true });
    setIndex(clamped);
  };

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);
  const sortedLength = sorted.length;
  const showNext = useCallback(
    () => setLightboxIndex((p) => (p + 1) % sortedLength),
    [sortedLength]
  );
  const showPrev = useCallback(
    () => setLightboxIndex((p) => (p - 1 + sortedLength) % sortedLength),
    [sortedLength]
  );

  useEffect(() => {
    if (!canPopOut || !lightboxOpen || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') showNext();
      else if (e.key === 'ArrowLeft') showPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPopOut, lightboxOpen, showNext, showPrev]);

  if (!sorted.length) {
    return (
      <View style={[styles.slide, styles.placeholder]}>
        <Text style={styles.placeholderText}>No photos</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const w = trackWidth || WIDTH;
          const i = Math.round(e.nativeEvent.contentOffset.x / w);
          setIndex(i);
        }}
      >
        {sorted.map((img, i) => {
          const slideContent = (
            <>
              <Image
                source={{ uri: listingImagePublicUrl(img.storage_path) }}
                style={[styles.image, isInactive && styles.imageInactive]}
                contentFit="cover"
              />
              {isInactive ? (
                <View style={styles.soldOverlay}>
                  <Text style={styles.soldText}>{status === 'sold' ? 'SOLD' : 'EXPIRED'}</Text>
                </View>
              ) : null}
              {showBoost ? (
                <View style={styles.boostBadgeWrap}>
                  <BoostBadge boostedUntil={boostedUntil} />
                </View>
              ) : null}
              {canPopOut ? (
                <View style={styles.zoomHint} pointerEvents="none">
                  <Ionicons name="expand-outline" size={18} color="#fff" />
                </View>
              ) : null}
            </>
          );

          if (canPopOut) {
            return (
              <Pressable
                key={img.storage_path}
                style={[
                  styles.slide,
                  styles.slideWeb,
                  { width: trackWidth > 0 ? trackWidth : '100%' },
                ]}
                onPress={() => openLightbox(i)}
                accessibilityRole="button"
                accessibilityLabel="View image larger"
              >
                {slideContent}
              </Pressable>
            );
          }

          return (
            <View key={img.storage_path} style={styles.slide}>
              {slideContent}
            </View>
          );
        })}
      </ScrollView>
      {canPopOut && sorted.length > 1 ? (
        <>
          {index > 0 ? (
            <Pressable
              style={[styles.arrow, styles.arrowLeft]}
              onPress={() => goToInline(index - 1)}
              accessibilityLabel="Previous image"
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          ) : null}
          {index < sorted.length - 1 ? (
            <Pressable
              style={[styles.arrow, styles.arrowRight]}
              onPress={() => goToInline(index + 1)}
              accessibilityLabel="Next image"
            >
              <Ionicons name="chevron-forward" size={26} color="#fff" />
            </Pressable>
          ) : null}
        </>
      ) : null}
      </View>
      {sorted.length > 1 ? (
        <Text style={styles.counter}>
          {index + 1} / {sorted.length}
        </Text>
      ) : null}

      {canPopOut ? (
        <Modal
          visible={lightboxOpen}
          transparent
          animationType="fade"
          onRequestClose={closeLightbox}
        >
          <View style={styles.lightboxBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeLightbox}
              accessibilityLabel="Close image"
            />
            <Image
              source={{ uri: listingImagePublicUrl(sorted[lightboxIndex].storage_path) }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
            <Pressable
              style={[styles.lightboxBtn, styles.lightboxClose]}
              onPress={closeLightbox}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            {sorted.length > 1 ? (
              <>
                <Pressable
                  style={[styles.lightboxBtn, styles.lightboxLeft]}
                  onPress={showPrev}
                  accessibilityLabel="Previous image"
                >
                  <Ionicons name="chevron-back" size={32} color="#fff" />
                </Pressable>
                <Pressable
                  style={[styles.lightboxBtn, styles.lightboxRight]}
                  onPress={showNext}
                  accessibilityLabel="Next image"
                >
                  <Ionicons name="chevron-forward" size={32} color="#fff" />
                </Pressable>
                <Text style={styles.lightboxCounter}>
                  {lightboxIndex + 1} / {sorted.length}
                </Text>
              </>
            ) : null}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  track: { position: 'relative' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  arrowLeft: { left: spacing.md },
  arrowRight: { right: spacing.md },
  slide: { width: WIDTH, aspectRatio: 4 / 3 },
  slideWeb: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  image: { width: '100%', height: '100%' },
  imageInactive: { opacity: 0.45 },
  zoomHint: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lightboxImage: {
    width: '92%',
    height: '88%',
    maxWidth: 1200,
  },
  lightboxBtn: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  lightboxClose: { top: spacing.lg, right: spacing.lg },
  lightboxLeft: { left: spacing.lg },
  lightboxRight: { right: spacing.lg },
  lightboxCounter: {
    position: 'absolute',
    bottom: spacing.lg,
    color: '#fff',
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  placeholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted },
  soldOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldText: {
    color: colors.onPrimary,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  boostBadgeWrap: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  counter: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
}));
