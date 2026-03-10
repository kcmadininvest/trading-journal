"""
Position Size Calculator Service

Provides utilities for calculating position sizes based on risk management parameters.
"""

from decimal import Decimal
from typing import Dict, Optional


class PositionCalculator:
    """
    Calculator for determining position sizes based on risk parameters.
    
    Supports multiple calculation methods:
    - Fixed dollar risk
    - Percentage of account risk
    - Risk/reward ratio based sizing
    """
    
    @staticmethod
    def calculate_position_size(
        account_balance: Decimal,
        risk_percentage: Decimal,
        entry_price: Decimal,
        stop_loss_price: Decimal,
        tick_value: Optional[Decimal] = None,
        tick_size: Optional[Decimal] = None,
    ) -> Dict[str, Decimal]:
        """
        Calculate position size based on account risk percentage.
        
        Args:
            account_balance: Total account balance
            risk_percentage: Percentage of account to risk (e.g., 1.0 for 1%)
            entry_price: Planned entry price
            stop_loss_price: Stop loss price
            tick_value: Value per tick movement (for futures)
            tick_size: Minimum price movement (for futures)
        
        Returns:
            Dictionary containing:
                - position_size: Number of contracts/shares
                - risk_amount: Dollar amount at risk
                - risk_per_unit: Risk per contract/share
                - stop_loss_distance: Distance from entry to stop loss
                - position_value: Total position value
        """
        # Calculate risk amount in dollars
        risk_amount = account_balance * (risk_percentage / Decimal('100'))
        
        # Calculate stop loss distance
        stop_loss_distance = abs(entry_price - stop_loss_price)
        
        if stop_loss_distance == 0:
            raise ValueError("Stop loss price cannot equal entry price")
        
        # For futures with tick value
        if tick_value is not None and tick_size is not None:
            # Calculate number of ticks
            num_ticks = stop_loss_distance / tick_size
            # Risk per contract
            risk_per_contract = num_ticks * tick_value
            # Position size
            position_size = risk_amount / risk_per_contract
            risk_per_unit = risk_per_contract
        else:
            # For stocks/forex - simple calculation
            risk_per_unit = stop_loss_distance
            position_size = risk_amount / stop_loss_distance
        
        # Calculate position value
        position_value = position_size * entry_price
        
        return {
            'position_size': position_size.quantize(Decimal('0.01')),
            'risk_amount': risk_amount.quantize(Decimal('0.01')),
            'risk_per_unit': risk_per_unit.quantize(Decimal('0.01')),
            'stop_loss_distance': stop_loss_distance.quantize(Decimal('0.01')),
            'position_value': position_value.quantize(Decimal('0.01')),
        }
    
    @staticmethod
    def calculate_with_fixed_risk(
        risk_amount: Decimal,
        entry_price: Decimal,
        stop_loss_price: Decimal,
        tick_value: Optional[Decimal] = None,
        tick_size: Optional[Decimal] = None,
    ) -> Dict[str, Decimal]:
        """
        Calculate position size based on fixed dollar risk amount.
        
        Args:
            risk_amount: Fixed dollar amount to risk
            entry_price: Planned entry price
            stop_loss_price: Stop loss price
            tick_value: Value per tick movement (for futures)
            tick_size: Minimum price movement (for futures)
        
        Returns:
            Dictionary with position sizing details
        """
        stop_loss_distance = abs(entry_price - stop_loss_price)
        
        if stop_loss_distance == 0:
            raise ValueError("Stop loss price cannot equal entry price")
        
        if tick_value is not None and tick_size is not None:
            num_ticks = stop_loss_distance / tick_size
            risk_per_contract = num_ticks * tick_value
            position_size = risk_amount / risk_per_contract
            risk_per_unit = risk_per_contract
        else:
            risk_per_unit = stop_loss_distance
            position_size = risk_amount / stop_loss_distance
        
        position_value = position_size * entry_price
        
        return {
            'position_size': position_size.quantize(Decimal('0.01')),
            'risk_amount': risk_amount.quantize(Decimal('0.01')),
            'risk_per_unit': risk_per_unit.quantize(Decimal('0.01')),
            'stop_loss_distance': stop_loss_distance.quantize(Decimal('0.01')),
            'position_value': position_value.quantize(Decimal('0.01')),
        }
    
    @staticmethod
    def calculate_risk_reward(
        position_size: Decimal,
        entry_price: Decimal,
        stop_loss_price: Decimal,
        take_profit_price: Decimal,
        tick_value: Optional[Decimal] = None,
        tick_size: Optional[Decimal] = None,
    ) -> Dict[str, Decimal]:
        """
        Calculate risk/reward ratio for a given position.
        
        Args:
            position_size: Number of contracts/shares
            entry_price: Entry price
            stop_loss_price: Stop loss price
            take_profit_price: Take profit price
            tick_value: Value per tick movement (for futures)
            tick_size: Minimum price movement (for futures)
        
        Returns:
            Dictionary containing risk/reward metrics
        """
        stop_loss_distance = abs(entry_price - stop_loss_price)
        take_profit_distance = abs(take_profit_price - entry_price)
        
        if stop_loss_distance == 0:
            raise ValueError("Stop loss price cannot equal entry price")
        
        # Calculate risk and reward amounts
        if tick_value is not None and tick_size is not None:
            risk_ticks = stop_loss_distance / tick_size
            reward_ticks = take_profit_distance / tick_size
            risk_amount = position_size * risk_ticks * tick_value
            reward_amount = position_size * reward_ticks * tick_value
        else:
            risk_amount = position_size * stop_loss_distance
            reward_amount = position_size * take_profit_distance
        
        # Calculate ratio
        risk_reward_ratio = reward_amount / risk_amount if risk_amount > 0 else Decimal('0')
        
        return {
            'risk_amount': risk_amount.quantize(Decimal('0.01')),
            'reward_amount': reward_amount.quantize(Decimal('0.01')),
            'risk_reward_ratio': risk_reward_ratio.quantize(Decimal('0.01')),
            'stop_loss_distance': stop_loss_distance.quantize(Decimal('0.01')),
            'take_profit_distance': take_profit_distance.quantize(Decimal('0.01')),
        }
    
    @staticmethod
    def calculate_breakeven(
        position_size: Decimal,
        entry_price: Decimal,
        commission_per_contract: Decimal,
        tick_size: Decimal,
    ) -> Dict[str, Decimal]:
        """
        Calculate breakeven price including commissions.
        
        Args:
            position_size: Number of contracts/shares
            entry_price: Entry price
            commission_per_contract: Commission cost per contract
            tick_size: Minimum price movement
        
        Returns:
            Dictionary with breakeven calculations
        """
        total_commission = position_size * commission_per_contract * Decimal('2')  # Round trip
        commission_per_unit = total_commission / position_size
        
        # Breakeven prices (long and short)
        breakeven_long = entry_price + commission_per_unit
        breakeven_short = entry_price - commission_per_unit
        
        # Ticks to breakeven
        ticks_to_breakeven = commission_per_unit / tick_size
        
        return {
            'total_commission': total_commission.quantize(Decimal('0.01')),
            'commission_per_unit': commission_per_unit.quantize(Decimal('0.01')),
            'breakeven_long': breakeven_long.quantize(Decimal('0.01')),
            'breakeven_short': breakeven_short.quantize(Decimal('0.01')),
            'ticks_to_breakeven': ticks_to_breakeven.quantize(Decimal('0.01')),
        }
    
    @staticmethod
    def calculate_margin(
        position_size: Decimal,
        entry_price: Decimal,
        leverage: Decimal,
        instrument_type: str = 'futures',
        contract_size: Optional[Decimal] = None,
    ) -> Dict[str, Decimal]:
        """
        Calculate margin required for a position.
        
        Args:
            position_size: Number of contracts/lots
            entry_price: Entry price
            leverage: Leverage ratio (e.g., 10 for 10:1)
            instrument_type: Type of instrument ('futures', 'forex', 'stocks')
            contract_size: Size of one contract (for futures/forex, e.g., 100000 for standard lot)
        
        Returns:
            Dictionary with margin calculations
        """
        if leverage <= 0:
            raise ValueError("Leverage must be greater than 0")
        
        # Calculate position value
        if instrument_type == 'forex' and contract_size:
            # For forex: position_size * contract_size * entry_price
            position_value = position_size * contract_size * entry_price
        elif instrument_type == 'futures' and contract_size:
            # For futures: position_size * contract_size * entry_price
            position_value = position_size * contract_size * entry_price
        else:
            # For stocks: position_size * entry_price
            position_value = position_size * entry_price
        
        # Calculate required margin
        required_margin = position_value / leverage
        
        # Calculate margin percentage
        margin_percentage = (Decimal('1') / leverage) * Decimal('100')
        
        return {
            'position_value': position_value.quantize(Decimal('0.01')),
            'required_margin': required_margin.quantize(Decimal('0.01')),
            'margin_percentage': margin_percentage.quantize(Decimal('0.01')),
            'leverage': leverage.quantize(Decimal('0.01')),
            'buying_power': (required_margin * leverage).quantize(Decimal('0.01')),
        }
    
    @staticmethod
    def calculate_forex_lot_size(
        account_balance: Decimal,
        risk_percentage: Decimal,
        entry_price: Decimal,
        stop_loss_price: Decimal,
        pip_value: Optional[Decimal] = None,
        account_currency: str = 'USD',
        pair_quote_currency: str = 'USD',
    ) -> Dict[str, Decimal]:
        """
        Calculate forex lot size based on risk parameters.
        
        Args:
            account_balance: Total account balance
            risk_percentage: Percentage of account to risk
            entry_price: Entry price
            stop_loss_price: Stop loss price
            pip_value: Value of 1 pip for 1 standard lot (optional, calculated if not provided)
            account_currency: Account currency (e.g., 'USD', 'EUR')
            pair_quote_currency: Quote currency of the pair (e.g., 'USD' in EUR/USD)
        
        Returns:
            Dictionary with lot size calculations
        """
        # Calculate risk amount
        risk_amount = account_balance * (risk_percentage / Decimal('100'))
        
        # Calculate stop loss distance in pips
        # For most pairs, 1 pip = 0.0001, for JPY pairs 1 pip = 0.01
        pip_size = Decimal('0.01') if pair_quote_currency == 'JPY' else Decimal('0.0001')
        stop_loss_pips = abs(entry_price - stop_loss_price) / pip_size
        
        # Calculate pip value if not provided
        # For standard lot (100,000 units), pip value = (pip_size * lot_size) / quote_price
        if pip_value is None:
            # Standard lot pip value for pairs where quote currency = account currency
            if account_currency == pair_quote_currency:
                pip_value = Decimal('10')  # $10 per pip for standard lot in USD
            else:
                # Simplified calculation - would need exchange rate for exact value
                pip_value = Decimal('10')
        
        # Calculate lot size
        # risk_amount = stop_loss_pips * pip_value * lot_size
        # lot_size = risk_amount / (stop_loss_pips * pip_value)
        if stop_loss_pips == 0:
            raise ValueError("Stop loss price cannot equal entry price")
        
        lot_size = risk_amount / (stop_loss_pips * pip_value)
        
        # Convert to different lot types
        standard_lots = lot_size
        mini_lots = lot_size * Decimal('10')  # 1 standard = 10 mini
        micro_lots = lot_size * Decimal('100')  # 1 standard = 100 micro
        
        # Calculate position value (for standard lot = 100,000 units)
        position_value = lot_size * Decimal('100000') * entry_price
        
        return {
            'standard_lots': standard_lots.quantize(Decimal('0.01')),
            'mini_lots': mini_lots.quantize(Decimal('0.01')),
            'micro_lots': micro_lots.quantize(Decimal('0.01')),
            'risk_amount': risk_amount.quantize(Decimal('0.01')),
            'stop_loss_pips': stop_loss_pips.quantize(Decimal('0.1')),
            'pip_value': pip_value.quantize(Decimal('0.01')),
            'position_value': position_value.quantize(Decimal('0.01')),
            'units': (lot_size * Decimal('100000')).quantize(Decimal('0.01')),
        }
