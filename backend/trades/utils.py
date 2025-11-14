"""
Utilitaires pour l'import de trades depuis TopStep.
"""
import csv
from decimal import Decimal, InvalidOperation
from django.db import transaction
from .models import TopStepTrade, TopStepImportLog


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
    
    def __init__(self, user, trading_account=None):
        self.user = user
        self.trading_account = trading_account
        self.errors = []
        self.success_count = 0
        self.error_count = 0
        self.skipped_count = 0
        self.total_pnl = Decimal('0')
        self.total_fees = Decimal('0')
    
    def import_from_file(self, file_path, filename=None):
        """
        Importe les trades depuis un fichier CSV.
        
        Args:
            file_path: Chemin vers le fichier CSV
            filename: Nom du fichier (optionnel)
        
        Returns:
            dict: Statistiques de l'import
        """
        if filename is None:
            filename = file_path.split('/')[-1]
        
        total_rows = 0
        
        try:
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                # Vérifier les colonnes
                is_valid, missing_columns = self._validate_columns(reader.fieldnames)
                if not is_valid:
                    missing_cols_str = ', '.join(missing_columns)  # type: ignore  # type: ignore
                    return {
                        'success': False,
                        'error': f'Format de fichier invalide. Colonnes manquantes : {missing_cols_str}',
                        'missing_columns': missing_columns,
                        'total_rows': 0,
                        'success_count': 0,
                        'error_count': 0
                    }
                
                # Traiter chaque ligne
                with transaction.atomic():  # type: ignore  # type: ignore
                    for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
                        total_rows += 1
                        try:
                            result = self._import_row(row, row_num)
                            if result:  # Trade créé
                                self.success_count += 1
                            else:  # Trade ignoré (doublon)
                                self.skipped_count += 1
                        except Exception as e:
                            error_msg = str(e)
                            # Si c'est un doublon, ne pas le compter comme erreur
                            if "déjà importé" in error_msg:
                                self.skipped_count += 1
                            else:
                                self.error_count += 1
                                self.errors.append({
                                    'row': row_num,
                                    'error': error_msg,
                                    'data': row
                                })
                    
                    # Créer le log d'import
                    TopStepImportLog.objects.create(  # type: ignore  # type: ignore
                        user=self.user,
                        filename=filename,
                        total_rows=total_rows,
                        success_count=self.success_count,
                        error_count=self.error_count,
                        skipped_count=self.skipped_count,
                        errors=self.errors if self.errors else None
                    )
            
            return {
                'success': True,
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count,
                'skipped_count': self.skipped_count,
                'errors': self.errors
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
        """
        Importe les trades depuis une chaîne CSV.
        
        Args:
            csv_content: Contenu du CSV sous forme de chaîne
            filename: Nom du fichier (pour les logs)
            dry_run: Si True, valide seulement sans insérer en base
        
        Returns:
            dict: Statistiques de l'import
        """
        total_rows = 0
        self.total_pnl = Decimal('0')
        self.total_fees = Decimal('0')
        
        try:
            reader = csv.DictReader(csv_content.splitlines())
            
            # Vérifier les colonnes
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
                # Mode aperçu : valider sans insérer
                for row_num, row in enumerate(reader, start=2):
                    total_rows += 1
                    try:
                        # Valider la ligne sans créer le trade
                        result = self._validate_row(row, row_num)
                        if result:
                            if result.get('skip'):  # Doublon
                                self.skipped_count += 1
                            else:  # Trade valide
                                self.success_count += 1
                                # Ajouter au total PnL et fees
                                pnl = result.get('pnl', Decimal('0'))
                                fees = result.get('fees', Decimal('0'))
                                self.total_pnl += pnl
                                self.total_fees += fees
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
                # Mode réel : insérer en base
                with transaction.atomic():  # type: ignore
                    for row_num, row in enumerate(reader, start=2):
                        total_rows += 1
                        try:
                            result = self._import_row(row, row_num)
                            if result:  # Trade créé
                                self.success_count += 1
                                # Ajouter au total PnL et fees
                                self.total_pnl += result.pnl or Decimal('0')
                                self.total_fees += result.fees or Decimal('0')
                            else:  # Trade ignoré (doublon)
                                self.skipped_count += 1
                        except Exception as e:
                            error_msg = str(e)
                            # Si c'est un doublon, ne pas le compter comme erreur
                            if "déjà importé" in error_msg:
                                self.skipped_count += 1
                            else:
                                self.error_count += 1
                                self.errors.append({
                                    'row': row_num,
                                    'error': error_msg,
                                    'data': row
                                })
                    
                    # Créer le log d'import seulement en mode réel
                    TopStepImportLog.objects.create(  # type: ignore
                        user=self.user,
                        filename=filename,
                        total_rows=total_rows,
                        success_count=self.success_count,
                        error_count=self.error_count,
                        skipped_count=self.skipped_count,
                        errors=self.errors if self.errors else None
                    )
            
            return {
                'success': True,
                'total_rows': total_rows,
                'success_count': self.success_count,
                'error_count': self.error_count,
                'skipped_count': self.skipped_count,
                'errors': self.errors,
                'total_pnl': float(self.total_pnl),
                'total_fees': float(self.total_fees)
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
        """
        Vérifie que toutes les colonnes requises sont présentes.
        Retourne (True, None) si valide, ou (False, liste_colonnes_manquantes) si invalide.
        """
        if not columns:
            return False, self.REQUIRED_COLUMNS
        
        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in columns]
        if missing_columns:
            return False, missing_columns
        
        return True, None
    
    def _import_row(self, row, row_num):
        """
        Importe une ligne du CSV en tant que TopStepTrade.
        
        Args:
            row: Dictionnaire contenant les données de la ligne
            row_num: Numéro de la ligne (pour les erreurs)
        
        Returns:
            TopStepTrade: Le trade créé, ou None si c'est un doublon
        """
        topstep_id = row['Id'].strip()
        
        # Vérifier si ce trade existe déjà (par topstep_id unique)
        if TopStepTrade.objects.filter(topstep_id=topstep_id).exists():  # type: ignore
            return None  # Ignorer silencieusement le doublon
        
        # Parser les dates (format US -> format Python)
        entered_at = TopStepTrade.parse_us_datetime(row['EnteredAt'])
        exited_at = TopStepTrade.parse_us_datetime(row['ExitedAt']) if row['ExitedAt'].strip() else None
        
        # Parser trade_day
        trade_day = None
        if row['TradeDay'].strip():
            try:
                trade_day_dt = TopStepTrade.parse_us_datetime(row['TradeDay'])
                trade_day = trade_day_dt.date()
            except:
                trade_day = entered_at.date()
        else:
            trade_day = entered_at.date()
        
        # Parser les nombres (format US avec point -> Decimal)
        entry_price = TopStepTrade.parse_us_decimal(row['EntryPrice'])
        exit_price = TopStepTrade.parse_us_decimal(row['ExitPrice'])
        fees = TopStepTrade.parse_us_decimal(row['Fees']) or Decimal('0')
        pnl = TopStepTrade.parse_us_decimal(row['PnL'])
        size = TopStepTrade.parse_us_decimal(row['Size'])
        commissions = TopStepTrade.parse_us_decimal(row['Commissions']) or Decimal('0')
        
        # Parser la durée
        trade_duration = TopStepTrade.parse_duration(row['TradeDuration'])
        
        # Valider le type de trade
        trade_type = row['Type'].strip()
        if trade_type not in ['Long', 'Short']:
            raise ValueError(f"Type de trade invalide: {trade_type} (ligne {row_num})")
        
        # Obtenir le compte de trading (utiliser le compte par défaut si non spécifié)
        if not self.trading_account:
            from .models import TradingAccount
            self.trading_account = TradingAccount.objects.filter(  # type: ignore
                user=self.user, 
                is_default=True
            ).first()
            if not self.trading_account:
                raise ValueError("Aucun compte de trading par défaut trouvé pour cet utilisateur")
        
        # Créer le trade
        trade = TopStepTrade.objects.create(  # type: ignore
            user=self.user,
            trading_account=self.trading_account,
            topstep_id=topstep_id,
            contract_name=row['ContractName'].strip(),
            entered_at=entered_at,
            exited_at=exited_at,
            entry_price=entry_price,
            exit_price=exit_price,
            fees=fees,
            pnl=pnl,
            size=size,
            trade_type=trade_type,
            trade_day=trade_day,
            trade_duration=trade_duration,
            commissions=commissions,
            raw_data=dict(row)  # Sauvegarder les données brutes
        )
        
        return trade
    
    def _validate_row(self, row, row_num):
        """
        Valide une ligne du CSV sans créer le trade (pour dry_run).
        
        Args:
            row: Dictionnaire contenant les données de la ligne
            row_num: Numéro de la ligne (pour les erreurs)
        
        Returns:
            dict: {'skip': True} si doublon, {'pnl': Decimal, 'fees': Decimal} si valide
        """
        topstep_id = row['Id'].strip()
        
        # Vérifier si ce trade existe déjà
        if TopStepTrade.objects.filter(topstep_id=topstep_id).exists():  # type: ignore
            return {'skip': True}
        
        # Parser les dates (format US -> format Python)
        entered_at = TopStepTrade.parse_us_datetime(row['EnteredAt'])
        exited_at = TopStepTrade.parse_us_datetime(row['ExitedAt']) if row['ExitedAt'].strip() else None
        
        # Parser les nombres (format US avec point -> Decimal)
        fees = TopStepTrade.parse_us_decimal(row['Fees']) or Decimal('0')
        pnl = TopStepTrade.parse_us_decimal(row['PnL'])
        
        # Valider le type de trade
        trade_type = row['Type'].strip()
        if trade_type not in ['Long', 'Short']:
            raise ValueError(f"Type de trade invalide: {trade_type} (ligne {row_num})")
        
        # Retourner les valeurs pour calculer les totaux
        return {
            'pnl': pnl or Decimal('0'),
            'fees': fees
        }


def generate_sample_csv():
    """
    Génère un exemple de fichier CSV TopStep pour test.
    """
    sample = """Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
1443101901,NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,25261.750000000,25245.750000000,8.40000,-960.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:07:34.9942140,
1443101902,ESH5,10/08/2025 14:15:22 +02:00,10/08/2025 14:45:10 +02:00,4250.50000000,4255.75000000,6.80000,1575.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:29:48.1234567,
1443101903,YMH5,10/09/2025 09:30:15 +02:00,10/09/2025 10:05:45 +02:00,35120.00000000,35090.00000000,5.50000,-900.000000000,2,Short,10/09/2025 00:00:00 -05:00,00:35:30.5678901,"""
    
    return sample


