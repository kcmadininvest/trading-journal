import React from 'react';
import { BehaviorDisciplineAlerts } from './BehaviorDisciplineAlerts';
import { BehaviorDisciplineSection } from './BehaviorDisciplineSection';
import type { BehaviorDisciplineData } from '../../hooks/useStatistics';

interface BehaviorDisciplinePanelProps {
  data: BehaviorDisciplineData | undefined;
  formatNumber: (value: number, digits?: number) => string;
}

export const BehaviorDisciplinePanel: React.FC<BehaviorDisciplinePanelProps> = ({
  data,
  formatNumber,
}) => (
  <div className="space-y-2">
    <BehaviorDisciplineAlerts data={data} formatNumber={formatNumber} />
    <BehaviorDisciplineSection kind="revenge" data={data} formatNumber={formatNumber} />
    <BehaviorDisciplineSection kind="sizing" data={data} formatNumber={formatNumber} />
  </div>
);
