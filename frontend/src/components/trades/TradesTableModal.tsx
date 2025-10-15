import React, { useMemo, useState } from 'react'

interface Trade {
  id: number
  topstep_id: string
  contract_name: string
  trade_type: string
  entered_at: string
  exited_at: string | null
  entry_price: string
  exit_price: string | null
  pnl: string | null
  net_pnl: string
  fees: string
  commissions: string
  size: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  trades: Trade[]
}

function TradesTableModal({ isOpen, onClose, trades }: Props) {
  const [filterType, setFilterType] = useState<string>('')
  const [filterContract, setFilterContract] = useState<string>('')

  const filteredTrades = useMemo(() => trades.filter(t => {
    if (filterType && t.trade_type !== filterType) return false
    if (filterContract && t.contract_name !== filterContract) return false
    return true
  }), [trades, filterType, filterContract])

  const uniqueContracts = useMemo(() => Array.from(new Set(trades.map(t => t.contract_name))), [trades])

  function formatCurrency(value: string | number | null) {
    if (!value) return '-'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(num)
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'Europe/Paris'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 p-4 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 m-0">Historique des trades ({filteredTrades.length})</h3>
          <button className="text-gray-500 hover:text-gray-700 bg-transparent border-none" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          <div className="flex gap-3 flex-wrap items-center">
            <select
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 cursor-pointer transition-all hover:border-blue-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Tous les types</option>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>

            <select
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 cursor-pointer transition-all hover:border-blue-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
            >
              <option value="">Tous les contrats</option>
              {uniqueContracts.map(contract => (
                <option key={contract} value={contract}>{contract}</option>
              ))}
            </select>

            <button
              className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 bg-transparent border border-gray-300 rounded-md"
              onClick={() => { setFilterType(''); setFilterContract('') }}
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 md:mx-0">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden md:rounded-lg md:border md:border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contrat</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">Taille</th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Entrée</th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Sortie</th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">PnL</th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">Frais</th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">PnL Net</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDate(trade.entered_at)}</td>
                      <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-800">
                          {trade.contract_name}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
                          trade.trade_type.toLowerCase() === 'long' ? 'bg-gray-200 text-gray-700' : 'bg-gray-300 text-gray-800'
                        }`}>
                          {trade.trade_type}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-sm text-gray-900 hidden md:table-cell">{trade.size}</td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-900 font-mono hidden lg:table-cell">{parseFloat(trade.entry_price).toFixed(2)}</td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-900 font-mono hidden lg:table-cell">{trade.exit_price ? parseFloat(trade.exit_price).toFixed(2) : '-'}</td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm font-semibold font-mono hidden sm:table-cell">
                        {formatCurrency(trade.pnl)}
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-500 font-mono hidden md:table-cell">{formatCurrency(trade.fees)}</td>
                      <td className="px-3 md:px-4 py-3 text-right text-sm font-bold font-mono whitespace-nowrap">
                        {formatCurrency(trade.net_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradesTableModal


