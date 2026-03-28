"""
Spécifications des contrats futures
Dictionnaire exhaustif des contrats avec leurs valeurs de point
"""
from typing import Optional

# Dictionnaire des spécifications de contrats futures
# Format: 'SYMBOLE': {'point_value': valeur, 'name': nom, 'tick_size': taille_tick}
FUTURES_CONTRACT_SPECS = {
    # ============================================================================
    # INDICES US - CME Group
    # ============================================================================
    
    # E-mini Indices
    'ES': {
        'point_value': 50,
        'name': 'E-mini S&P 500',
        'tick_size': 0.25,
        'exchange': 'CME'
    },
    'NQ': {
        'point_value': 20,
        'name': 'E-mini Nasdaq-100',
        'tick_size': 0.25,
        'exchange': 'CME'
    },
    'YM': {
        'point_value': 5,
        'name': 'E-mini Dow Jones ($5)',
        'tick_size': 1.0,
        'exchange': 'CBOT'
    },
    'RTY': {
        'point_value': 50,
        'name': 'E-mini Russell 2000',
        'tick_size': 0.1,
        'exchange': 'CME'
    },
    
    # Micro E-mini Indices
    'MES': {
        'point_value': 5,
        'name': 'Micro E-mini S&P 500',
        'tick_size': 0.25,
        'exchange': 'CME'
    },
    'MNQ': {
        'point_value': 2,
        'name': 'Micro E-mini Nasdaq-100',
        'tick_size': 0.25,
        'exchange': 'CME'
    },
    'MYM': {
        'point_value': 0.5,
        'name': 'Micro E-mini Dow Jones',
        'tick_size': 1.0,
        'exchange': 'CBOT'
    },
    'M2K': {
        'point_value': 5,
        'name': 'Micro E-mini Russell 2000',
        'tick_size': 0.1,
        'exchange': 'CME'
    },
    
    # ============================================================================
    # ÉNERGIES - NYMEX/ICE
    # ============================================================================
    
    'CL': {
        'point_value': 1000,
        'name': 'Crude Oil WTI',
        'tick_size': 0.01,
        'exchange': 'NYMEX'
    },
    'QM': {
        'point_value': 500,
        'name': 'E-mini Crude Oil',
        'tick_size': 0.025,
        'exchange': 'NYMEX'
    },
    'MCL': {
        'point_value': 100,
        'name': 'Micro Crude Oil',
        'tick_size': 0.01,
        'exchange': 'NYMEX'
    },
    'NG': {
        'point_value': 10000,
        'name': 'Natural Gas',
        'tick_size': 0.001,
        'exchange': 'NYMEX'
    },
    'QG': {
        'point_value': 2500,
        'name': 'E-mini Natural Gas',
        'tick_size': 0.005,
        'exchange': 'NYMEX'
    },
    'RB': {
        'point_value': 42000,
        'name': 'RBOB Gasoline',
        'tick_size': 0.0001,
        'exchange': 'NYMEX'
    },
    'HO': {
        'point_value': 42000,
        'name': 'Heating Oil',
        'tick_size': 0.0001,
        'exchange': 'NYMEX'
    },
    'BZ': {
        'point_value': 1000,
        'name': 'Brent Crude Oil',
        'tick_size': 0.01,
        'exchange': 'ICE'
    },
    
    # ============================================================================
    # MÉTAUX - COMEX
    # ============================================================================
    
    'GC': {
        'point_value': 100,
        'name': 'Gold',
        'tick_size': 0.10,
        'exchange': 'COMEX'
    },
    'MGC': {
        'point_value': 10,
        'name': 'Micro Gold',
        'tick_size': 0.10,
        'exchange': 'COMEX'
    },
    'SI': {
        'point_value': 5000,
        'name': 'Silver',
        'tick_size': 0.005,
        'exchange': 'COMEX'
    },
    'SIL': {
        'point_value': 1000,
        'name': 'Micro Silver',
        'tick_size': 0.005,
        'exchange': 'COMEX'
    },
    'HG': {
        'point_value': 25000,
        'name': 'Copper',
        'tick_size': 0.0005,
        'exchange': 'COMEX'
    },
    'QC': {
        'point_value': 12500,
        'name': 'E-mini Copper',
        'tick_size': 0.005,
        'exchange': 'COMEX'
    },
    'PL': {
        'point_value': 50,
        'name': 'Platinum',
        'tick_size': 0.10,
        'exchange': 'NYMEX'
    },
    'PA': {
        'point_value': 100,
        'name': 'Palladium',
        'tick_size': 0.05,
        'exchange': 'NYMEX'
    },
    
    # ============================================================================
    # DEVISES - CME
    # ============================================================================
    
    '6E': {
        'point_value': 12.5,
        'name': 'Euro FX',
        'tick_size': 0.00005,
        'exchange': 'CME'
    },
    'M6E': {
        'point_value': 1.25,
        'name': 'Micro Euro FX',
        'tick_size': 0.00005,
        'exchange': 'CME'
    },
    '6B': {
        'point_value': 6.25,
        'name': 'British Pound',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    'M6B': {
        'point_value': 0.625,
        'name': 'Micro British Pound',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    '6J': {
        'point_value': 12.5,
        'name': 'Japanese Yen',
        'tick_size': 0.0000005,
        'exchange': 'CME'
    },
    'MJY': {
        'point_value': 1.25,
        'name': 'Micro Japanese Yen',
        'tick_size': 0.0000005,
        'exchange': 'CME'
    },
    '6A': {
        'point_value': 10,
        'name': 'Australian Dollar',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    'M6A': {
        'point_value': 1,
        'name': 'Micro Australian Dollar',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    '6C': {
        'point_value': 10,
        'name': 'Canadian Dollar',
        'tick_size': 0.00005,
        'exchange': 'CME'
    },
    '6S': {
        'point_value': 12.5,
        'name': 'Swiss Franc',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    '6N': {
        'point_value': 10,
        'name': 'New Zealand Dollar',
        'tick_size': 0.0001,
        'exchange': 'CME'
    },
    '6M': {
        'point_value': 500,
        'name': 'Mexican Peso',
        'tick_size': 0.000025,
        'exchange': 'CME'
    },
    'DX': {
        'point_value': 1000,
        'name': 'US Dollar Index',
        'tick_size': 0.005,
        'exchange': 'ICE'
    },
    
    # ============================================================================
    # TAUX D'INTÉRÊT - CBOT
    # ============================================================================
    
    'ZN': {
        'point_value': 1000,
        'name': '10-Year T-Note',
        'tick_size': 0.015625,
        'exchange': 'CBOT'
    },
    'ZB': {
        'point_value': 1000,
        'name': '30-Year T-Bond',
        'tick_size': 0.03125,
        'exchange': 'CBOT'
    },
    'ZF': {
        'point_value': 1000,
        'name': '5-Year T-Note',
        'tick_size': 0.0078125,
        'exchange': 'CBOT'
    },
    'ZT': {
        'point_value': 2000,
        'name': '2-Year T-Note',
        'tick_size': 0.00390625,
        'exchange': 'CBOT'
    },
    'ZQ': {
        'point_value': 4167,
        'name': '30-Day Fed Funds',
        'tick_size': 0.0025,
        'exchange': 'CBOT'
    },
    'GE': {
        'point_value': 2500,
        'name': 'Eurodollar',
        'tick_size': 0.0025,
        'exchange': 'CME'
    },
    
    # ============================================================================
    # AGRICULTURE - CBOT/CME
    # ============================================================================
    
    'ZC': {
        'point_value': 50,
        'name': 'Corn',
        'tick_size': 0.25,
        'exchange': 'CBOT'
    },
    'XC': {
        'point_value': 10,
        'name': 'Mini Corn',
        'tick_size': 0.125,
        'exchange': 'CBOT'
    },
    'ZS': {
        'point_value': 50,
        'name': 'Soybeans',
        'tick_size': 0.25,
        'exchange': 'CBOT'
    },
    'XK': {
        'point_value': 10,
        'name': 'Mini Soybeans',
        'tick_size': 0.125,
        'exchange': 'CBOT'
    },
    'ZW': {
        'point_value': 50,
        'name': 'Wheat',
        'tick_size': 0.25,
        'exchange': 'CBOT'
    },
    'XW': {
        'point_value': 10,
        'name': 'Mini Wheat',
        'tick_size': 0.125,
        'exchange': 'CBOT'
    },
    'ZM': {
        'point_value': 100,
        'name': 'Soybean Meal',
        'tick_size': 0.10,
        'exchange': 'CBOT'
    },
    'ZL': {
        'point_value': 600,
        'name': 'Soybean Oil',
        'tick_size': 0.01,
        'exchange': 'CBOT'
    },
    'ZO': {
        'point_value': 50,
        'name': 'Oats',
        'tick_size': 0.25,
        'exchange': 'CBOT'
    },
    'ZR': {
        'point_value': 2000,
        'name': 'Rough Rice',
        'tick_size': 0.005,
        'exchange': 'CBOT'
    },
    'KE': {
        'point_value': 50,
        'name': 'KC HRW Wheat',
        'tick_size': 0.25,
        'exchange': 'KCBT'
    },
    
    # ============================================================================
    # BÉTAIL - CME
    # ============================================================================
    
    'LE': {
        'point_value': 400,
        'name': 'Live Cattle',
        'tick_size': 0.025,
        'exchange': 'CME'
    },
    'GF': {
        'point_value': 500,
        'name': 'Feeder Cattle',
        'tick_size': 0.025,
        'exchange': 'CME'
    },
    'HE': {
        'point_value': 400,
        'name': 'Lean Hogs',
        'tick_size': 0.025,
        'exchange': 'CME'
    },
    
    # ============================================================================
    # SOFTS - ICE/NYBOT
    # ============================================================================
    
    'KC': {
        'point_value': 375,
        'name': 'Coffee',
        'tick_size': 0.05,
        'exchange': 'ICE'
    },
    'SB': {
        'point_value': 1120,
        'name': 'Sugar #11',
        'tick_size': 0.01,
        'exchange': 'ICE'
    },
    'CC': {
        'point_value': 10,
        'name': 'Cocoa',
        'tick_size': 1.0,
        'exchange': 'ICE'
    },
    'CT': {
        'point_value': 500,
        'name': 'Cotton #2',
        'tick_size': 0.01,
        'exchange': 'ICE'
    },
    'OJ': {
        'point_value': 150,
        'name': 'Orange Juice',
        'tick_size': 0.05,
        'exchange': 'ICE'
    },
    
    # ============================================================================
    # VOLATILITÉ - CBOE
    # ============================================================================
    
    'VX': {
        'point_value': 1000,
        'name': 'VIX Futures',
        'tick_size': 0.05,
        'exchange': 'CFE'
    },
    
    # ============================================================================
    # BITCOIN & CRYPTO - CME
    # ============================================================================
    
    'BTC': {
        'point_value': 5,
        'name': 'Bitcoin',
        'tick_size': 5.0,
        'exchange': 'CME'
    },
    'MBT': {
        'point_value': 0.1,
        'name': 'Micro Bitcoin',
        'tick_size': 5.0,
        'exchange': 'CME'
    },
    'ETH': {
        'point_value': 50,
        'name': 'Ether',
        'tick_size': 0.05,
        'exchange': 'CME'
    },
    'MET': {
        'point_value': 0.1,
        'name': 'Micro Ether',
        'tick_size': 0.05,
        'exchange': 'CME'
    },
    
    # ============================================================================
    # INDICES EUROPÉENS - EUREX
    # ============================================================================
    
    'FESX': {
        'point_value': 10,
        'name': 'Euro Stoxx 50',
        'tick_size': 1.0,
        'exchange': 'Eurex'
    },
    'FDAX': {
        'point_value': 25,
        'name': 'DAX',
        'tick_size': 0.5,
        'exchange': 'Eurex'
    },
    'FDXM': {
        'point_value': 5,
        'name': 'Mini DAX',
        'tick_size': 1.0,
        'exchange': 'Eurex'
    },
    'FSMI': {
        'point_value': 10,
        'name': 'SMI',
        'tick_size': 1.0,
        'exchange': 'Eurex'
    },
    
    # ============================================================================
    # INDICES EUROPÉENS - EURONEXT
    # ============================================================================
    
    'FCE': {
        'point_value': 10,
        'name': 'CAC 40',
        'tick_size': 0.5,
        'exchange': 'Euronext'
    },
    'FTI': {
        'point_value': 5,
        'name': 'FTSE MIB',
        'tick_size': 5.0,
        'exchange': 'Euronext'
    },
    'FTI40': {
        'point_value': 1,
        'name': 'FTSE MIB Mini',
        'tick_size': 5.0,
        'exchange': 'Euronext'
    },
    'AEX': {
        'point_value': 200,
        'name': 'AEX Index',
        'tick_size': 0.05,
        'exchange': 'Euronext'
    },
    'BEL20': {
        'point_value': 10,
        'name': 'BEL 20',
        'tick_size': 5.0,
        'exchange': 'Euronext'
    },
    'PSI': {
        'point_value': 1,
        'name': 'PSI 20',
        'tick_size': 1.0,
        'exchange': 'Euronext'
    },
    
    # ============================================================================
    # INDICES UK - ICE FUTURES EUROPE (LIFFE)
    # ============================================================================
    
    'Z': {
        'point_value': 10,
        'name': 'FTSE 100',
        'tick_size': 0.5,
        'exchange': 'ICE Europe'
    },
    'FTSE': {
        'point_value': 10,
        'name': 'FTSE 100',
        'tick_size': 0.5,
        'exchange': 'ICE Europe'
    },
    
    # ============================================================================
    # OBLIGATIONS EUROPÉENNES - EUREX
    # ============================================================================
    
    'FGBL': {
        'point_value': 1000,
        'name': 'Euro-Bund',
        'tick_size': 0.01,
        'exchange': 'Eurex'
    },
    'FGBM': {
        'point_value': 1000,
        'name': 'Euro-Bobl',
        'tick_size': 0.01,
        'exchange': 'Eurex'
    },
    'FGBS': {
        'point_value': 1000,
        'name': 'Euro-Schatz',
        'tick_size': 0.005,
        'exchange': 'Eurex'
    },
    'FGBX': {
        'point_value': 1000,
        'name': 'Euro-Buxl',
        'tick_size': 0.02,
        'exchange': 'Eurex'
    },
    
    # ============================================================================
    # OBLIGATIONS UK - ICE FUTURES EUROPE
    # ============================================================================
    
    'G': {
        'point_value': 1000,
        'name': 'Long Gilt',
        'tick_size': 0.01,
        'exchange': 'ICE Europe'
    },
    'GILT': {
        'point_value': 1000,
        'name': 'Long Gilt',
        'tick_size': 0.01,
        'exchange': 'ICE Europe'
    },
    
    # ============================================================================
    # MATIÈRES PREMIÈRES EUROPÉENNES - ICE EUROPE
    # ============================================================================
    
    'B': {
        'point_value': 1000,
        'name': 'Brent Crude Oil (ICE)',
        'tick_size': 0.01,
        'exchange': 'ICE Europe'
    },
    'BRENT': {
        'point_value': 1000,
        'name': 'Brent Crude Oil',
        'tick_size': 0.01,
        'exchange': 'ICE Europe'
    },
    'G': {
        'point_value': 1000,
        'name': 'Gas Oil',
        'tick_size': 0.25,
        'exchange': 'ICE Europe'
    },
    'GASOIL': {
        'point_value': 1000,
        'name': 'Gas Oil',
        'tick_size': 0.25,
        'exchange': 'ICE Europe'
    },
    
    # ============================================================================
    # MATIÈRES PREMIÈRES AGRICOLES - EURONEXT
    # ============================================================================
    
    'EBM': {
        'point_value': 50,
        'name': 'Milling Wheat',
        'tick_size': 0.25,
        'exchange': 'Euronext'
    },
    'ECO': {
        'point_value': 50,
        'name': 'Rapeseed',
        'tick_size': 0.25,
        'exchange': 'Euronext'
    },
    'EMA': {
        'point_value': 50,
        'name': 'Corn',
        'tick_size': 0.25,
        'exchange': 'Euronext'
    },
    
    # ============================================================================
    # DEVISES EUROPÉENNES - EUREX
    # ============================================================================
    
    'FEUR': {
        'point_value': 12.5,
        'name': 'EUR/USD',
        'tick_size': 0.0001,
        'exchange': 'Eurex'
    },
    'FGBP': {
        'point_value': 6.25,
        'name': 'GBP/USD',
        'tick_size': 0.0001,
        'exchange': 'Eurex'
    },
    'FJPY': {
        'point_value': 12.5,
        'name': 'USD/JPY',
        'tick_size': 0.01,
        'exchange': 'Eurex'
    },
    'FCHF': {
        'point_value': 12.5,
        'name': 'USD/CHF',
        'tick_size': 0.0001,
        'exchange': 'Eurex'
    },
}


def get_point_value_from_contract(contract_name: str) -> Optional[float]:
    """
    Extrait la valeur du point d'un contrat futures basé sur son nom.
    
    Args:
        contract_name: Nom du contrat (ex: 'NQM6', 'ESH24', 'GCZ23')
        
    Returns:
        La valeur du point si trouvée, None sinon
        
    Examples:
        >>> get_point_value_from_contract('NQM6')
        20
        >>> get_point_value_from_contract('ESH24')
        50
        >>> get_point_value_from_contract('UNKNOWN')
        None
    """
    if not contract_name:
        return None
    
    # Extraire le symbole de base (2-4 premières lettres)
    # Ex: NQM6 -> NQ, ESH24 -> ES, MCLZ23 -> MCL, BTCM24 -> BTC
    # Les contrats ont généralement 2-4 lettres suivies d'un mois (H,M,U,Z) et année
    
    # Essayer différentes longueurs de symbole (du plus long au plus court)
    for length in range(min(4, len(contract_name)), 0, -1):
        base_symbol = contract_name[:length].upper()
        # Vérifier que c'est bien des lettres
        if base_symbol.isalpha() and base_symbol in FUTURES_CONTRACT_SPECS:
            return FUTURES_CONTRACT_SPECS[base_symbol]['point_value']
    
    return None


def get_contract_specs(contract_name: str) -> Optional[dict]:
    """
    Retourne toutes les spécifications d'un contrat futures.
    
    Args:
        contract_name: Nom du contrat (ex: 'NQM6', 'ESH24')
        
    Returns:
        Dictionnaire avec les specs si trouvées, None sinon
    """
    if not contract_name:
        return None
    
    # Essayer différentes longueurs de symbole (du plus long au plus court)
    for length in range(min(4, len(contract_name)), 0, -1):
        base_symbol = contract_name[:length].upper()
        if base_symbol.isalpha() and base_symbol in FUTURES_CONTRACT_SPECS:
            return FUTURES_CONTRACT_SPECS[base_symbol]
    
    return None
