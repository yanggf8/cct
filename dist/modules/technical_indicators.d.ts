/**
 * Technical Indicators Module for Cloudflare Workers
 * Migrated from local_training_manual_ta.py for CF-compatible feature engineering
 * Implements 33 technical indicators for enhanced stock prediction
 */
interface OHLCData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface BollingerBands {
    upper: number | null;
    lower: number | null;
    middle: number | null;
    width?: number;
    position?: number;
}
interface MACDData {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
}
interface StochasticData {
    k: number | null;
    d: number | null;
}
interface TechnicalFeatures {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sma_5: number | null;
    sma_20: number | null;
    sma_50: number | null;
    ema_12: number | null;
    ema_26: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
    rsi_14: number | null;
    rsi_30: number | null;
    stoch_k: number | null;
    stoch_d: number | null;
    williams_r: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    bb_middle: number | null;
    bb_width: number | null;
    bb_position: number | null;
    atr: number | null;
    volume_sma: number | null;
    volume_ratio: number | null;
    obv: number | null;
    return_1d: number | null;
    return_3d: number | null;
    return_5d: number | null;
    return_10d: number | null;
    price_position: number;
    gap: number;
    price_vs_sma20: number | null;
    price_vs_sma50: number | null;
    sma20_slope: number | null;
    sma50_slope: number | null;
    [key: string]: number | null;
}
interface NormalizedFeatures {
    [key: string]: number;
}
export declare function sma(prices: number[], length: number): number | null;
export declare function ema(prices: number[], length: number, previousEma?: number | null): number | null;
export declare function emaSeries(prices: number[], length: number): (number | null)[];
export declare function rsi(prices: number[], length?: number): number | null;
export declare function bollingerBands(prices: number[], length?: number, std?: number): BollingerBands;
export declare function atr(ohlcData: OHLCData[], length?: number): number | null;
export declare function macd(prices: number[], fast?: number, slow?: number, signal?: number): MACDData;
export declare function stochastic(ohlcData: OHLCData[], kPeriod?: number, dPeriod?: number): StochasticData;
export declare function williamsR(ohlcData: OHLCData[], length?: number): number | null;
export declare function obv(ohlcData: OHLCData[]): number | null;
export declare function priceReturns(prices: number[], period?: number): number | null;
export declare function createTechnicalFeatures(ohlcData: OHLCData[]): TechnicalFeatures | null;
export declare function normalizeTechnicalFeatures(features: TechnicalFeatures): NormalizedFeatures | null;
export type { OHLCData, BollingerBands, MACDData, StochasticData, TechnicalFeatures, NormalizedFeatures };
declare const _default: {
    createTechnicalFeatures: typeof createTechnicalFeatures;
    normalizeTechnicalFeatures: typeof normalizeTechnicalFeatures;
    sma: typeof sma;
    ema: typeof ema;
    rsi: typeof rsi;
    bollingerBands: typeof bollingerBands;
    atr: typeof atr;
    macd: typeof macd;
    stochastic: typeof stochastic;
    williamsR: typeof williamsR;
    obv: typeof obv;
    priceReturns: typeof priceReturns;
};
export default _default;
//# sourceMappingURL=technical_indicators.d.ts.map