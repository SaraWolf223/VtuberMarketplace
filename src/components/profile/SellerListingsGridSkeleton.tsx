import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { spacing } from '@/theme/tokens';

const PAIRS = 3;

export function SellerListingsGridSkeleton(): React.JSX.Element {
  return (
    <View style={styles.root}>
      {Array.from({ length: PAIRS }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.cell}>
            <Skeleton height={120} borderRadius={12} />
          </View>
          <View style={styles.cell}>
            <Skeleton height={120} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
});
