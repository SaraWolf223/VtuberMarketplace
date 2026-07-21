import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  addBulletinComment,
  getCurrentBulletin,
  listBulletinComments,
  setBulletinPost,
  type BulletinComment,
  type BulletinPost,
} from '@/features/bulletin/bulletin-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  userId: string;
  isSelf: boolean;
};

export function ProfileBulletinCard({ userId, isSelf }: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const [post, setPost] = useState<BulletinPost | null>(null);
  const [comments, setComments] = useState<BulletinComment[]>([]);
  const [draft, setDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getCurrentBulletin(userId);
      setPost(current.post);
      if (current.post) {
        setComments(await listBulletinComments(current.post.id));
      } else {
        setComments([]);
      }
    } catch (e) {
      showAlert('Bulletin', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async () => {
    setSaving(true);
    try {
      const res = await setBulletinPost(draft);
      if (res.error) {
        showAlert('Bulletin', res.error);
        return;
      }
      setDraft('');
      await load();
    } catch (e) {
      showAlert('Bulletin', e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setSaving(false);
    }
  };

  const onComment = async () => {
    if (!post) return;
    setSaving(true);
    try {
      const res = await addBulletinComment(post.id, commentDraft);
      if (res.error) {
        showAlert('Comment', res.error);
        return;
      }
      setCommentDraft('');
      setComments(await listBulletinComments(post.id));
    } catch (e) {
      showAlert('Comment', e instanceof Error ? e.message : 'Failed to comment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bulletin</Text>
      {post ? (
        <>
          <Text style={styles.body}>{post.body}</Text>
          <Text style={styles.meta}>{new Date(post.created_at).toLocaleString()}</Text>
        </>
      ) : (
        <Text style={styles.empty}>No update posted yet.</Text>
      )}

      {isSelf ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Post a new update (replaces the current one)"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
          />
          <Pressable style={styles.button} onPress={onPublish} disabled={saving || !draft.trim()}>
            <Text style={styles.buttonText}>{saving ? '…' : 'Post update'}</Text>
          </Pressable>
        </View>
      ) : null}

      {post ? (
        <View style={styles.comments}>
          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>
                {c.author_display_name ?? c.author_username ?? 'User'}
              </Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))}
          <TextInput
            style={styles.input}
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Add a comment"
            placeholderTextColor={colors.textMuted}
            maxLength={300}
          />
          <Pressable
            style={styles.buttonSecondary}
            onPress={onComment}
            disabled={saving || !commentDraft.trim()}
          >
            <Text style={styles.buttonSecondaryText}>Comment</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    card: {
      width: '100%',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    body: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
    meta: { fontSize: fontSize.caption, color: colors.textMuted },
    empty: { fontSize: fontSize.body, color: colors.textMuted },
    composer: { gap: spacing.sm, marginTop: spacing.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
      minHeight: 44,
      backgroundColor: colors.background,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    buttonSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonSecondaryText: { color: colors.text, fontWeight: fontWeight.semibold },
    comments: { gap: spacing.sm, marginTop: spacing.sm },
    commentsTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
    commentRow: { gap: 2 },
    commentAuthor: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
    commentBody: { fontSize: fontSize.caption, color: colors.textMuted },
  })
);
