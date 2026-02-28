#!/usr/bin/env python
"""
Script pour peupler les données analytiques de test pour la page trade-analytics.
"""
import os
import sys
import django

# Configuration Django
sys.path.append('/var/www/html/trading_journal/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal.settings')
django.setup()

from trades.models import TopStepTrade, TradeContext, TradeSetup, SessionContext, TradeExecution
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()

def populate_analytics():
    user = User.objects.first()
    if not user:
        print("Aucun utilisateur trouvé")
        return
    
    print(f"Utilisateur: {user.username}")
    
    # Récupérer les trades
    trades = TopStepTrade.objects.filter(user=user).order_by('-entered_at')[:10]
    print(f"Nombre de trades: {trades.count()}\n")
    
    # Données de test variées
    test_scenarios = [
        {
            'context': {
                'market_condition': 'trending',
                'trend_direction': 'bullish',
                'volatility_level': 'medium',
                'key_level_type': 'support',
                'distance_from_key_level': '5',
                'news_impact': 'low',
                'session_type': 'london',
            },
            'setup': {
                'setup_category': 'breakout',
                'setup_quality': 'A',
                'confluence_factors': ['volume', 'trend', 'support_resistance'],
                'risk_reward_ratio': Decimal('3.0'),
                'position_size_appropriate': True,
            },
            'session': {
                'pre_trade_mindset': 'focused',
                'physical_state': 'rested',
                'emotional_state': 'calm',
                'distractions_present': False,
                'trading_plan_reviewed': True,
            },
            'execution': {
                'entry_precision': 'excellent',
                'stop_loss_placement': 'optimal',
                'take_profit_strategy': 'scaled',
                'position_management': 'good',
                'exit_timing': 'optimal',
                'execution_errors': [],
            }
        },
        {
            'context': {
                'market_condition': 'ranging',
                'trend_direction': 'neutral',
                'volatility_level': 'low',
                'key_level_type': 'resistance',
                'distance_from_key_level': '10',
                'news_impact': 'medium',
                'session_type': 'new_york',
            },
            'setup': {
                'setup_category': 'reversal',
                'setup_quality': 'B',
                'confluence_factors': ['price_action', 'support_resistance'],
                'risk_reward_ratio': Decimal('2.0'),
                'position_size_appropriate': True,
            },
            'session': {
                'pre_trade_mindset': 'confident',
                'physical_state': 'normal',
                'emotional_state': 'neutral',
                'distractions_present': False,
                'trading_plan_reviewed': True,
            },
            'execution': {
                'entry_precision': 'good',
                'stop_loss_placement': 'good',
                'take_profit_strategy': 'fixed',
                'position_management': 'average',
                'exit_timing': 'good',
                'execution_errors': [],
            }
        },
        {
            'context': {
                'market_condition': 'trending',
                'trend_direction': 'bearish',
                'volatility_level': 'high',
                'key_level_type': 'resistance',
                'distance_from_key_level': '2',
                'news_impact': 'high',
                'session_type': 'asian',
            },
            'setup': {
                'setup_category': 'pullback',
                'setup_quality': 'A',
                'confluence_factors': ['trend', 'fibonacci', 'moving_average'],
                'risk_reward_ratio': Decimal('4.0'),
                'position_size_appropriate': True,
            },
            'session': {
                'pre_trade_mindset': 'focused',
                'physical_state': 'rested',
                'emotional_state': 'calm',
                'distractions_present': False,
                'trading_plan_reviewed': True,
            },
            'execution': {
                'entry_precision': 'excellent',
                'stop_loss_placement': 'optimal',
                'take_profit_strategy': 'trailing',
                'position_management': 'excellent',
                'exit_timing': 'optimal',
                'execution_errors': [],
            }
        },
        {
            'context': {
                'market_condition': 'choppy',
                'trend_direction': 'neutral',
                'volatility_level': 'high',
                'key_level_type': 'support',
                'distance_from_key_level': '15',
                'news_impact': 'low',
                'session_type': 'overlap',
            },
            'setup': {
                'setup_category': 'continuation',
                'setup_quality': 'C',
                'confluence_factors': ['volume'],
                'risk_reward_ratio': Decimal('1.5'),
                'position_size_appropriate': False,
            },
            'session': {
                'pre_trade_mindset': 'anxious',
                'physical_state': 'tired',
                'emotional_state': 'stressed',
                'distractions_present': True,
                'trading_plan_reviewed': False,
            },
            'execution': {
                'entry_precision': 'poor',
                'stop_loss_placement': 'too_tight',
                'take_profit_strategy': 'none',
                'position_management': 'poor',
                'exit_timing': 'premature',
                'execution_errors': ['fomo', 'moved_stop_loss', 'overtrading'],
            }
        },
        {
            'context': {
                'market_condition': 'trending',
                'trend_direction': 'bullish',
                'volatility_level': 'medium',
                'key_level_type': 'support',
                'distance_from_key_level': '8',
                'news_impact': 'medium',
                'session_type': 'london',
            },
            'setup': {
                'setup_category': 'breakout',
                'setup_quality': 'B',
                'confluence_factors': ['volume', 'price_action'],
                'risk_reward_ratio': Decimal('2.5'),
                'position_size_appropriate': True,
            },
            'session': {
                'pre_trade_mindset': 'confident',
                'physical_state': 'normal',
                'emotional_state': 'excited',
                'distractions_present': False,
                'trading_plan_reviewed': True,
            },
            'execution': {
                'entry_precision': 'good',
                'stop_loss_placement': 'good',
                'take_profit_strategy': 'scaled',
                'position_management': 'good',
                'exit_timing': 'good',
                'execution_errors': ['partial_profit_too_early'],
            }
        },
    ]
    
    # Appliquer les scénarios aux trades
    for i, trade in enumerate(trades[:5]):
        scenario = test_scenarios[i % len(test_scenarios)]
        
        print(f"\nTrade #{trade.id} - {trade.contract_name} - PnL: {trade.net_pnl}")
        
        # Context
        context, created = TradeContext.objects.update_or_create(
            trade=trade,
            defaults=scenario['context']
        )
        print(f"  ✓ Context: {scenario['context']['market_condition']} / {scenario['context']['trend_direction']}")
        
        # Setup
        setup, created = TradeSetup.objects.update_or_create(
            trade=trade,
            defaults=scenario['setup']
        )
        print(f"  ✓ Setup: {scenario['setup']['setup_category']} (Quality: {scenario['setup']['setup_quality']})")
        
        # Session
        session, created = SessionContext.objects.update_or_create(
            trade=trade,
            defaults=scenario['session']
        )
        print(f"  ✓ Session: {scenario['session']['pre_trade_mindset']} / {scenario['session']['emotional_state']}")
        
        # Execution
        execution, created = TradeExecution.objects.update_or_create(
            trade=trade,
            defaults=scenario['execution']
        )
        print(f"  ✓ Execution: {scenario['execution']['entry_precision']} entry, {len(scenario['execution']['execution_errors'])} errors")
    
    print("\n" + "="*60)
    print("✅ Données analytiques créées avec succès!")
    print("="*60)
    print("\nVous pouvez maintenant tester la page trade-analytics avec ces trades:")
    for i, trade in enumerate(trades[:5]):
        print(f"  - Trade #{trade.id}: http://localhost:3000/#trade-analytics/{trade.id}")

if __name__ == '__main__':
    populate_analytics()
