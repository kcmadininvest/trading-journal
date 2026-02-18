import React, { createContext, useContext, useState, useCallback } from 'react';

interface ComplianceRefreshContextType {
  refreshCount: number;
  triggerRefresh: () => void;
}

const ComplianceRefreshContext = createContext<ComplianceRefreshContextType>({
  refreshCount: 0,
  triggerRefresh: () => {},
});

export const ComplianceRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshCount, setRefreshCount] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshCount(c => c + 1);
  }, []);

  return (
    <ComplianceRefreshContext.Provider value={{ refreshCount, triggerRefresh }}>
      {children}
    </ComplianceRefreshContext.Provider>
  );
};

export const useComplianceRefresh = () => useContext(ComplianceRefreshContext);
