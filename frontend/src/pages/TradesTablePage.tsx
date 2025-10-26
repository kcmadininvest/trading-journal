import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { tradesService, PaginatedTradesResponse } from '../services/trades'
import Card from '../components/common/Card'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Pagination from '../components/common/Pagination'
import TradingAccountSelector from '../components/TradingAccount/TradingAccountSelector'
import { TradingAccount } from '../types'
import { useSelectedAccountCurrency } from '../hooks/useSelectedAccountCurrency'

function TradesTablePage() {
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterContract, setFilterContract] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; tradeId: number | null; tradeInfo: string }>({
    isOpen: false,
    tradeId: null,
    tradeInfo: ''
  })
  
  // États pour les filtres de date
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // États pour les totaux globaux
  const [globalTotals, setGlobalTotals] = useState({ totalPnl: 0, totalFees: 0, totalNetPnl: 0 })
  
  // État pour le compte de trading sélectionné
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null)
  const selectedCurrency = useSelectedAccountCurrency(selectedAccount)

  // Fonction pour charger les trades avec pagination
  const loadTrades = useCallback(async (page: number = currentPage, pageSize: number = itemsPerPage) => {
    try {
      setLoading(true)
      const filters = {
        type: filterType || undefined,
        contract: filterContract || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      }
      
      const response: PaginatedTradesResponse = await tradesService.getTradesPaginated(page, pageSize, selectedAccount?.id, filters)
      setTrades(response.results)
      setTotalItems(response.count)
      setTotalPages(Math.ceil(response.count / pageSize))
    } catch (error) {
      console.error('Erreur lors du chargement des trades:', error)
      setTrades([])
      setTotalItems(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, itemsPerPage, filterType, filterContract, startDate, endDate, selectedAccount?.id])

  // Fonction pour charger les totaux globaux (filtrés par compte)
  const loadGlobalTotals = useCallback(async () => {
    try {
      const response = await tradesService.getTradesPaginated(1, 1000, selectedAccount?.id) // Récupérer les trades du compte sélectionné
      const allTrades = response.results
      
      const totalPnl = allTrades.reduce((sum, trade) => sum + (trade.pnl ? parseFloat(trade.pnl) : 0), 0)
      const totalFees = allTrades.reduce((sum, trade) => sum + (trade.fees ? parseFloat(trade.fees) : 0), 0)
      const totalNetPnl = allTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl), 0)
      
      setGlobalTotals({ totalPnl, totalFees, totalNetPnl })
    } catch (error) {
      console.error('Erreur lors du chargement des totaux globaux:', error)
    }
  }, [selectedAccount?.id])

  // Recharger les trades et totaux quand le compte change
  useEffect(() => {
    if (selectedAccount) {
      loadTrades(1, itemsPerPage)
      loadGlobalTotals()
    }
  }, [selectedAccount, loadTrades, loadGlobalTotals, itemsPerPage])

  useEffect(() => {
    loadTrades()
  }, [currentPage, itemsPerPage, filterType, filterContract, startDate, endDate, loadTrades])

  useEffect(() => {
    loadGlobalTotals()
  }, [loadGlobalTotals])

  useEffect(() => {
    function onTradesUpdated() {
      // Recharger la page actuelle quand les trades sont mis à jour
      loadTrades(currentPage, itemsPerPage)
      // Recharger aussi les totaux globaux
      loadGlobalTotals()
    }
    window.addEventListener('trades:updated', onTradesUpdated)
    return () => window.removeEventListener('trades:updated', onTradesUpdated)
  }, [currentPage, itemsPerPage, loadTrades, loadGlobalTotals])

  // Fonction pour supprimer un trade
  const handleDeleteTrade = (tradeId: number) => {
    const trade = trades.find(t => t.id === tradeId)
    if (!trade) return
    
    setConfirmDelete({
      isOpen: true,
      tradeId,
      tradeInfo: `${trade.topstep_id} (${trade.contract_name})`
    })
  }

  const confirmDeleteTrade = async () => {
    if (!confirmDelete.tradeId) return
    
    try {
      await tradesService.deleteTrade(confirmDelete.tradeId)
      
      // Recharger les données
      loadTrades(currentPage, itemsPerPage)
      loadGlobalTotals()
      
      // Déclencher l'événement pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('trades:updated'))
      
      setConfirmDelete({ isOpen: false, tradeId: null, tradeInfo: '' })
    } catch (error: any) {
      console.error('Erreur lors de la suppression du trade:', error)
      
      // Gestion spécifique des erreurs
      if (error.response?.status === 404) {
        alert('Ce trade n\'existe plus. Il a peut-être déjà été supprimé.')
        // Recharger les données pour mettre à jour la liste
        loadTrades(currentPage, itemsPerPage)
        loadGlobalTotals()
      } else if (error.response?.status === 500) {
        alert('Erreur serveur lors de la suppression. Veuillez réessayer.')
      } else {
        alert('Erreur lors de la suppression du trade. Veuillez réessayer.')
      }
    }
  }

  const cancelDeleteTrade = () => {
    setConfirmDelete({ isOpen: false, tradeId: null, tradeInfo: '' })
  }

  // Les filtres sont maintenant gérés côté serveur, donc on utilise directement les trades
  const filteredTrades = trades

  // Calcul des totaux pour les trades affichés
  const totals = useMemo(() => {
    if (filteredTrades.length === 0) {
      return { totalPnl: 0, totalFees: 0, totalNetPnl: 0 }
    }

    const totalPnl = filteredTrades.reduce((sum, trade) => sum + (trade.pnl ? parseFloat(trade.pnl) : 0), 0)
    const totalFees = filteredTrades.reduce((sum, trade) => sum + (trade.fees ? parseFloat(trade.fees) : 0), 0)
    const totalNetPnl = filteredTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl), 0)

    return { totalPnl, totalFees, totalNetPnl }
  }, [filteredTrades])

  // Pour les contrats uniques, on doit charger tous les trades (sans pagination) pour avoir la liste complète
  const [allContracts, setAllContracts] = useState<string[]>([])
  
  useEffect(() => {
    const loadAllContracts = async () => {
      try {
        const allTrades = await tradesService.getTrades()
        const contracts = Array.from(new Set(allTrades.map((t: any) => t.contract_name))) as string[]
        setAllContracts(contracts)
      } catch (error) {
        console.error('Erreur lors du chargement des contrats:', error)
      }
    }
    loadAllContracts()
  }, [])

  function formatCurrency(value: string | number | null) {
    if (!value) return '-'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: selectedCurrency }).format(num)
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

  async function handleClearAll() {
    setConfirmOpen(true)
  }

  async function confirmClear() {
    await tradesService.clearAll()
    setTrades([])
    setTotalItems(0)
    setTotalPages(0)
    setCurrentPage(1)
    setAllContracts([])
    setConfirmOpen(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('trades:updated'))
    }
  }

  // Fonctions pour gérer la pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Retourner à la première page
  }

  // Réinitialiser à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [filterType, filterContract, startDate, endDate])

  // Recharger les données quand itemsPerPage change
  useEffect(() => {
    if (itemsPerPage) {
      loadTrades(1, itemsPerPage) // Toujours aller à la page 1 avec le nouveau pageSize
    }
  }, [itemsPerPage, loadTrades])

  return (
    <div className="w-full flex flex-col gap-6" id="trades-table">
      <Card className="overflow-hidden">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Historique des trades ({totalItems})</h2>
          </div>
        </div>

        {/* Sélecteur de compte de trading */}
        <div className="flex justify-between items-center mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Compte de trading :</span>
            <TradingAccountSelector
              selectedAccountId={selectedAccount?.id}
              onAccountChange={setSelectedAccount}
              className="flex items-center space-x-2"
            />
          </div>
          {selectedAccount && (
            <div className="text-sm text-gray-600">
              {selectedAccount.trades_count} trade{selectedAccount.trades_count > 1 ? 's' : ''} dans ce compte
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          <div className="flex gap-3 flex-wrap items-center">
            {/* Totaux globaux */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-sm font-medium text-blue-800 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Totaux globaux:
              </span>
              <div className="flex items-center gap-3 text-sm">
                <span className={`font-mono ${globalTotals.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  PnL: {globalTotals.totalPnl >= 0 ? '+' : ''}{formatCurrency(globalTotals.totalPnl)}
                </span>
                <span className="text-blue-800 font-mono">
                  Frais: {formatCurrency(globalTotals.totalFees)}
                </span>
                <span className={`font-mono ${globalTotals.totalNetPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Net: {globalTotals.totalNetPnl >= 0 ? '+' : ''}{formatCurrency(globalTotals.totalNetPnl)}
                </span>
              </div>
            </div>

            <select className="px-4 py-2.5 text-base border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer transition-all hover:border-blue-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tous les types</option>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>

            <select className="px-4 py-2.5 text-base border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer transition-all hover:border-blue-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={filterContract} onChange={e => setFilterContract(e.target.value)}>
              <option value="">Tous les contrats</option>
              {allContracts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Start Date Picker with border-integrated text */}
            <div className="relative">
              <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
                À partir du
              </div>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Afficher les trades à partir de cette date"
              />
            </div>
            
            {/* Hyphen */}
            <span className="text-gray-500 text-xl font-medium">-</span>

            {/* End Date Picker with border-integrated text */}
            <div className="relative">
              <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
                Jusqu'au
              </div>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Afficher les trades jusqu'à cette date"
              />
            </div>

            <button className="px-4 py-2.5 text-base text-gray-700 bg-transparent border border-gray-300 rounded-md hover:bg-gray-50 transition-colors" onClick={() => { setFilterType(''); setFilterContract(''); setStartDate(''); setEndDate('') }}>Réinitialiser</button>
            <button className="px-4 py-2.5 text-base text-white bg-red-600 hover:bg-red-700 border border-red-600 rounded-md transition-colors" onClick={handleClearAll}>Effacer l'historique</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 px-5">
            <p className="text-gray-500 text-base">Chargement des trades...</p>
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-16 px-5">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">Aucun trade trouvé</p>
            <p className="text-sm text-gray-500">Importez votre premier fichier CSV pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
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
                      <th className="px-3 md:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTrades.map((trade: any) => (
                      <tr key={trade.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDate(trade.entered_at)}</td>
                        <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-800">{trade.contract_name}</span>
                        </td>
                        <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
                            trade.trade_type.toLowerCase() === 'long' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            <span className="flex items-center gap-1">
                              {trade.trade_type === 'Long' ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                </svg>
                              )}
                              {trade.trade_type}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-sm text-gray-900 hidden md:table-cell">{trade.size}</td>
                        <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-900 font-mono hidden lg:table-cell">{parseFloat(trade.entry_price).toFixed(2)}</td>
                        <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-900 font-mono hidden lg:table-cell">{trade.exit_price ? parseFloat(trade.exit_price).toFixed(2) : '-'}</td>
                        <td className={`px-3 md:px-4 py-3 text-right text-sm font-semibold font-mono hidden sm:table-cell ${trade.pnl !== null && parseFloat(trade.pnl) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{trade.pnl !== null && parseFloat(trade.pnl) >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}</td>
                        <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-500 font-mono hidden md:table-cell">{formatCurrency(trade.fees)}</td>
                        <td className={`px-3 md:px-4 py-3 text-right text-sm font-bold font-mono whitespace-nowrap ${parseFloat(trade.net_pnl) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{parseFloat(trade.net_pnl) >= 0 ? '+' : ''}{formatCurrency(trade.net_pnl)}</td>
                        <td className="px-3 md:px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer ce trade"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Ligne de totaux filtrés */}
                    {filteredTrades.length > 0 && (
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td className="px-3 md:px-4 py-3 text-sm font-semibold text-gray-700" colSpan={6}>
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Totaux filtrés ({filteredTrades.length} trade{filteredTrades.length > 1 ? 's' : ''})</span>
                          </span>
                        </td>
                        <td className={`px-3 md:px-4 py-3 text-right text-sm font-bold font-mono hidden sm:table-cell ${
                          totals.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {totals.totalPnl >= 0 ? '+' : ''}
                          {formatCurrency(totals.totalPnl)}
                        </td>
                        <td className="px-3 md:px-4 py-3 text-right text-sm font-bold text-gray-700 font-mono hidden md:table-cell">
                          {formatCurrency(totals.totalFees)}
                        </td>
                        <td className={`px-3 md:px-4 py-3 text-right text-sm font-bold font-mono ${
                          totals.totalNetPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {totals.totalNetPnl >= 0 ? '+' : ''}
                          {formatCurrency(totals.totalNetPnl)}
                        </td>
                      </tr>
                    )}
                    
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Composant de pagination */}
        {!loading && totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            itemsPerPageOptions={[10, 20, 50, 100]}
            showItemsPerPageSelector={true}
          />
        )}
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Effacer l'historique"
        message="Confirmez-vous la suppression de tout l'historique des trades ? Cette action est irréversible."
        confirmLabel="Effacer"
        cancelLabel="Annuler"
        tone="danger"
        onConfirm={confirmClear}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title="Supprimer le trade"
        message={
          <div>
            <p>Êtes-vous sûr de vouloir supprimer le trade <strong>{confirmDelete.tradeInfo}</strong> ?</p>
            <p className="mt-2 text-sm text-gray-600">
              Cette action supprimera également toutes les données de stratégie associées et ne peut pas être annulée.
            </p>
          </div>
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        tone="danger"
        onConfirm={confirmDeleteTrade}
        onCancel={cancelDeleteTrade}
      />
    </div>
  )
}

export default TradesTablePage