import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  adminQueryErrorMessage,
  fetchAdminEmailTemplates,
  updateEmailTemplate,
} from '@/features/admin/admin-service';
import type { AdminEmailTemplate } from '@/features/admin/admin-types';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function TemplateCard({
  template,
  onSave,
}: {
  template: AdminEmailTemplate;
  onSave: (subject: string, body: string) => Promise<void>;
}): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body_text);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body_text);
  }, [template.subject, template.body_text]);

  const dirty = subject !== template.subject || body !== template.body_text;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(subject, body);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{template.event_key}</Text>
          <Text style={styles.cardDescription}>{template.description}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.cardBody}>
          <Text style={styles.label}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} />
          <Text style={styles.label}>Body</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.saveBtn, (!dirty || saving) && styles.disabled]}
            onPress={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Save template</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminEmailTemplatesScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.adminEmailTemplates,
    enabled: !!token,
    queryFn: () => fetchAdminEmailTemplates(token),
  });

  const saveTemplate = async (eventKey: string, subject: string, body: string) => {
    await updateEmailTemplate(token, adminUserId, eventKey, { subject, body_text: body });
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminEmailTemplates });
    Alert.alert('Saved', 'The next matching email will use this wording.');
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        Customize the wording of every email the platform sends. Use {'{{placeholder}}'} tokens
        shown in each template&apos;s description — they&apos;re filled in automatically when the
        email is sent. Leave a template as-is to keep the default wording.
      </Text>

      <AdminErrorBanner
        message={adminQueryErrorMessage(listQuery.isError, listQuery.error, 'Could not load templates')}
        onRetry={() => void listQuery.refetch()}
        loading={listQuery.isFetching}
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {(listQuery.data ?? []).map((template) => (
            <TemplateCard
              key={template.event_key}
              template={template}
              onSave={(subject, body) => saveTemplate(template.event_key, subject, body)}
            />
          ))}
          {listQuery.data?.length === 0 ? (
            <Text style={styles.empty}>
              No templates found — run the latest migrations to seed the default set.
            </Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  loader: { marginTop: spacing.xl },
  list: { gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  cardDescription: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 16 },
  cardBody: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: fontSize.body,
    backgroundColor: colors.background,
    color: colors.text,
  },
  textarea: { minHeight: 140 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
}));
