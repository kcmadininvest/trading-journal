import { useContext } from 'react';
import { ComplianceRefreshContext } from './ComplianceRefreshContext';

export const useComplianceRefresh = () => useContext(ComplianceRefreshContext);
