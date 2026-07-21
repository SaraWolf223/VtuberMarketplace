import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LEGAL_DOCUMENTS } from '@/constants/legal';
import { legalDocumentHref } from '@/lib/legal-navigation';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  showHeading?: boolean;
  compact?: boolean;
};

export function LegalDocumentLinks({
  showHeading = true,
  compact = false,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {showHeading ? <Text style={styles.heading}>Legal documents</Text> : null}
      {LEGAL_DOCUMENTS.map((doc, index) => (
        <Pressable
          key={doc.id}
          style={[styles.row, index === LEGAL_DOCUMENTS.length - 1 && styles.rowLast]}
          onPress={() => router.push(legalDocumentHref(doc.id))}
          accessibilityRole="link"
        >
          <Text style={styles.title}>{doc.title}</Text>
          {!compact ? <Text style={styles.description}>{doc.description}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: 0 },
  heading: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  title: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  description: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
}));
