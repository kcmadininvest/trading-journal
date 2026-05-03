"""
Utilitaires pour l'import de trades depuis TopStep.
"""
import csv
from decimal import Decimal
from django.db import transaction
from .models import TopStepTrade, TopStepImportLog, TradingAccount
from .contract_utils.contract_specs import get_point_value_from_contract


def _recalculate_mll_for_topstep_accounts(accounts):
    """Recalcule les métriques MLL pour chaque compte TopStep distinct."""
    from .services import AccountMetricsCalculator

    calculator = AccountMetricsCalculator()
    seen_ids = set()
    for acct in accounts:
        if not acct or not acct.is_topstep or acct.id in seen_ids:
            continue
        seen_ids.add(acct.id)
        trade_dates = (
            acct.topstep_trades.filter(trade_day__isnull=False)
            .values_list('trade_day', flat=True)
            .distinct()
            .order_by('trade_day')
        )
        for trade_date in trade_dates:
            calculator.calculate_metrics_for_date(acct, trade_date)


class TopStepCSVImporter:
    """
    Classe pour importer des fichiers CSV TopStep.

    Format attendu:
    Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
    """

    REQUIRED_COLUMNS = [
        'Id', 'ContractName', 'EnteredAt', 'ExitedAt', 'EntryPrice',
        'ExitPrice', 'Fees', 'PnL', 'Size', 'Type', 'TradeDay',
        'TradeDuration', 'Commissions'
    ]

    def __init__(self, user, trading_account=None, target_accounts=None):
        self.user = user
        if target_accounts is not None:
            self.target_accounts = [a for a in target_accounts if a is not None]
        elif trading_account is not None:
            self.target_accounts = [trading_account]
        else:
            self.target_accounts = []
        # Compatibilité : premier compte = compte « principal » du fichier
        self.trading_account = self.target_accounts[0] if self.target_accounts else None
        self.errors = []
        self.success_count = 0
        self.error_count = 0
        self.skipped_count = 0
        self.total_pnl = Decimal('0')
        self.total_fees = Decimal('0')

    def _resolve_default_account(self):
        """Compte par défaut si aucune cible n'est fournie."""
        return TradingAccount.objects.filter(user=self.user, is_default=True).first()

    def _ensure_targets(self):
        if not self.target_accounts:
            acct = self._resolve_default_account()
            if acct:
                self.target_accounts = [acct]
                self.trading_account = acct
        if not self.target_accounts:
            raise ValueError("Aucun compte de trading par défaut trouvé pour cet utilisateur")

    def _row_exists(self, topstep_id, trading_account):
        return TopStepTrade.objects.filter(
            user=self.user,
            trading_account=trading_account,
            topstep_id=topstep_id,
        ).exists()

    def _parse_row(self, row, row_num):
        """Parse commun CSV → dict pour création / validation."""
        topstep_id = row['Id'].strip()
        entered_at = TopStepTrade.parse_us_datetime(row['EnteredAt'])
        exited_at = TopStepTrade.parse_us_datetime(row['ExitedAt']) if row['ExitedAt'].strip() else None

        trade_day = None
        if row['TradeDay'].strip():
            try:
                trade_day_dt = TopStepTrade.parse_us_datetime(row['TradeDay'])
                trade_day = trade_day_dt.date()
            except Exception:
                trade_day = entered_at.date()
        else:
            trade_day = entered_at.date()

        entry_price = TopStepTrade.parse_us_decimal(row['EntryPrice'])
        exit_price = TopStepTrade.parse_us_decimal(row['ExitPrice'])
        fees = TopStepTrade.parse_us_decimal(row['Fees']) or Decimal('0')
        size = TopStepTrade.parse_us_decimal(row['Size'])
        commissions = TopStepTrade.parse_us_decimal(row['Commissions']) or Decimal('0')
        trade_duration = TopStepTrade.parse_duration(row['TradeDuration'])
        trade_type = row['Type'].strip()
        if trade_type not in ['Long', 'Short']:
            raise ValueError(f"Type de trade invalide: {trade_type} (ligne {row_num})")

        contract_name = row['ContractName'].strip()
        point_value = get_point_value_from_contract(contract_name)

        return {
            'topstep_id': topstep_id,
            'entered_at': entered_at,
            'exited_at': exited_at,
            'trade_day': trade_day,
            'entry_price': entry_price,
            'exit_price': exit_price,
            'fees': fees,
            'size': size,
            'commissions': commissions,
            'trade_duration': trade_duration,
            'trade_type': trade_type,
            'contract_name': contract_name,
            'point_value': point_value,
            'raw_row': dict(row),
        }

    def _estimated_pnl(self, parsed):
        entry_price = parsed['entry_price']
        exit_price = parsed['exit_price']
        size = parsed['size']
        trade_type = parsed['trade_type']
        point_value = parsed['point_value']
        if entry_price and exit_price and size:
            if trade_type == 'Long':
                price_diff = exit_price - entry_price
            else:
                price_diff = entry_price - exit_price
            if point_value:
                return price_diff * Decimal(str(point_value)) * size
            return price_diff * size
        return Decimal('0')

    def _import_row_for_account(self, parsed, row_num, trading_account):
        """Crée un trade pour un compte donné. Retourne l'instance ou None si doublon."""
        if self._row_exists(parsed['topstep_id'], trading_account):
            return None
        trade = TopStepTrade.objects.create(
            user=self.user,
            trading_account=trading_account,
            topstep_id=parsed['topstep_id'],
            contract_name=parsed['contract_name'],
            entered_at=parsed['entered_at'],
            exited_at=parsed['exited_at'],
            entry_price=parsed['entry_price'],
            exit_price=parsed['exit_price'],
            fees=parsed['fees'],
            size=parsed['size'],
            trade_type=parsed['trade_type'],
            trade_day=parsed['trade_day'],
            trade_duration=parsed['trade_duration'],
            commissions=parsed['commissions'],
            point_value=parsed['point_value'],
            raw_data=parsed['raw_row'],
        )
        return trade

    def import_from_file(self, file_path, filename=None):
        if filename is None:
            filename = file_path.split('/')[-1]

        total_rows = 0

        try:
            self._ensure_targets()
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)

                is_valid, missing_columns = self._validate_columns(reader.fieldnames)
                if not is_valid:
                    missing_cols_str = ', '.join(missing_columns)  # type: ignore
                    return {
                        'success': False,
                        'error': f'Format de fichier invalide. Colonnes manquantes : {missing_cols_str}',
                        'missing_columns': missing_columns,
                        'total_rows': 0,
                        'success_count': 0,
                        'error_count': 0
                    }

                with transaction.atomic():  # type: ignore
                    for row_num, row in enumerate(reader, start=2):
                        total_rows += 1
                        try:
                            parsed = self._parse_row(row, row_num)
                            for acct in self.target_accounts:
                                trade = self._import_row_for_account(parsed, row_num, acct)
                                if trade:
                                    self.success_count += 1
                                else:
                                    self.skipped_count += 1
                        except Exception as e:
                            error_msg = str(e)
                            if "déjà importé" in error_msg:
                                self.skipped_count += 1
                            else:
                                self.error_count += 1
                                self.errors.append({
                                    'row': row_num,
                                    'error': error_msg,
                                    'data': row
                                })

                    TopStepImportLog.objects.create(
                        user=self.user,
                        filename=filename,
                        total_rows=total_rows,
                        success_count=self.success_count,
                        error_count=self.error_count,
                        skipped_count=self.skipped_count,
                        errors=self.errors if self.errors else None
                    )

                    _recalculate_mll_for_topstep_accounts(self.target_accounts)

            return {
                'success': True,
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count,
                'skipped_count': self.skipped_count,
                'errors': self.errors,
                'copy_accounts_count': max(0, len(self.target_accounts) - 1),
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Erreur lors de la lecture du fichier: {str(e)}',
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count
            }

    def import_from_string(self, csv_content, filename='upload.csv', dry_run=False):
        total_rows = 0
        self.total_pnl = Decimal('0')
        self.total_fees = Decimal('0')

        try:
            self._ensure_targets()
            reader = csv.DictReader(csv_content.splitlines())

            is_valid, missing_columns = self._validate_columns(reader.fieldnames)
            if not is_valid:
                missing_cols_str = ', '.join(missing_columns)  # type: ignore
                return {
                    'success': False,
                    'error': f'Format de fichier invalide. Colonnes manquantes : {missing_cols_str}',
                    'missing_columns': missing_columns,
                    'total_rows': 0,
                    'success_count': 0,
                    'error_count': 0
                }

            if dry_run:
                for row_num, row in enumerate(reader, start=2):
                    total_rows += 1
                    try:
                        parsed = self._parse_row(row, row_num)
                        for i, acct in enumerate(self.target_accounts):
                            if self._row_exists(parsed['topstep_id'], acct):
                                self.skipped_count += 1
                            else:
                                self.success_count += 1
                                if i == 0:
                                    pnl = self._estimated_pnl(parsed)
                                    self.total_pnl += pnl
                                    self.total_fees += parsed['fees'] + parsed['commissions']
                    except Exception as e:
                        error_msg = str(e)
                        if "déjà importé" in error_msg:
                            self.skipped_count += 1
                        else:
                            self.error_count += 1
                            self.errors.append({
                                'row': row_num,
                                'error': error_msg,
                                'data': row
                            })
            else:
                with transaction.atomic():  # type: ignore
                    for row_num, row in enumerate(reader, start=2):
                        total_rows += 1
                        try:
                            parsed = self._parse_row(row, row_num)
                            for i, acct in enumerate(self.target_accounts):
                                trade = self._import_row_for_account(parsed, row_num, acct)
                                if trade:
                                    self.success_count += 1
                                    if i == 0:
                                        self.total_pnl += trade.pnl or Decimal('0')
                                        self.total_fees += (trade.fees or Decimal('0')) + (trade.commissions or Decimal('0'))
                                else:
                                    self.skipped_count += 1
                        except Exception as e:
                            error_msg = str(e)
                            if "déjà importé" in error_msg:
                                self.skipped_count += 1
                            else:
                                self.error_count += 1
                                self.errors.append({
                                    'row': row_num,
                                    'error': error_msg,
                                    'data': row
                                })

                    TopStepImportLog.objects.create(
                        user=self.user,
                        filename=filename,
                        total_rows=total_rows,
                        success_count=self.success_count,
                        error_count=self.error_count,
                        skipped_count=self.skipped_count,
                        errors=self.errors if self.errors else None
                    )

                    _recalculate_mll_for_topstep_accounts(self.target_accounts)

            return {
                'success': True,
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count,
                'skipped_count': self.skipped_count,
                'errors': self.errors,
                'total_pnl': float(self.total_pnl),
                'total_fees': float(self.total_fees),
                'copy_accounts_count': max(0, len(self.target_accounts) - 1),
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Erreur lors du traitement: {str(e)}',
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count
            }

    def _validate_columns(self, columns):
        if not columns:
            return False, self.REQUIRED_COLUMNS

        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in columns]
        if missing_columns:
            return False, missing_columns

        return True, None

    def _import_row(self, row, row_num):
        """Compatibilité : import sur le premier compte cible uniquement (tests / ancien code)."""
        self._ensure_targets()
        parsed = self._parse_row(row, row_num)
        return self._import_row_for_account(parsed, row_num, self.target_accounts[0])

    def _validate_row(self, row, row_num):
        """Valide une ligne (dry_run) pour le compte principal uniquement — compat tests."""
        self._ensure_targets()
        parsed = self._parse_row(row, row_num)
        primary = self.target_accounts[0]
        if self._row_exists(parsed['topstep_id'], primary):
            return {'skip': True}
        return {
            'pnl': self._estimated_pnl(parsed),
            'fees': parsed['fees'],
            'commissions': parsed['commissions'],
        }


def generate_sample_csv():
    sample = """Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
1443101901,NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,25261.750000000,25245.750000000,8.40000,-960.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:07:34.9942140,
1443101902,ESH5,10/08/2025 14:15:22 +02:00,10/08/2025 14:45:10 +02:00,4250.50000000,4255.75000000,6.80000,1575.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:29:48.1234567,
1443101903,YMH5,10/09/2025 09:30:15 +02:00,10/09/2025 10:05:45 +02:00,35120.00000000,35090.00000000,5.50000,-900.000000000,2,Short,10/09/2025 00:00:00 -05:00,00:35:30.5678901,"""

    return sample
