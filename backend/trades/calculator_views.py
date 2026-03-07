"""
Position Calculator API Views
"""

from decimal import Decimal, InvalidOperation
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .services.position_calculator import PositionCalculator


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_position_size(request):
    """
    Calculate position size based on risk parameters.
    
    Request body:
        {
            "account_balance": 50000.00,
            "risk_percentage": 1.0,
            "entry_price": 4500.00,
            "stop_loss_price": 4490.00,
            "tick_value": 12.50 (optional),
            "tick_size": 0.25 (optional)
        }
    """
    try:
        # Extract and validate parameters
        account_balance = Decimal(str(request.data.get('account_balance', 0)))
        risk_percentage = Decimal(str(request.data.get('risk_percentage', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        stop_loss_price = Decimal(str(request.data.get('stop_loss_price', 0)))
        
        # Optional parameters for futures
        tick_value = request.data.get('tick_value')
        tick_size = request.data.get('tick_size')
        
        if tick_value is not None:
            tick_value = Decimal(str(tick_value))
        if tick_size is not None:
            tick_size = Decimal(str(tick_size))
        
        # Validate inputs
        if account_balance <= 0:
            return Response(
                {'error': 'Account balance must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if risk_percentage <= 0 or risk_percentage > 100:
            return Response(
                {'error': 'Risk percentage must be between 0 and 100'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate position size
        result = PositionCalculator.calculate_position_size(
            account_balance=account_balance,
            risk_percentage=risk_percentage,
            entry_price=entry_price,
            stop_loss_price=stop_loss_price,
            tick_value=tick_value,
            tick_size=tick_size,
        )
        
        # Convert Decimal to float for JSON serialization
        result_json = {k: float(v) for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_fixed_risk(request):
    """
    Calculate position size based on fixed dollar risk.
    
    Request body:
        {
            "risk_amount": 500.00,
            "entry_price": 4500.00,
            "stop_loss_price": 4490.00,
            "tick_value": 12.50 (optional),
            "tick_size": 0.25 (optional)
        }
    """
    try:
        risk_amount = Decimal(str(request.data.get('risk_amount', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        stop_loss_price = Decimal(str(request.data.get('stop_loss_price', 0)))
        
        tick_value = request.data.get('tick_value')
        tick_size = request.data.get('tick_size')
        
        if tick_value is not None:
            tick_value = Decimal(str(tick_value))
        if tick_size is not None:
            tick_size = Decimal(str(tick_size))
        
        if risk_amount <= 0:
            return Response(
                {'error': 'Risk amount must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = PositionCalculator.calculate_with_fixed_risk(
            risk_amount=risk_amount,
            entry_price=entry_price,
            stop_loss_price=stop_loss_price,
            tick_value=tick_value,
            tick_size=tick_size,
        )
        
        result_json = {k: float(v) for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_risk_reward(request):
    """
    Calculate risk/reward ratio for a position.
    
    Request body:
        {
            "position_size": 2,
            "entry_price": 4500.00,
            "stop_loss_price": 4490.00,
            "take_profit_price": 4530.00,
            "tick_value": 12.50 (optional),
            "tick_size": 0.25 (optional)
        }
    """
    try:
        position_size = Decimal(str(request.data.get('position_size', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        stop_loss_price = Decimal(str(request.data.get('stop_loss_price', 0)))
        take_profit_price = Decimal(str(request.data.get('take_profit_price', 0)))
        
        tick_value = request.data.get('tick_value')
        tick_size = request.data.get('tick_size')
        
        if tick_value is not None:
            tick_value = Decimal(str(tick_value))
        if tick_size is not None:
            tick_size = Decimal(str(tick_size))
        
        if position_size <= 0:
            return Response(
                {'error': 'Position size must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = PositionCalculator.calculate_risk_reward(
            position_size=position_size,
            entry_price=entry_price,
            stop_loss_price=stop_loss_price,
            take_profit_price=take_profit_price,
            tick_value=tick_value,
            tick_size=tick_size,
        )
        
        result_json = {k: float(v) for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_breakeven(request):
    """
    Calculate breakeven price including commissions.
    
    Request body:
        {
            "position_size": 2,
            "entry_price": 4500.00,
            "commission_per_contract": 2.50,
            "tick_size": 0.25
        }
    """
    try:
        position_size = Decimal(str(request.data.get('position_size', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        commission_per_contract = Decimal(str(request.data.get('commission_per_contract', 0)))
        tick_size = Decimal(str(request.data.get('tick_size', 0)))
        
        if position_size <= 0:
            return Response(
                {'error': 'Position size must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if tick_size <= 0:
            return Response(
                {'error': 'Tick size must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = PositionCalculator.calculate_breakeven(
            position_size=position_size,
            entry_price=entry_price,
            commission_per_contract=commission_per_contract,
            tick_size=tick_size,
        )
        
        result_json = {k: float(v) for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_margin(request):
    """
    Calculate margin required for a position.
    
    Request body:
        {
            "position_size": 2,
            "entry_price": 4500.00,
            "leverage": 10,
            "instrument_type": "futures",
            "contract_size": 50 (optional)
        }
    """
    try:
        position_size = Decimal(str(request.data.get('position_size', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        leverage = Decimal(str(request.data.get('leverage', 1)))
        instrument_type = request.data.get('instrument_type', 'futures')
        contract_size = request.data.get('contract_size')
        
        if contract_size is not None:
            contract_size = Decimal(str(contract_size))
        
        if position_size <= 0:
            return Response(
                {'error': 'Position size must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if leverage <= 0:
            return Response(
                {'error': 'Leverage must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = PositionCalculator.calculate_margin(
            position_size=position_size,
            entry_price=entry_price,
            leverage=leverage,
            instrument_type=instrument_type,
            contract_size=contract_size,
        )
        
        result_json = {k: float(v) for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_forex_lot_size(request):
    """
    Calculate forex lot size based on risk parameters.
    
    Request body:
        {
            "account_balance": 10000.00,
            "risk_percentage": 1.0,
            "entry_price": 1.1850,
            "stop_loss_price": 1.1830,
            "pip_value": 10 (optional),
            "account_currency": "USD" (optional),
            "pair_quote_currency": "USD" (optional)
        }
    """
    try:
        account_balance = Decimal(str(request.data.get('account_balance', 0)))
        risk_percentage = Decimal(str(request.data.get('risk_percentage', 0)))
        entry_price = Decimal(str(request.data.get('entry_price', 0)))
        stop_loss_price = Decimal(str(request.data.get('stop_loss_price', 0)))
        
        pip_value = request.data.get('pip_value')
        if pip_value is not None:
            pip_value = Decimal(str(pip_value))
        
        account_currency = request.data.get('account_currency', 'USD')
        pair_quote_currency = request.data.get('pair_quote_currency', 'USD')
        
        if account_balance <= 0:
            return Response(
                {'error': 'Account balance must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if risk_percentage <= 0 or risk_percentage > 100:
            return Response(
                {'error': 'Risk percentage must be between 0 and 100'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entry_price <= 0:
            return Response(
                {'error': 'Entry price must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = PositionCalculator.calculate_forex_lot_size(
            account_balance=account_balance,
            risk_percentage=risk_percentage,
            entry_price=entry_price,
            stop_loss_price=stop_loss_price,
            pip_value=pip_value,
            account_currency=account_currency,
            pair_quote_currency=pair_quote_currency,
        )
        
        result_json = {k: float(v) if isinstance(v, Decimal) else v for k, v in result.items()}
        
        return Response(result_json, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except InvalidOperation:
        return Response(
            {'error': 'Invalid number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Calculation error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
