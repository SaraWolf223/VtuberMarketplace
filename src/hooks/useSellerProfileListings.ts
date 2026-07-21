import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { fetchSellerProfileListings } from '@/features/listings/seller-profile-listings-service';

export function useSellerProfileListings(sellerId: string | undefined) {
  const { session, isSignedIn } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.sellerProfileListings(sellerId ?? ''),
    queryFn: () => fetchSellerProfileListings(token!, sellerId!),
    enabled: isSignedIn && !!sellerId && !!token,
    staleTime: 60_000,
  });
}
