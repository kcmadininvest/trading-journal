"""
Script pour générer 40 trades avec données analytiques variées pour tester la détection des biais.
"""
import os
import sys
import django
from datetime import datetime, timedelta
from decimal import Decimal
import random
from django.utils import timezone

# Setup Django
sys.path.append('/var/www/html/trading_journal/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal_api.settings')
django.setup()

from django.contrib.auth import get_user_model
from trades.models import TopStepTrade, TradingAccount
from trades.models_analytics import SessionContext, TradeSetup, TradeExecution

User = get_user_model()

def generate_test_data():
    """Génère 40 trades avec analytics pour l'utilisateur csylvanie."""
    
    # Récupérer l'utilisateur
    try:
        user = User.objects.get(username='csylvanie')
    except User.DoesNotExist:
        print("❌ Utilisateur 'csylvanie' non trouvé")
        return
    
    # Récupérer ou créer un compte de trading
    account, _ = TradingAccount.objects.get_or_create(
        user=user,
        name='Test Account',
        defaults={
            'account_type': 'demo',
            'initial_capital': Decimal('50000.00')
        }
    )
    
    print(f"✅ Compte trouvé: {account.name}")
    
    # Date de départ (il y a 30 jours) - timezone aware
    start_date = timezone.now() - timedelta(days=30)
    
    trades_data = []
    
    # Générer 40 trades avec différents patterns de biais
    for i in range(40):
        day_offset = i // 2  # 2 trades par jour en moyenne
        hour = 9 + (i % 8)  # Entre 9h et 17h
        minute = random.randint(0, 59)
        
        entered_at = start_date + timedelta(days=day_offset, hours=hour, minutes=minute)
        duration_minutes = random.randint(5, 120)
        exited_at = entered_at + timedelta(minutes=duration_minutes)
        
        # Déterminer le type de trade pour créer des patterns
        trade_type = random.choice(['Long', 'Short'])
        
        # Patterns de biais à injecter
        is_revenge_trade = i > 0 and trades_data[i-1]['net_pnl'] < 0 and random.random() < 0.3
        is_fomo_trade = random.random() < 0.2
        is_overtrading_day = (i % 10) < 3  # 30% des jours avec overtrading
        is_loss_aversion = random.random() < 0.15
        is_premature_exit = random.random() < 0.2
        
        # Prix et PnL
        entry_price = Decimal(str(round(4500 + random.uniform(-100, 100), 2)))
        
        # Générer des résultats variés
        if is_revenge_trade:
            # Revenge trades ont tendance à perdre plus
            pnl = Decimal(str(round(random.uniform(-200, -50), 2)))
        elif is_premature_exit:
            # Premature exit = petits gains
            pnl = Decimal(str(round(random.uniform(10, 50), 2)))
        else:
            # Mix normal
            pnl = Decimal(str(round(random.uniform(-150, 200), 2)))
        
        # Calculer exit_price basé sur PnL
        size = random.randint(1, 5)
        point_value = Decimal('50.00')
        price_diff = pnl / (size * point_value)
        
        if trade_type == 'Long':
            exit_price = entry_price + price_diff
        else:
            exit_price = entry_price - price_diff
        
        # Stop loss et take profit planifiés
        if trade_type == 'Long':
            planned_stop_loss = entry_price - Decimal(str(random.uniform(10, 30)))
            planned_take_profit = entry_price + Decimal(str(random.uniform(20, 60)))
        else:
            planned_stop_loss = entry_price + Decimal(str(random.uniform(10, 30)))
            planned_take_profit = entry_price - Decimal(str(random.uniform(20, 60)))
        
        trade_data = {
            'trading_account': account,
            'topstep_id': f'TEST_{i+1:04d}_{int(entered_at.timestamp())}',
            'contract_name': 'MES',
            'trade_type': trade_type,
            'entered_at': entered_at,
            'exited_at': exited_at,
            'entry_price': entry_price,
            'exit_price': exit_price,
            'size': size,
            'point_value': point_value,
            'fees': Decimal('2.50'),
            'commissions': Decimal('1.50'),
            'pnl': pnl,
            'net_pnl': pnl - Decimal('4.00'),
            'planned_stop_loss': planned_stop_loss,
            'planned_take_profit': planned_take_profit,
            'is_revenge_trade': is_revenge_trade,
            'is_fomo_trade': is_fomo_trade,
            'is_loss_aversion': is_loss_aversion,
            'is_premature_exit': is_premature_exit,
        }
        
        trades_data.append(trade_data)
    
    print(f"\n📊 Génération de {len(trades_data)} trades...")
    
    # Créer les trades et leurs analytics
    created_count = 0
    
    for idx, trade_data in enumerate(trades_data):
        # Extraire les flags
        is_revenge = trade_data.pop('is_revenge_trade')
        is_fomo = trade_data.pop('is_fomo_trade')
        is_loss_aversion = trade_data.pop('is_loss_aversion')
        is_premature_exit = trade_data.pop('is_premature_exit')
        
        # Créer le trade
        trade = TopStepTrade.objects.create(
            user=user,
            **trade_data
        )
        
        # SessionContext
        previous_result = None
        minutes_since = None
        motivation = 'setup_signal'
        
        if idx > 0:
            prev_trade = trades_data[idx - 1]
            if prev_trade['net_pnl'] > 0:
                previous_result = 'win'
            elif prev_trade['net_pnl'] < 0:
                previous_result = 'loss'
            else:
                previous_result = 'breakeven'
            
            # Calculer minutes depuis dernier trade
            time_diff = trade.entered_at - TopStepTrade.objects.filter(
                user=user, entered_at__lt=trade.entered_at
            ).order_by('-entered_at').first().entered_at
            minutes_since = int(time_diff.total_seconds() / 60)
        else:
            previous_result = 'first_trade_of_session'
        
        if is_revenge:
            motivation = random.choice(['revenge', 'recovery_attempt'])
        elif is_fomo:
            motivation = 'fomo'
        elif random.random() < 0.1:
            motivation = 'boredom'
        else:
            motivation = random.choice(['setup_signal', 'planned'])
        
        SessionContext.objects.create(
            trade=trade,
            trading_session=random.choice(['london', 'new_york', 'overlap_london_ny']),
            day_of_week=trade.entered_at.strftime('%A').lower(),
            is_first_trade_of_day=(idx % 2 == 0),
            is_last_trade_of_day=(idx % 2 == 1),
            physical_state=random.choice(['rested', 'tired', 'optimal']),
            mental_state=random.choice(['focused', 'distracted', 'confident']),
            emotional_state=random.choice(['calm', 'anxious', 'excited']),
            hours_of_sleep=random.randint(5, 9),
            caffeine_consumed=random.choice([True, False]),
            distractions_present=random.choice([True, False]),
            previous_trade_result=previous_result,
            minutes_since_last_trade=minutes_since,
            trade_motivation=motivation,
        )
        
        # TradeSetup
        entry_in_range = None
        missed_better = False
        planned_duration = random.randint(10, 60)
        
        if is_fomo:
            entry_in_range = Decimal(str(random.uniform(75, 95)))
            missed_better = random.choice([True, False])
        else:
            entry_in_range = Decimal(str(random.uniform(20, 70)))
        
        TradeSetup.objects.create(
            trade=trade,
            setup_category=random.choice(['pullback', 'breakout', 'continuation']),
            chart_pattern=random.choice(['flag', 'triangle', 'none']),
            confluence_factors=['ema_alignment', 'volume_spike'] if random.random() > 0.5 else [],
            setup_quality=random.choice(['A', 'B', 'C', 'D']),
            setup_confidence=random.randint(5, 10),
            entry_timing='late' if is_fomo else random.choice(['early', 'optimal', 'late']),
            entry_in_range_percentage=entry_in_range,
            missed_better_entry=missed_better,
            planned_hold_duration=planned_duration,
        )
        
        # TradeExecution
        moved_sl = random.choice([True, False])
        sl_direction = 'none'
        
        if moved_sl:
            if is_loss_aversion:
                sl_direction = 'wider'
            else:
                sl_direction = random.choice(['tighter', 'wider'])
        
        time_vs_planned = 'as_planned'
        if is_loss_aversion:
            time_vs_planned = random.choice(['longer', 'much_longer'])
        elif is_premature_exit:
            time_vs_planned = random.choice(['shorter', 'much_shorter'])
        else:
            time_vs_planned = random.choice(['much_shorter', 'shorter', 'as_planned', 'longer'])
        
        exit_trigger = 'target_hit'
        if is_premature_exit:
            exit_trigger = random.choice(['fear', 'break_even'])
        elif trade_data['net_pnl'] < 0:
            exit_trigger = 'stop_hit'
        else:
            exit_trigger = random.choice(['target_hit', 'manual_discretion', 'time_based'])
        
        TradeExecution.objects.create(
            trade=trade,
            entry_as_planned=not is_fomo,
            exit_as_planned=not (is_premature_exit or is_loss_aversion),
            position_size_as_planned=not is_revenge,
            moved_stop_loss=moved_sl,
            stop_loss_direction=sl_direction,
            partial_exit_taken=random.choice([True, False]),
            exit_reason=random.choice(['take_profit_hit', 'stop_loss_hit', 'manual_exit']),
            execution_errors=['late_entry'] if is_fomo else [],
            would_take_again=trade_data['net_pnl'] > 0,
            lesson_learned=f"Trade #{idx + 1} analysis",
            time_in_position_vs_planned=time_vs_planned,
            exit_trigger=exit_trigger,
            position_size_change_reason="Increased size after loss" if is_revenge else "",
        )
        
        created_count += 1
        
        if (created_count % 10) == 0:
            print(f"  ✓ {created_count} trades créés...")
    
    print(f"\n✅ {created_count} trades avec analytics créés avec succès!")
    
    # Statistiques des patterns injectés
    revenge_count = sum(1 for t in trades_data if 'is_revenge_trade' in str(t))
    print(f"\n📈 Patterns injectés:")
    print(f"  - Revenge trades: ~{int(created_count * 0.3)}")
    print(f"  - FOMO trades: ~{int(created_count * 0.2)}")
    print(f"  - Loss aversion: ~{int(created_count * 0.15)}")
    print(f"  - Premature exits: ~{int(created_count * 0.2)}")

if __name__ == '__main__':
    print("🚀 Génération de données de test pour la détection des biais comportementaux\n")
    generate_test_data()
    print("\n✨ Terminé!")
