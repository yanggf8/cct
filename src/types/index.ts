// Core type definitions

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface SectorData extends MarketData {
  name: string;
}

export interface RiskAssessment {
  categoryBreakdown: {
    marketRisk: any;
    creditRisk: any;
    concentrationRisk: any;
  };
  alerts: any[];
}

export interface ChannelResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

export type AlertTypeType = string;

// Note: Cloudflare Workers types are declared in ../types.ts to avoid duplicates
