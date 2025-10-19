import { tradesService } from './trades'

export interface AdaptiveGoals {
  winRate: {
    current: number
    target: number
    improvement: number
    goal: string
  }
  avgWinningTrade: {
    current: number
    target: number
    improvement: number
    goal: string
  }
  avgLosingTrade: {
    current: number
    target: number
    improvement: number
    goal: string
  }
}

export interface HistoricalPerformance {
  winRate: number
  avgWinningTrade: number
  avgLosingTrade: number
  bestWinRate: number
  bestAvgWin: number
  bestAvgLoss: number
  worstWinRate: number
  worstAvgWin: number
  worstAvgLoss: number
}

class AdaptiveGoalsService {
  /**
   * Calcule les performances historiques de l'utilisateur
   */
  async calculateHistoricalPerformance(): Promise<HistoricalPerformance> {
    try {
      const trades = await tradesService.getTrades()
      
      if (trades.length === 0) {
        return this.getDefaultPerformance()
      }

      // Calculer les métriques globales
      const totalTrades = trades.length
      const winningTrades = trades.filter(trade => parseFloat(trade.net_pnl.toString()) > 0)
      const losingTrades = trades.filter(trade => parseFloat(trade.net_pnl.toString()) < 0)
      
      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0
      const avgWinningTrade = winningTrades.length > 0 
        ? winningTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl.toString()), 0) / winningTrades.length
        : 0
      const avgLosingTrade = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl.toString()), 0) / losingTrades.length
        : 0

      // Calculer les performances par mois pour trouver les meilleures/pires
      const monthlyStats = this.calculateMonthlyStats(trades)
      
      const bestWinRate = Math.max(...monthlyStats.map(m => m.winRate), winRate)
      const bestAvgWin = Math.max(...monthlyStats.map(m => m.avgWinningTrade), avgWinningTrade)
      const bestAvgLoss = Math.min(...monthlyStats.map(m => m.avgLosingTrade), avgLosingTrade) // Plus proche de 0
      
      const worstWinRate = Math.min(...monthlyStats.map(m => m.winRate), winRate)
      const worstAvgWin = Math.min(...monthlyStats.map(m => m.avgWinningTrade), avgWinningTrade)
      const worstAvgLoss = Math.min(...monthlyStats.map(m => m.avgLosingTrade), avgLosingTrade) // Plus négatif

      return {
        winRate,
        avgWinningTrade,
        avgLosingTrade,
        bestWinRate,
        bestAvgWin,
        bestAvgLoss,
        worstWinRate,
        worstAvgWin,
        worstAvgLoss
      }
    } catch (error) {
      console.error('Error calculating historical performance:', error)
      return this.getDefaultPerformance()
    }
  }

  /**
   * Calcule les objectifs adaptatifs basés sur les performances historiques
   */
  async calculateAdaptiveGoals(): Promise<AdaptiveGoals> {
    const performance = await this.calculateHistoricalPerformance()
    
    // Win Rate adaptatif
    const winRateTarget = this.calculateWinRateTarget(performance)
    const winRateImprovement = winRateTarget - performance.winRate
    
    // Avg Winning Trade adaptatif
    const avgWinTarget = this.calculateAvgWinTarget(performance)
    const avgWinImprovement = avgWinTarget - performance.avgWinningTrade
    
    // Avg Losing Trade adaptatif (on veut réduire les pertes)
    const avgLossTarget = this.calculateAvgLossTarget(performance)
    const avgLossImprovement = avgLossTarget - performance.avgLosingTrade // Sera positif car on améliore

    return {
      winRate: {
        current: performance.winRate,
        target: winRateTarget,
        improvement: winRateImprovement,
        goal: this.generateWinRateGoal(performance, winRateTarget)
      },
      avgWinningTrade: {
        current: performance.avgWinningTrade,
        target: avgWinTarget,
        improvement: avgWinImprovement,
        goal: this.generateAvgWinGoal(performance, avgWinTarget)
      },
      avgLosingTrade: {
        current: performance.avgLosingTrade,
        target: avgLossTarget,
        improvement: avgLossImprovement,
        goal: this.generateAvgLossGoal(performance, avgLossTarget)
      }
    }
  }

  /**
   * Calcule l'objectif de win rate adaptatif
   */
  private calculateWinRateTarget(performance: HistoricalPerformance): number {
    const current = performance.winRate
    // const best = performance.bestWinRate
    
    // Si le win rate actuel est déjà excellent (>= 60%), objectif plus ambitieux
    if (current >= 60) {
      return Math.min(current + 5, 70) // +5% max, plafonné à 70%
    }
    
    // Si le win rate actuel est bon (>= 50%), objectif modéré
    if (current >= 50) {
      return Math.min(current + 8, 65) // +8% max, plafonné à 65%
    }
    
    // Si le win rate actuel est faible (< 50%), objectif progressif
    if (current >= 40) {
      return Math.min(current + 10, 55) // +10% max, plafonné à 55%
    }
    
    // Win rate très faible, objectif de base
    return Math.min(current + 15, 50) // +15% max, plafonné à 50%
  }

  /**
   * Calcule l'objectif de moyenne des trades gagnants adaptatif
   */
  private calculateAvgWinTarget(performance: HistoricalPerformance): number {
    const current = performance.avgWinningTrade
    const best = performance.bestAvgWin
    
    // Objectif basé sur la meilleure performance ou une amélioration de 20%
    const targetFromBest = best * 0.95 // 95% de la meilleure performance
    const targetFromCurrent = current * 1.2 // 120% de la performance actuelle
    
    return Math.max(targetFromBest, targetFromCurrent)
  }

  /**
   * Calcule l'objectif de moyenne des trades perdants adaptatif
   */
  private calculateAvgLossTarget(performance: HistoricalPerformance): number {
    const current = performance.avgLosingTrade // Négatif
    const best = performance.bestAvgLoss // Moins négatif
    
    // Objectif : réduire les pertes (se rapprocher de 0)
    const targetFromBest = best * 0.9 // 90% de la meilleure performance (moins négatif)
    const targetFromCurrent = current * 0.8 // 80% de la performance actuelle (moins négatif)
    
    return Math.max(targetFromBest, targetFromCurrent) // Le moins négatif des deux
  }

  /**
   * Génère le texte d'objectif pour le win rate
   */
  private generateWinRateGoal(performance: HistoricalPerformance, target: number): string {
    const improvement = target - performance.winRate
    const best = performance.bestWinRate
    
    if (target >= best) {
      return `Atteindre ${target.toFixed(1)}% (nouveau record personnel)`
    } else if (improvement > 0) {
      return `Améliorer de ${performance.winRate.toFixed(1)}% à ${target.toFixed(1)}% (+${improvement.toFixed(1)}%)`
    } else {
      return `Maintenir ${performance.winRate.toFixed(1)}% (performance excellente)`
    }
  }

  /**
   * Génère le texte d'objectif pour la moyenne des trades gagnants
   */
  private generateAvgWinGoal(performance: HistoricalPerformance, target: number): string {
    const improvement = target - performance.avgWinningTrade
    const best = performance.bestAvgWin
    
    if (target >= best) {
      return `Atteindre $${target.toFixed(0)} (nouveau record personnel)`
    } else if (improvement > 0) {
      return `Augmenter de $${performance.avgWinningTrade.toFixed(0)} à $${target.toFixed(0)} (+$${improvement.toFixed(0)})`
    } else {
      return `Maintenir $${performance.avgWinningTrade.toFixed(0)} (performance excellente)`
    }
  }

  /**
   * Génère le texte d'objectif pour la moyenne des trades perdants
   */
  private generateAvgLossGoal(performance: HistoricalPerformance, target: number): string {
    const improvement = performance.avgLosingTrade - target // Positif car on améliore
    const best = performance.bestAvgLoss
    
    if (target >= best) {
      return `Réduire à $${target.toFixed(0)} (nouveau record personnel)`
    } else if (improvement > 0) {
      return `Réduire de $${performance.avgLosingTrade.toFixed(0)} à $${target.toFixed(0)} (amélioration de $${improvement.toFixed(0)})`
    } else {
      return `Maintenir $${performance.avgLosingTrade.toFixed(0)} (performance excellente)`
    }
  }

  /**
   * Calcule les statistiques mensuelles
   */
  private calculateMonthlyStats(trades: any[]): Array<{
    winRate: number
    avgWinningTrade: number
    avgLosingTrade: number
  }> {
    const monthlyData: { [key: string]: any[] } = {}
    
    // Grouper les trades par mois
    trades.forEach(trade => {
      const date = new Date(trade.entered_at)
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = []
      }
      monthlyData[monthKey].push(trade)
    })
    
    // Calculer les stats pour chaque mois
    return Object.values(monthlyData).map(monthTrades => {
      const totalTrades = monthTrades.length
      const winningTrades = monthTrades.filter(trade => parseFloat(trade.net_pnl.toString()) > 0)
      const losingTrades = monthTrades.filter(trade => parseFloat(trade.net_pnl.toString()) < 0)
      
      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0
      const avgWinningTrade = winningTrades.length > 0 
        ? winningTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl.toString()), 0) / winningTrades.length
        : 0
      const avgLosingTrade = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + parseFloat(trade.net_pnl.toString()), 0) / losingTrades.length
        : 0
      
      return { winRate, avgWinningTrade, avgLosingTrade }
    })
  }

  /**
   * Retourne des performances par défaut si aucune donnée
   */
  private getDefaultPerformance(): HistoricalPerformance {
    return {
      winRate: 0,
      avgWinningTrade: 0,
      avgLosingTrade: 0,
      bestWinRate: 0,
      bestAvgWin: 0,
      bestAvgLoss: 0,
      worstWinRate: 0,
      worstAvgWin: 0,
      worstAvgLoss: 0
    }
  }
}

export const adaptiveGoalsService = new AdaptiveGoalsService()