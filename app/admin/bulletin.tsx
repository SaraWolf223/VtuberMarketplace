import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import {
  listRecentBulletinPostsForStaff,
  staffHideBulletinPost,
} from '@/features/bulletin/bulletin-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type StaffBulletinRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_username?: string;
  author_display_name?: string;
  hidden_at?: string | null;
};

export default function AdminBulletinScreen(): React.JSX.Element {
  const styles = useStyles();
  const [rows, setRows] = useState<StaffBulletinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listRecentBulletinPostsForStaff());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Bulletin moderation' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<Text style={styles.hint}>No current bulletin posts.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.meta}>
                {item.author_display_name ?? 'User'}
                {item.author_username ? ` (@${item.author_username})` : ''}
              </Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString()}
                {item.hidden_at ? ' · Hidden' : ''}
              </Text>
              {!item.hidden_at ? (
                <Pressable
                  style={styles.btn}
                  disabled={busyId === item.id}
                  onPress={() => {
                    showAlert('Hide post?', 'This archives the current bulletin for the author.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Hide',
                        style: 'destructive',
                        onPress: async () => {
                          setBusyId(item.id);
                          try {
                            await staffHideBulletinPost(item.id);
                            await load();
                          } catch (e) {
                            showAlert('Error', e instanceof Error ? e.message : 'Hide failed');
                          } finally {
                            setBusyId(null);
                          }
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.btnText}>Hide post</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    list: { padding: spacing.md, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: 6,
    },
    body: { fontSize: fontSize.body, color: colors.text, lineHeight: 20 },
    meta: { fontSize: fontSize.caption, color: colors.textMuted },
    btn: {
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    btnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hint: { textAlign: 'center', color: colors.textMuted },
  })
);
