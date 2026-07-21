import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/hooks/useAuth';
import {
  canUseStripePaidMonetization,
  IOS_PAID_MONETIZATION_DISABLED_MESSAGE,
  IOS_PAID_MONETIZATION_DISABLED_TITLE,
} from '@/features/monetization/platform-payments';
import { openPremiumBillingPortal } from '@/features/monetization/seller-benefits-service';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export function usePremiumBilling() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);

  const openPortal = useCallback(async () => {
    const token = session?.access_token;
    if (!token || !user?.id) {
      Alert.alert('Sign in', 'Sign in to manage Premium.');
      return;
    }

    if (!canUseStripePaidMonetization()) {
      Alert.alert(IOS_PAID_MONETIZATION_DISABLED_TITLE, IOS_PAID_MONETIZATION_DISABLED_MESSAGE);
      return;
    }

    setOpening(true);
    try {
      const url = await openPremiumBillingPortal(token);
      await WebBrowser.openBrowserAsync(url);
      await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
    } catch (e) {
      Alert.alert('Billing', e instanceof Error ? e.message : 'Could not open billing portal');
    } finally {
      setOpening(false);
    }
  }, [session?.access_token, user?.id, queryClient]);

  return { openPortal, opening };
}
