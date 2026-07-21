import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize } from '@/theme/typography';

type Props = {
  body: string;
  isOwn: boolean;
  sentAt: string;
};

export function MessageBubble({ body, isOwn, sentAt }: Props): React.JSX.Element {
  const styles = useStyles();
  const time = new Date(sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.body, isOwn && styles.bodyOwn]}>{body}</Text>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{time}</Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bubbleOwn: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  body: { fontSize: fontSize.body, color: colors.text },
  bodyOwn: { color: colors.onPrimary },
  time: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeOwn: { color: 'rgba(255,255,255,0.75)' },
}));
