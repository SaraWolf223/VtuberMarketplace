import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  fetchSellerPortfolioItems,
  portfolioPublicUrl,
  type PortfolioItem,
} from '@/features/profile/portfolio-service';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = { sellerId: string };

export function SellerPortfolioSection({ sellerId }: Props): React.JSX.Element | null {
  const styles = useStyles();
  const [items, setItems] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchSellerPortfolioItems(sellerId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Showcase</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Image
              source={{ uri: portfolioPublicUrl(item.image_storage_path) }}
              style={styles.image}
              contentFit="cover"
            />
            {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: { width: '100%', marginTop: spacing.md, gap: spacing.sm },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    row: { gap: spacing.sm, paddingRight: spacing.md },
    card: { width: 140, gap: 4 },
    image: {
      width: 140,
      height: 140,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    caption: { fontSize: fontSize.caption, color: colors.textMuted },
  })
);
