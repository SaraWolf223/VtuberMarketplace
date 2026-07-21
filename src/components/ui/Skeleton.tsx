import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, type ViewStyle, type StyleProp } from 'react-native';
import { radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = {
  width?: number | `${number}%`;
  height: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

export function Skeleton({ width = '100%', height, style, borderRadius = radius.sm }: Props): React.JSX.Element {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
}));
