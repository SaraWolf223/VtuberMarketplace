import { supabaseRestGet, supabaseRpc } from '@/lib/supabase-rest';

export type SellerStrikeRow = {
  id: string;
  seller_id: string;
  listing_id: string | null;
  reason: string;
  source: 'automated_check' | 'buyer_report';
  created_at: string;
  expires_at: string;
};

export type LinkHealthIssueRow = {
  id: string;
  listing_id: string | null;
  order_id: string | null;
  url: string;
  consecutive_failures: number;
  grace_period_ends_at: string | null;
  issue_open: boolean;
  created_at: string;
  listings?: { id: string; title: string; seller_id: string } | null;
};

export type SellerDashboardSummary = {
  connect_charges_enabled: boolean;
  connect_payouts_enabled: boolean;
  connect_details_submitted: boolean;
  phone_verified: boolean;
  can_publish: boolean;
  is_pro_seller: boolean;
  pro_seller_until: string | null;
  open_orders_awaiting_fulfillment: number;
  active_strike_count: number;
};

export async function fetchSellerDashboardSummary(
  accessToken: string
): Promise<SellerDashboardSummary> {
  return supabaseRpc<SellerDashboardSummary>('get_seller_dashboard_summary', {}, accessToken);
}

export async function fetchOwnStrikes(accessToken: string, userId: string): Promise<SellerStrikeRow[]> {
  const rows = await supabaseRestGet<SellerStrikeRow>(
    `seller_strikes?seller_id=eq.${userId}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,seller_id,listing_id,reason,source,created_at,expires_at&order=created_at.desc`,
    accessToken
  );
  return rows;
}

export async function fetchOwnOpenLinkHealthIssues(
  accessToken: string
): Promise<LinkHealthIssueRow[]> {
  return supabaseRestGet<LinkHealthIssueRow>(
    'link_health_checks?issue_open=eq.true&select=id,listing_id,order_id,url,consecutive_failures,grace_period_ends_at,issue_open,created_at,listings(id,title,seller_id)&order=grace_period_ends_at.asc.nullslast',
    accessToken
  );
}

export type AdminStrikeQueueItem = LinkHealthIssueRow & {
  listings?: { id: string; title: string; seller_id: string; profiles?: { username: string; display_name: string } | null } | null;
};

export async function fetchAdminStrikeQueue(accessToken: string): Promise<AdminStrikeQueueItem[]> {
  return supabaseRestGet<AdminStrikeQueueItem>(
    'link_health_checks?issue_open=eq.true&select=id,listing_id,order_id,url,consecutive_failures,grace_period_ends_at,issue_open,created_at,listings(id,title,seller_id,profiles(username,display_name))&order=grace_period_ends_at.asc.nullslast',
    accessToken
  );
}

export function strikeSourceLabel(source: SellerStrikeRow['source']): string {
  return source === 'buyer_report' ? 'Buyer report' : 'Automated check';
}
