import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { pickCropAndUploadAvatar } from '@/features/profile/avatar-service';
import { queryKeys } from '@/lib/query-keys';

export function useUpdateAvatar() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const changeAvatar = useCallback(async () => {
    const token = session?.access_token;
    if (!user?.id || !token) return;

    setUploading(true);
    try {
      await pickCropAndUploadAvatar(token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      Alert.alert('Saved', 'Profile photo updated.');
    } catch (e) {
      if (e instanceof Error && e.message === 'CANCELLED') return;
      Alert.alert(
        'Could not update photo',
        e instanceof Error ? e.message : 'Try a different image.'
      );
    } finally {
      setUploading(false);
    }
  }, [user?.id, session?.access_token, queryClient]);

  return { changeAvatar, uploading };
}
