import React from 'react';

interface TradesFiltersProps {
  values: {
    contract: string;
    type: '' | 'Long' | 'Short';
    start_date: string;
    end_date: string;
    profitable: '' | 'true' | 'false';
  };
  instruments?: string[];
  onChange: (next: Partial<TradesFiltersProps['values']>) => void;
  onReset: () => void;
}

export const TradesFilters: React.FC<TradesFiltersProps> = ({ values, instruments = [], onChange, onReset }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-5 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <select
          value={values.contract}
          onChange={(e) => onChange({ contract: e.target.value })}
          className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Instrument</option>
          {instruments.map((it) => (
            <option key={it} value={it}>{it}</option>
          ))}
        </select>
        <select
          value={values.type}
          onChange={(e) => onChange({ type: e.target.value as any })}
          className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Type</option>
          <option value="Long">Long</option>
          <option value="Short">Short</option>
        </select>
        <input
          type="date"
          value={values.start_date}
          onChange={(e) => onChange({ start_date: e.target.value })}
          className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={values.end_date}
          onChange={(e) => onChange({ end_date: e.target.value })}
          className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={values.profitable}
          onChange={(e) => onChange({ profitable: e.target.value as any })}
          className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">PnL</option>
          <option value="true">Gagnants</option>
          <option value="false">Perdants</option>
        </select>
        <div className="w-full flex md:justify-end">
          <button onClick={onReset} className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Réinitialiser</button>
        </div>
      </div>
    </div>
  );
};


