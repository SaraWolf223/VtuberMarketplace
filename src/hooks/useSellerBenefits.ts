import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { fetchSellerBenefits } from '@/features/monetization/seller-benefits-service';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

export function useSellerBenefits() {
  const { user, isSignedIn, isLoading: authLoading } = useAuth();
  const { data: profile, isFetched: profileFetched } = useProfile();
  const userId = user?.id;

  const query = useQuery({
    queryKey: queryKeys.sellerBenefits(userId ?? 'none'),
    enabled: !authLoading && isSignedIn && !!userId && profileFetched && !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (error || !token || !userId || !profile) {
        throw new Error('Sign in again to load account limits.');
      }
      return fetchSellerBenefits(token, userId, profile);
    },
    staleTime: 20_000,
    retry: 2,
    refetchOnMount: 'always',
  });

  const data = query.data;

  return {
    benefits: data,
    premiumActive: data?.premium_active ?? false,
    isFoundingSeller: data?.is_founding_seller ?? false,
    promoBoostsRemaining: data?.promo_boosts_remaining ?? 0,
    boostCreditsRemaining: data?.boost_credits?.credits_remaining ?? 0,
    boostCreditsTotal: data?.boost_credits?.credits_total ?? 0,
    foundingBoostsRemaining: data?.founding_boost_credits?.credits_remaining ?? 0,
    foundingBoostsTotal: data?.founding_boost_credits?.credits_total ?? 0,
    listingsRemaining: data?.listings?.remaining ?? 0,
    listingsLimit: data?.listings?.limit ?? 5,
    listingsCreated: data?.listings?.created_this_month ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
