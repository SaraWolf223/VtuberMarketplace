import { useSellerBenefits } from '@/hooks/useSellerBenefits';

/** Premium boost credits — backed by get-seller-benefits (syncs DB + ensures credit row). */
export function usePremiumCredits() {
  const {
    benefits,
    premiumActive,
    boostCreditsRemaining,
    boostCreditsTotal,
    isLoading,
    refetch,
  } = useSellerBenefits();

  return {
    premiumActive,
    credits: benefits
      ? {
          period_start: benefits.boost_credits.period_start,
          credits_total: benefits.boost_credits.credits_total,
          credits_used: benefits.boost_credits.credits_used,
        }
      : null,
    remaining: boostCreditsRemaining,
    creditsTotal: boostCreditsTotal,
    isLoading,
    refetch,
  };
}
