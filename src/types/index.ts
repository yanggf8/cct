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

// Cloudflare Workers types
declare global {
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: any): Promise<any>;
  }
  
  interface DurableObjectNamespace {
    get(id: any): any;
    idFromName(name: string): any;
  }
  
  interface DurableObjectState {
    storage: any;
  }
  
  interface R2Bucket {
    get(key: string): Promise<any>;
    put(key: string, value: any): Promise<any>;
  }
  
  interface Ai {
    run(model: string, input: any): Promise<any>;
  }

  var global: any;
}
