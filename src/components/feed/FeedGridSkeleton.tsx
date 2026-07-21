import { View, StyleSheet, Platform } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useWebViewport } from '@/hooks/useWebViewport';
import { FEED_GRID_COLUMNS } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';

const ROWS = 6;

export function FeedGridSkeleton(): React.JSX.Element {
  const { feedColumns } = useWebViewport();
  const columns = Platform.OS === 'web' ? feedColumns : FEED_GRID_COLUMNS;

  return (
    <View style={styles.root}>
      {Array.from({ length: ROWS }, (_, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <View key={colIndex} style={styles.cell}>
              <Skeleton height={Platform.OS === 'web' ? 120 : 140} borderRadius={12} />
              <Skeleton height={14} style={styles.line} />
              <Skeleton height={12} width="60%" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: 'row', gap: Platform.OS === 'web' ? spacing.md : spacing.sm, marginBottom: Platform.OS === 'web' ? spacing.md : spacing.sm },
  cell: { flex: 1, gap: spacing.xs, minWidth: 0 },
  line: { marginTop: spacing.xs },
});
