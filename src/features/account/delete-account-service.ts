import { getSupabaseEnv } from '@/lib/supabase-rest';

type DeleteAccountResult = {
  deleted: boolean;
  user_id: string;
};

export async function deleteAccount(accessToken: string): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const json = (await res.json()) as {
    ok: boolean;
    data: DeleteAccountResult | null;
    error?: { message?: string };
  };

  if (json.ok && json.data?.deleted) {
    return;
  }

  throw new Error(json.error?.message ?? 'Could not delete account');
}
