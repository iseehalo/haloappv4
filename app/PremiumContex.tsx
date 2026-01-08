import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type PremiumContextType = {
  isPremium: boolean;
  loading: boolean;
  refreshStatus: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const PremiumProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('is_premium')
        .eq('id', user.id)
        .single();
      setIsPremium(data?.is_premium || false);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshStatus();
    
    // Listen for auth changes (log in/out)
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      refreshStatus();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <PremiumContext.Provider value={{ isPremium, loading, refreshStatus }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) throw new Error('usePremium must be used within a PremiumProvider');
  return context;
};