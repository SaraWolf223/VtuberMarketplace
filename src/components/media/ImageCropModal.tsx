import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  exportCroppedImageUri,
  minCoverScale,
  type CropTransform,
} from '@/lib/image-crop-export';
import type { CropAspect } from '@/lib/image-crop-pick';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const MAX_ZOOM = 3;

type Props = {
  visible: boolean;
  imageUri: string;
  aspect: CropAspect;
  title?: string;
  onDone: (uri: string) => void;
  onCancel: () => void;
};

export function ImageCropModal({
  visible,
  imageUri,
  aspect,
  title = 'Move and zoom to crop',
  onDone,
  onCancel,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  const frameWidth = Math.min(screenW - spacing.lg * 2, 360);
  const frameHeight = Math.round((frameWidth * aspect[1]) / aspect[0]);

  // Cover scale at which the image exactly fills the frame; the rendered base
  // size. The gesture `zoom` is a multiplier (>= 1) on top of this base.
  const minScaleRef = useRef(1);

  // Animated state lives on the UI thread (no React re-renders while dragging).
  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  // Frame + base dimensions mirrored into shared values for worklet clamping.
  const fW = useSharedValue(frameWidth);
  const fH = useSharedValue(frameHeight);
  const bW = useSharedValue(0);
  const bH = useSharedValue(0);

  useEffect(() => {
    fW.value = frameWidth;
    fH.value = frameHeight;
  }, [frameWidth, frameHeight, fW, fH]);

  const resetTransform = useCallback(
    (w: number, h: number) => {
      const s = minCoverScale(w, h, frameWidth, frameHeight);
      minScaleRef.current = s;
      const baseW = w * s;
      const baseH = h * s;
      setBase({ w: baseW, h: baseH });
      bW.value = baseW;
      bH.value = baseH;
      zoom.value = 1;
      tx.value = 0;
      ty.value = 0;
    },
    [frameWidth, frameHeight, bW, bH, zoom, tx, ty]
  );

  useEffect(() => {
    if (!visible) return;
    setImageSize(null);
    setBase(null);
    Image.getSize(
      imageUri,
      (w, h) => {
        setImageSize({ w, h });
        resetTransform(w, h);
      },
      () => {
        setImageSize({ w: 1000, h: 1000 });
        resetTransform(1000, 1000);
      }
    );
  }, [visible, imageUri, resetTransform]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const maxTx = Math.max(0, (bW.value * zoom.value - fW.value) / 2);
      const maxTy = Math.max(0, (bH.value * zoom.value - fH.value) / 2);
      const nx = startTx.value + e.translationX;
      const ny = startTy.value + e.translationY;
      tx.value = Math.min(maxTx, Math.max(-maxTx, nx));
      ty.value = Math.min(maxTy, Math.max(-maxTy, ny));
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      let z = startZoom.value * e.scale;
      if (z < 1) z = 1;
      if (z > MAX_ZOOM) z = MAX_ZOOM;
      zoom.value = z;
      const maxTx = Math.max(0, (bW.value * z - fW.value) / 2);
      const maxTy = Math.max(0, (bH.value * z - fH.value) / 2);
      tx.value = Math.min(maxTx, Math.max(-maxTx, tx.value));
      ty.value = Math.min(maxTy, Math.max(-maxTy, ty.value));
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: zoom.value },
    ],
  }));

  const adjustZoom = (delta: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.value + delta));
    const maxTx = Math.max(0, (bW.value * z - fW.value) / 2);
    const maxTy = Math.max(0, (bH.value * z - fH.value) / 2);
    zoom.value = withTiming(z, { duration: 120 });
    tx.value = withTiming(Math.min(maxTx, Math.max(-maxTx, tx.value)), { duration: 120 });
    ty.value = withTiming(Math.min(maxTy, Math.max(-maxTy, ty.value)), { duration: 120 });
  };

  const handleDone = async () => {
    if (!imageSize) return;
    setExporting(true);
    try {
      const transform: CropTransform = {
        imageWidth: imageSize.w,
        imageHeight: imageSize.h,
        scale: minScaleRef.current * zoom.value,
        translateX: tx.value,
        translateY: ty.value,
        frameWidth,
        frameHeight,
      };
      const uri = await exportCroppedImageUri(imageUri, transform);
      onDone(uri);
    } catch {
      onCancel();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.flex}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} disabled={exporting} hitSlop={12}>
              <Text style={styles.headerAction}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable
              onPress={() => void handleDone()}
              disabled={exporting || !imageSize}
              hitSlop={12}
            >
              {exporting ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.headerAction, styles.headerDone]}>Done</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>Drag to reposition · pinch or use − / + to zoom.</Text>

          <View style={styles.stage}>
            <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={styles.gestureArea}>
                  {imageSize && base ? (
                    <Animated.View
                      style={[
                        {
                          position: 'absolute',
                          width: base.w,
                          height: base.h,
                          left: frameWidth / 2 - base.w / 2,
                          top: frameHeight / 2 - base.h / 2,
                        },
                        imageAnimatedStyle,
                      ]}
                    >
                      <Image
                        source={{ uri: imageUri }}
                        style={{ width: base.w, height: base.h }}
                        resizeMode="cover"
                      />
                    </Animated.View>
                  ) : (
                    <ActivityIndicator color={colors.primary} style={styles.loader} />
                  )}
                </Animated.View>
              </GestureDetector>
              <View style={styles.frameBorder} pointerEvents="none" />
            </View>
          </View>

          <View style={styles.zoomRow}>
            <Pressable style={styles.zoomBtn} onPress={() => adjustZoom(-0.2)} disabled={!imageSize}>
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Pressable style={styles.zoomBtn} onPress={() => adjustZoom(0.2)} disabled={!imageSize}>
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.onPrimary,
  },
  headerAction: {
    fontSize: fontSize.body,
    color: colors.onPrimary,
    minWidth: 64,
  },
  headerDone: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  hint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.caption,
    marginBottom: spacing.sm,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: '#111',
    borderRadius: radius.sm,
  },
  gestureArea: {
    ...StyleSheet.absoluteFill,
  },
  frameBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.sm,
  },
  loader: {
    alignSelf: 'center',
    marginTop: '40%',
  },
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  zoomBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: colors.onPrimary,
    fontSize: 28,
    lineHeight: 32,
  },
}));
