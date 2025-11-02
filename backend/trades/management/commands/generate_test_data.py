"""
Commande Django pour générer des données de test sur plusieurs années.

Usage:
    python manage.py generate_test_data --users 3 --years 3 --trades-per-month 50
    python manage.py generate_test_data --user-email user@example.com --years 2
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from accounts.models import User
from trades.models import TradingAccount, TopStepTrade, TradeStrategy
from decimal import Decimal
from datetime import datetime, timedelta
import random
import uuid
import pytz


class Command(BaseCommand):
    help = 'Génère des données de test de trading sur plusieurs années pour quelques utilisateurs'
    
    # Contrats de futures communs avec leurs plages de prix typiques
    CONTRACTS = {
        'NQ': {  # Nasdaq E-mini
            'prefix': 'NQ',
            'price_range': (12000, 20000),
            'tick_size': Decimal('0.25'),
            'contract_value': Decimal('20'),  # $20 par point
        },
        'ES': {  # S&P 500 E-mini
            'prefix': 'ES',
            'price_range': (4000, 6000),
            'tick_size': Decimal('0.25'),
            'contract_value': Decimal('50'),  # $50 par point
        },
        'YM': {  # Dow Jones E-mini
            'prefix': 'YM',
            'price_range': (30000, 40000),
            'tick_size': Decimal('1.0'),
            'contract_value': Decimal('5'),  # $5 par point
        },
        'RTY': {  # Russell 2000 E-mini
            'prefix': 'RTY',
            'price_range': (1500, 2500),
            'tick_size': Decimal('0.10'),
            'contract_value': Decimal('50'),  # $50 par point
        },
        'CL': {  # Crude Oil
            'prefix': 'CL',
            'price_range': (60, 120),
            'tick_size': Decimal('0.01'),
            'contract_value': Decimal('1000'),  # $1000 par point
        },
        'GC': {  # Gold
            'prefix': 'GC',
            'price_range': (1800, 2300),
            'tick_size': Decimal('0.10'),
            'contract_value': Decimal('100'),  # $100 par point
        },
    }
    
    # Mois de livraison pour les futures
    MONTH_CODES = ['H', 'M', 'U', 'Z']  # Mars, Juin, Septembre, Décembre
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=3,
            help='Nombre d\'utilisateurs pour lesquels générer des données (défaut: 3)'
        )
        parser.add_argument(
            '--user-email',
            type=str,
            help='Email d\'un utilisateur spécifique (si fourni, ignore --users)'
        )
        parser.add_argument(
            '--years',
            type=int,
            default=3,
            help='Nombre d\'années de données à générer (défaut: 3)'
        )
        parser.add_argument(
            '--trades-per-month',
            type=int,
            default=50,
            help='Nombre moyen de trades par mois (défaut: 50)'
        )
        parser.add_argument(
            '--win-rate',
            type=float,
            default=0.45,
            help='Taux de trades gagnants (0.0-1.0, défaut: 0.45)'
        )
        parser.add_argument(
            '--skip-strategies',
            action='store_true',
            help='Ne pas générer de données de stratégie pour les trades'
        )
    
    def handle(self, *args, **options):
        num_users = options['users']
        user_email = options.get('user_email')
        years = options['years']
        trades_per_month = options['trades_per_month']
        win_rate = options['win_rate']
        skip_strategies = options['skip_strategies']
        
        self.stdout.write(self.style.SUCCESS('=== Génération de données de test ===\n'))
        
        # Récupérer ou créer les utilisateurs
        if user_email:
            try:
                users = [User.objects.get(email=user_email)]
            except User.DoesNotExist:
                raise CommandError(f'L\'utilisateur avec l\'email "{user_email}" n\'existe pas')
        else:
            # Exclure AnonymousUser et les utilisateurs sans email valide
            users = list(User.objects.exclude(
                username='AnonymousUser'
            ).exclude(
                email__isnull=True
            ).exclude(
                email=''
            )[:num_users])
            if len(users) < num_users:
                self.stdout.write(
                    self.style.WARNING(
                        f'Seulement {len(users)} utilisateur(s) trouvé(s), '
                        f'génération de données pour {len(users)} utilisateur(s)'
                    )
                )
        
        if not users:
            raise CommandError('Aucun utilisateur trouvé dans la base de données')
        
        # Calculer la période (dates naives pour itération)
        end_date_aware = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date_aware = end_date_aware - timedelta(days=years * 365)
        
        # Convertir en dates naives pour itération
        if timezone.is_aware(end_date_aware):
            end_date = end_date_aware.astimezone(pytz.UTC).replace(tzinfo=None)
            start_date = start_date_aware.astimezone(pytz.UTC).replace(tzinfo=None)
        else:
            end_date = end_date_aware
            start_date = start_date_aware
        
        self.stdout.write(f'Période: {start_date.date()} à {end_date.date()}')
        self.stdout.write(f'Utilisateurs: {len(users)}')
        self.stdout.write(f'Trades par mois (moyenne): {trades_per_month}')
        self.stdout.write(f'Taux de gain: {win_rate*100:.1f}%\n')
        
        total_trades = 0
        total_strategies = 0
        
        for user in users:
            self.stdout.write(f'\n--- Traitement de {user.email} ---')
            
            # Créer un compte de trading si nécessaire
            account = self._get_or_create_account(user)
            
            # Générer les trades
            with transaction.atomic():
                trades = self._generate_trades(
                    user=user,
                    account=account,
                    start_date=start_date,
                    end_date=end_date,
                    trades_per_month=trades_per_month,
                    win_rate=win_rate
                )
                total_trades += len(trades)
                
                # Générer des stratégies pour certains trades
                if not skip_strategies and trades:
                    strategies = self._generate_strategies(user, trades)
                    total_strategies += len(strategies)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ {len(trades)} trades générés pour {user.email}'
                )
            )
        
        self.stdout.write(self.style.SUCCESS(
            f'\n=== Génération terminée ===\n'
            f'Total trades: {total_trades}\n'
            f'Total stratégies: {total_strategies}'
        ))
    
    def _get_or_create_account(self, user):
        """Récupère ou crée un compte de trading par défaut pour l'utilisateur."""
        account = TradingAccount.objects.filter(
            user=user,
            is_default=True
        ).first()
        
        if not account:
            # Créer un compte par défaut
            account = TradingAccount.objects.create(
                user=user,
                name='Compte Principal',
                account_type='topstep',
                currency='USD',
                status='active',
                is_default=True,
                description='Compte de trading généré pour les tests'
            )
            self.stdout.write(f'  ✓ Compte de trading créé: {account.name}')
        
        return account
    
    def _generate_trades(self, user, account, start_date, end_date, trades_per_month, win_rate):
        """Génère des trades pour un utilisateur sur la période donnée."""
        trades = []
        current_date = start_date
        
        # Générer des trades jour par jour
        while current_date < end_date:
            # Nombre de trades ce jour (variable selon le jour de la semaine)
            day_of_week = current_date.weekday()
            
            # Moins de trades le week-end, plus en semaine
            if day_of_week >= 5:  # Samedi/Dimanche
                daily_trades = random.randint(0, 3)
            else:  # Semaine
                # Variation autour de la moyenne mensuelle
                base_daily = trades_per_month / 22  # ~22 jours de trading par mois
                daily_trades = random.randint(
                    max(0, int(base_daily * 0.5)),
                    int(base_daily * 1.5) + 1
                )
            
            # Générer les trades de la journée
            for _ in range(daily_trades):
                trade = self._create_random_trade(
                    user=user,
                    account=account,
                    date=current_date,
                    win_rate=win_rate
                )
                if trade:
                    trades.append(trade)
            
            # Avancer d'un jour
            current_date += timedelta(days=1)
        
        return trades
    
    def _create_random_trade(self, user, account, date, win_rate):
        """Crée un trade aléatoire pour une date donnée."""
        # Sélectionner un contrat aléatoire
        contract_key = random.choice(list(self.CONTRACTS.keys()))
        contract_info = self.CONTRACTS[contract_key]
        
        # Générer le nom du contrat (ex: NQZ5 pour Nasdaq Décembre 2025)
        # Utiliser le mois de livraison approprié selon la date
        year = date.year
        month = date.month
        
        # Trouver le mois de livraison suivant (H, M, U, ou Z)
        if month <= 3:
            month_code = 'H'  # Mars
        elif month <= 6:
            month_code = 'M'  # Juin
        elif month <= 9:
            month_code = 'U'  # Septembre
        else:
            month_code = 'Z'  # Décembre
        
        # Pour plus de réalisme, parfois utiliser le contrat du trimestre suivant
        if random.random() < 0.3:
            month_codes = ['H', 'M', 'U', 'Z']
            current_idx = month_codes.index(month_code)
            month_code = month_codes[(current_idx + 1) % 4]
            if month_code == 'H':
                year += 1
        
        contract_name = f"{contract_info['prefix']}{month_code}{str(year)[-1]}"
        
        # Générer les prix
        price_range = contract_info['price_range']
        base_price = random.uniform(price_range[0], price_range[1])
        tick_size = contract_info['tick_size']
        
        # Arrondir au tick size
        entry_price = Decimal(str(round(base_price / float(tick_size)) * float(tick_size)))
        
        # Déterminer si le trade est gagnant
        is_winner = random.random() < win_rate
        
        # Générer le type (Long ou Short)
        trade_type = random.choice(['Long', 'Short'])
        
        # Générer la taille (nombre de contrats)
        size = Decimal(str(random.choice([1, 1, 1, 2, 2, 3, 4, 5])))  # Plus de 1 contrat
        
        # Calculer le prix de sortie selon le résultat
        contract_value = contract_info['contract_value']
        
        # PnL cible (en points)
        if is_winner:
            # Gains: 5 à 50 points selon le contrat
            pnl_points = Decimal(str(random.uniform(5, 50)))
        else:
            # Pertes: -50 à -5 points
            pnl_points = Decimal(str(random.uniform(-50, -5)))
        
        # Calculer le prix de sortie (différence en points)
        if trade_type == 'Long':
            # Long: prix monte = gain, prix baisse = perte
            exit_price = entry_price + pnl_points
        else:  # Short
            # Short: prix baisse = gain, prix monte = perte
            exit_price = entry_price - pnl_points
        
        # Arrondir au tick size
        exit_price = Decimal(str(round(float(exit_price) / float(tick_size)) * float(tick_size)))
        
        # Calculer le PnL brut (différence en points * valeur par point * taille)
        if trade_type == 'Long':
            price_diff = exit_price - entry_price
        else:  # Short
            price_diff = entry_price - exit_price
        
        pnl = price_diff * contract_value * size
        
        # Générer les heures d'entrée et de sortie
        # Heures de trading futures: 6h-20h (UTC) approximativement
        hour = random.randint(6, 19)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        
        # Créer une date naive puis la rendre timezone-aware
        entered_at_naive = datetime(
            date.year, date.month, date.day,
            hour, minute, second, 0
        )
        entered_at = pytz.UTC.localize(entered_at_naive)
        
        # Durée du trade: 1 minute à 4 heures
        duration_minutes = random.randint(1, 240)
        exited_at = entered_at + timedelta(minutes=duration_minutes)
        
        # Générer les frais et commissions
        # Frais typiques: $2-8 par contrat
        fees_per_contract = Decimal(str(random.uniform(2.0, 8.0)))
        fees = fees_per_contract * size
        
        commissions = Decimal(str(random.uniform(0.5, 2.0))) * size
        
        # Générer un ID TopStep unique
        topstep_id = f"TEST-{uuid.uuid4().hex[:20]}"
        
        # Créer le trade
        trade = TopStepTrade.objects.create(
            user=user,
            trading_account=account,
            topstep_id=topstep_id,
            contract_name=contract_name,
            entered_at=entered_at,
            exited_at=exited_at,
            entry_price=entry_price,
            exit_price=exit_price,
            fees=fees,
            commissions=commissions,
            pnl=pnl,
            size=size,
            trade_type=trade_type,
            trade_day=date.date(),
            trade_duration=timedelta(minutes=duration_minutes),
            raw_data={
                'generated': True,
                'test_data': True
            }
        )
        
        return trade
    
    def _generate_strategies(self, user, trades):
        """Génère des données de stratégie pour certains trades."""
        strategies = []
        
        # Sélectionner ~30% des trades pour avoir des stratégies
        selected_trades = random.sample(trades, min(int(len(trades) * 0.3), len(trades)))
        
        emotions_list = [
            'confiance', 'peur', 'avarice', 'frustration', 'impatience',
            'patience', 'euphorie', 'anxiete', 'satisfaction', 'deception',
            'calme', 'stress', 'determination', 'doute'
        ]
        
        for trade in selected_trades:
            # Ne créer qu'une stratégie si elle n'existe pas déjà
            if TradeStrategy.objects.filter(user=user, trade=trade).exists():
                continue
            
            is_winner = trade.net_pnl and trade.net_pnl > 0
            
            # Sélectionner des émotions selon le résultat
            if is_winner:
                possible_emotions = ['confiance', 'satisfaction', 'euphorie', 'calme', 'determination']
            else:
                possible_emotions = ['frustration', 'peur', 'anxiete', 'deception', 'stress', 'doute']
            
            dominant_emotions = random.sample(possible_emotions, random.randint(1, 3))
            
            strategy = TradeStrategy.objects.create(
                user=user,
                trade=trade,
                strategy_respected=random.choice([True, False, None]),
                dominant_emotions=dominant_emotions,
                gain_if_strategy_respected=random.choice([True, False, None]) if not is_winner else None,
                tp1_reached=random.choice([True, False]) if is_winner else False,
                tp2_plus_reached=random.choice([True, False]) if is_winner else False,
                session_rating=random.randint(1, 5),
                emotion_details=f"Trade {'gagnant' if is_winner else 'perdant'} généré automatiquement",
                possible_improvements="Données de test - pas d'améliorations spécifiques" if not is_winner else ""
            )
            
            strategies.append(strategy)
        
        return strategies

