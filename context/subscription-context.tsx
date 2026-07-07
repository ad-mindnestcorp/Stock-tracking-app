import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@/context/auth';
import {
  initPurchases,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isEntitlementActive,
  type VestoOfferings,
} from '@/lib/subscription';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  offerings: VestoOfferings | null;
  purchase: (packageId: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isLoading: true,
  offerings: null,
  purchase: async () => false,
  restore: async () => false,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<VestoOfferings | null>(null);

  const refresh = useCallback(async () => {
    const [subscribed, currentOfferings] = await Promise.all([
      isEntitlementActive(),
      getOfferings(),
    ]);
    setIsSubscribed(subscribed);
    setOfferings(currentOfferings);
  }, []);

  useEffect(() => {
    if (user?.id) {
      initPurchases(user.id)
        .then(() => refresh())
        .finally(() => setIsLoading(false));
    } else {
      initPurchases(null)
        .then(() => refresh())
        .finally(() => setIsLoading(false));
    }
  }, [user?.id, refresh]);

  const purchase = useCallback(
    async (packageId: string): Promise<boolean> => {
      const success = await purchasePackage(packageId);
      if (success) {
        await refresh();
      }
      return success;
    },
    [refresh]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    const success = await restorePurchases();
    if (success) {
      await refresh();
    }
    return success;
  }, [refresh]);

  return (
    <SubscriptionContext.Provider
      value={{ isSubscribed, isLoading, offerings, purchase, restore, refresh }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
