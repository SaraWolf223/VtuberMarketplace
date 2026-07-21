import { supabase } from '@/lib/supabase';
import {
  AVATAR_DISPLAY_NAME_MAX,
  AVATAR_DISPLAY_NAME_MIN,
} from '@/constants/avatar';

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < AVATAR_DISPLAY_NAME_MIN) {
    return 'Enter a display name.';
  }
  if (trimmed.length > AVATAR_DISPLAY_NAME_MAX) {
    return `Display name must be ${AVATAR_DISPLAY_NAME_MAX} characters or less.`;
  }
  return null;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<string> {
  const trimmed = displayName.trim();
  const validationError = validateDisplayName(trimmed);
  if (validationError) {
    throw new Error(validationError);
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return trimmed;
}
