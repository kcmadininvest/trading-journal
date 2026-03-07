import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
  };
};

export interface PositionSizeRequest {
  account_balance: number;
  risk_percentage: number;
  entry_price: number;
  stop_loss_price: number;
  tick_value?: number;
  tick_size?: number;
}

export interface FixedRiskRequest {
  risk_amount: number;
  entry_price: number;
  stop_loss_price: number;
  tick_value?: number;
  tick_size?: number;
}

export interface RiskRewardRequest {
  position_size: number;
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number;
  tick_value?: number;
  tick_size?: number;
}

export interface BreakevenRequest {
  position_size: number;
  entry_price: number;
  commission_per_contract: number;
  tick_size: number;
}

export interface PositionSizeResponse {
  position_size: number;
  risk_amount: number;
  risk_per_unit: number;
  stop_loss_distance: number;
  position_value: number;
}

export interface RiskRewardResponse {
  risk_amount: number;
  reward_amount: number;
  risk_reward_ratio: number;
  stop_loss_distance: number;
  take_profit_distance: number;
}

export interface BreakevenResponse {
  total_commission: number;
  commission_per_unit: number;
  breakeven_long: number;
  breakeven_short: number;
  ticks_to_breakeven: number;
}

export interface MarginRequest {
  position_size: number;
  entry_price: number;
  leverage: number;
  instrument_type?: string;
  contract_size?: number;
}

export interface MarginResponse {
  position_value: number;
  required_margin: number;
  margin_percentage: number;
  leverage: number;
  buying_power: number;
}

export interface ForexLotSizeRequest {
  account_balance: number;
  risk_percentage: number;
  entry_price: number;
  stop_loss_price: number;
  pip_value?: number;
  account_currency?: string;
  pair_quote_currency?: string;
}

export interface ForexLotSizeResponse {
  standard_lots: number;
  mini_lots: number;
  micro_lots: number;
  risk_amount: number;
  stop_loss_pips: number;
  pip_value: number;
  position_value: number;
  units: number;
}

const calculatorApi = {
  calculatePositionSize: async (data: PositionSizeRequest): Promise<PositionSizeResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/position-size/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  calculateFixedRisk: async (data: FixedRiskRequest): Promise<PositionSizeResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/fixed-risk/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  calculateRiskReward: async (data: RiskRewardRequest): Promise<RiskRewardResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/risk-reward/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  calculateBreakeven: async (data: BreakevenRequest): Promise<BreakevenResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/breakeven/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  calculateMargin: async (data: MarginRequest): Promise<MarginResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/margin/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  calculateForexLotSize: async (data: ForexLotSizeRequest): Promise<ForexLotSizeResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/trades/calculator/forex-lot-size/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

export default calculatorApi;
