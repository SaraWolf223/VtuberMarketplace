import { supabaseRpc } from '@/lib/supabase-rest';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';

export async function setFeedCollegeStudentsOnly(
  accessToken: string,
  enabled: boolean
): Promise<void> {
  await supabaseRpc('set_feed_college_students_only', { p_enabled: enabled }, accessToken);
  useFeedFiltersStore.getState().setCollegeStudentsOnly(enabled);
}

export function hydrateCollegeFeedFilter(enabled: boolean): void {
  useFeedFiltersStore.getState().setCollegeStudentsOnly(enabled);
}
