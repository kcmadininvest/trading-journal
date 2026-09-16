import React from 'react';
import { CustomSelect } from '../common/CustomSelect';
import type { AvailableTimeframe } from '../../services/marketReplay';

interface TimeframeSelectProps {
  value: string | null;
  options: AvailableTimeframe[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export const TimeframeSelect: React.FC<TimeframeSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  label,
}) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {label ? (
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      ) : null}
      <CustomSelect
        value={value}
        onChange={(v) => {
          if (v != null) onChange(String(v));
        }}
        options={options.map((tf) => ({ value: tf.value, label: tf.label || tf.value }))}
        disabled={disabled || options.length === 0}
        variant="compact"
        className="min-w-[7rem]"
      />
    </div>
  );
};
