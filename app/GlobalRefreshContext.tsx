// app/context/GlobalRefreshContext.tsx
import React, { createContext, useContext, useState } from 'react';

type GlobalRefreshContextType = {
  trigger: number;
  refresh: () => void;
};

const GlobalRefreshContext = createContext<GlobalRefreshContextType>({
  trigger: 0,
  refresh: () => {},
});

export const GlobalRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trigger, setTrigger] = useState(0);

  const refresh = () => setTrigger(prev => prev + 1);

  return (
    <GlobalRefreshContext.Provider value={{ trigger, refresh }}>
      {children}
    </GlobalRefreshContext.Provider>
  );
};

export const useGlobalRefresh = () => useContext(GlobalRefreshContext);
