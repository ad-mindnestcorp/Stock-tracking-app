import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { identify, reset, track } from '@/lib/analytics';
import { getPendingWatchlistSeed, setPendingWatchlistSeed, getOnboardingData } from '@/lib/onboarding-storage';
import { watchlistApi } from '@/lib/api';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        identify(session.user.id, { email: session.user.email });
      }
      if (event === 'SIGNED_IN' && session) {
        getPendingWatchlistSeed().then(async (pending) => {
          if (!pending) return;
          await setPendingWatchlistSeed(false);
          const { selectedStocks } = await getOnboardingData();
          for (const stock of selectedStocks) {
            try { await watchlistApi.add(stock.symbol, stock.name); } catch {}
          }
        });
      }
      if (event === 'SIGNED_OUT') {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    track('sign_out');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
