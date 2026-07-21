import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '@/constants/legal';
import { LEGAL_MARKDOWN } from '@/content/legal-content.generated';
import { LegalMarkdownView } from '@/components/legal/LegalMarkdownView';
import { openTrustedHttpsUrl } from '@/lib/open-external-url';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

const VALID_IDS = new Set<LegalDocumentId>(
  LEGAL_DOCUMENTS.map((doc) => doc.id)
);

function isLegalDocumentId(value: string): value is LegalDocumentId {
  return VALID_IDS.has(value as LegalDocumentId);
}

export default function LegalDocumentScreen(): React.JSX.Element {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id || !isLegalDocumentId(id)) {
    return (
      <>
        <Stack.Screen options={{ title: 'Legal' }} />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Document not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const doc = LEGAL_DOCUMENTS.find((item) => item.id === id)!;
  const markdown = LEGAL_MARKDOWN[id];

  return (
    <>
      <Stack.Screen options={{ title: doc.title }} />
      <ScrollView contentContainerStyle={styles.container}>
        <LegalMarkdownView markdown={markdown} />
        <Pressable
          style={styles.webLink}
          onPress={() => void openTrustedHttpsUrl(doc.url, doc.title)}
        >
          <Text style={styles.webLinkText}>Open on {BUILD_APP_IDENTITY.appDomain}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  backLink: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  webLink: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  webLinkText: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    textDecorationLine: 'underline',
  },
}));
