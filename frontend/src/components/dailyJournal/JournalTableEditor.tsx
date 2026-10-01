import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import {
  MarkdownTableData,
  addTableColumn,
  addTableRow,
  removeTableColumn,
  removeTableRow,
  updateTableCell,
} from './markdownTable';

interface JournalTableEditorProps {
  data: MarkdownTableData;
  onChange: (data: MarkdownTableData) => void;
  onClose: () => void;
  disabled?: boolean;
}

export const JournalTableEditor: React.FC<JournalTableEditorProps> = ({
  data,
  onChange,
  onClose,
  disabled = false,
}) => {
  const { t } = useI18nTranslation();

  const handleAddColumn = () => {
    const label = t('dailyJournal.tableHeader', {
      defaultValue: 'Colonne {{index}}',
      index: data.headers.length + 1,
    });
    onChange(addTableColumn(data, label));
  };

  const handleAddRow = () => {
    onChange(addTableRow(data));
  };

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('dailyJournal.tableEditorTitle', { defaultValue: 'Éditeur de tableau' })}
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
        >
          {t('dailyJournal.tableEditorClose', { defaultValue: 'Fermer' })}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse min-w-full text-sm">
          <thead>
            <tr>
              {data.headers.map((header, colIndex) => (
                <th key={`h-${colIndex}`} className="p-1 align-top border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={header}
                      disabled={disabled}
                      onChange={(event) => onChange(updateTableCell(data, -1, colIndex, event.target.value))}
                      className="w-full min-w-[6rem] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-semibold text-gray-900 dark:text-gray-100"
                      aria-label={t('dailyJournal.tableHeader', { defaultValue: 'Colonne {{index}}', index: colIndex + 1 })}
                    />
                    <button
                      type="button"
                      disabled={disabled || data.headers.length <= 1}
                      onClick={() => onChange(removeTableColumn(data, colIndex))}
                      className="text-[10px] text-red-600 dark:text-red-400 disabled:opacity-40"
                    >
                      {t('dailyJournal.tableRemoveColumn', { defaultValue: 'Suppr. colonne' })}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                {row.map((cell, colIndex) => (
                  <td key={`c-${rowIndex}-${colIndex}`} className="p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                    <input
                      type="text"
                      value={cell === ' ' ? '' : cell}
                      disabled={disabled}
                      onChange={(event) => onChange(updateTableCell(data, rowIndex, colIndex, event.target.value))}
                      className="w-full min-w-[6rem] rounded border border-transparent focus:border-blue-400 dark:focus:border-blue-500 bg-transparent px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                    />
                  </td>
                ))}
                <td className="p-1 border-0 align-middle">
                  <button
                    type="button"
                    disabled={disabled || data.rows.length <= 1}
                    onClick={() => onChange(removeTableRow(data, rowIndex))}
                    className="text-[10px] whitespace-nowrap text-red-600 dark:text-red-400 disabled:opacity-40 px-1"
                  >
                    {t('dailyJournal.tableRemoveRow', { defaultValue: 'Suppr. ligne' })}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={handleAddRow}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {t('dailyJournal.tableAddRow', { defaultValue: 'Ajouter une ligne' })}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleAddColumn}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {t('dailyJournal.tableAddColumn', { defaultValue: 'Ajouter une colonne' })}
        </button>
      </div>
    </div>
  );
};
