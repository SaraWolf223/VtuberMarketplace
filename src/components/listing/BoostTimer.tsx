import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useBoostCountdown } from '@/hooks/useBoostCountdown';

type Props = {
  boostedUntil: string | null | undefined;
  /** Shown before the countdown, e.g. "Boosted" */
  prefix?: string;
  style?: StyleProp<TextStyle>;
};

export function BoostTimer({
  boostedUntil,
  prefix = 'Boosted',
  style,
}: Props): React.JSX.Element | null {
  const countdown = useBoostCountdown(boostedUntil);
  if (!countdown) return null;

  return (
    <Text style={style}>
      {prefix} · {countdown}
    </Text>
  );
}
