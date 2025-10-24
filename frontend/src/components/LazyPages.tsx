import { lazy } from 'react'

// Lazy loading des pages principales
export const LazyHomePage = lazy(() => import('../pages/HomePage'))
export const LazyTradesPage = lazy(() => import('../pages/TradesPage'))
export const LazyTradesTablePage = lazy(() => import('../pages/TradesTablePage'))
export const LazyStrategyPage = lazy(() => import('../pages/StrategyPage'))
export const LazyStatisticsPage = lazy(() => import('../pages/StatisticsPageOptimized'))
export const LazyAnalyticsPage = lazy(() => import('../pages/AnalyticsPage'))
export const LazyTradingAccountsPage = lazy(() => import('../pages/TradingAccountsPage'))
export const LazySettingsPage = lazy(() => import('../pages/SettingsPage'))
export const LazyArchivesPage = lazy(() => import('../pages/ArchivesPage'))
export const LazyPositionStrategiesPage = lazy(() => import('../pages/PositionStrategiesPage'))

// Lazy loading des composants lourds
export const LazyYearlyCalendar = lazy(() => import('../components/Strategy/YearlyCalendar'))
export const LazyYearlyStrategyRespectChart = lazy(() => import('../components/Strategy/YearlyStrategyRespectChart'))
export const LazyYearlyWinRateByStrategyChart = lazy(() => import('../components/Strategy/YearlyWinRateByStrategyChart'))
export const LazyYearlySessionWinRateChart = lazy(() => import('../components/Strategy/YearlySessionWinRateChart'))
export const LazyYearlyEmotionsChart = lazy(() => import('../components/Strategy/YearlyEmotionsChart'))

// Lazy loading des graphiques d'analytics
export const LazyPerformanceChart = lazy(() => import('../components/charts/PerformanceChart'))
export const LazyWaterfallChart = lazy(() => import('../components/charts/WaterfallChart'))
export const LazyHourlyPerformanceChart = lazy(() => import('../components/charts/HourlyPerformanceChart'))
export const LazyPnlTradesCorrelationChart = lazy(() => import('../components/charts/PnlTradesCorrelationChart'))
export const LazyDrawdownChart = lazy(() => import('../components/charts/DrawdownChart'))
export const LazyWeekdayPerformanceChart = lazy(() => import('../components/charts/WeekdayPerformanceChart'))
