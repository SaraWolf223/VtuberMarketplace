import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { LegalDocumentId } from '@/constants/legal';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const INTERNAL_DOC_LINKS: Record<string, LegalDocumentId> = {
  './PRIVACY_POLICY.md': 'privacy',
  './TERMS_OF_SERVICE.md': 'terms',
  './COMMUNITY_GUIDELINES.md': 'community',
  './SELLER_AGREEMENT.md': 'sellerAgreement',
  './BUYER_PURCHASE_TERMS.md': 'buyerPurchaseTerms',
  './DMCA_COPYRIGHT_POLICY.md': 'dmcaCopyrightPolicy',
  'PRIVACY_POLICY.md': 'privacy',
  'TERMS_OF_SERVICE.md': 'terms',
  'COMMUNITY_GUIDELINES.md': 'community',
  'SELLER_AGREEMENT.md': 'sellerAgreement',
  'BUYER_PURCHASE_TERMS.md': 'buyerPurchaseTerms',
  'DMCA_COPYRIGHT_POLICY.md': 'dmcaCopyrightPolicy',
};

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---') continue;
    if (trimmed.startsWith('|')) continue;

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'bullet', text: trimmed.slice(2) });
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed });
  }

  return blocks;
}

function stripMarkdownDecorators(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

type InlinePart =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'link'; label: string; href: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*.+?\*\*|\[.+?\]\(.+?\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith('**')) {
      parts.push({ kind: 'bold', value: token.slice(2, -2) });
    } else {
      const linkMatch = /^\[(.+?)\]\((.+?)\)$/.exec(token);
      if (linkMatch) {
        parts.push({ kind: 'link', label: linkMatch[1], href: linkMatch[2] });
      } else {
        parts.push({ kind: 'text', value: token });
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ kind: 'text', value: text }];
}

function InlineText({
  text,
  baseStyle,
}: {
  text: string;
  baseStyle: object;
}): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const parts = parseInline(text);

  return (
    <Text style={baseStyle}>
      {parts.map((part, index) => {
        if (part.kind === 'bold') {
          return (
            <Text key={index} style={styles.bold}>
              {part.value}
            </Text>
          );
        }

        if (part.kind === 'link') {
          const internalId = INTERNAL_DOC_LINKS[part.href];
          if (internalId) {
            return (
              <Text
                key={index}
                style={styles.link}
                onPress={() => router.push(`/legal/${internalId}`)}
              >
                {part.label}
              </Text>
            );
          }

          return (
            <Text key={index} style={styles.link}>
              {part.label}
            </Text>
          );
        }

        return part.value;
      })}
    </Text>
  );
}

type Props = {
  markdown: string;
};

export function LegalMarkdownView({ markdown }: Props): React.JSX.Element {
  const styles = useStyles();
  const blocks = parseBlocks(markdown);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        const plain = stripMarkdownDecorators(block.text);

        if (block.type === 'h1') {
          return (
            <Text key={index} style={styles.h1}>
              {plain}
            </Text>
          );
        }
        if (block.type === 'h2') {
          return (
            <Text key={index} style={styles.h2}>
              {plain}
            </Text>
          );
        }
        if (block.type === 'h3') {
          return (
            <Text key={index} style={styles.h3}>
              {plain}
            </Text>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={index} style={styles.quote}>
              <InlineText text={block.text} baseStyle={styles.quoteText} />
            </View>
          );
        }
        if (block.type === 'bullet') {
          return (
            <View key={index} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <InlineText text={block.text} baseStyle={styles.body} />
            </View>
          );
        }

        return (
          <InlineText key={index} text={block.text} baseStyle={styles.body} />
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  h1: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  h2: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  h3: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bold: { fontWeight: fontWeight.bold, color: colors.text },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: fontWeight.semibold,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bulletDot: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 1,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  quoteText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },
}));
