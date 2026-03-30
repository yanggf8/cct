/**
 * Backtesting Engine Types
 * Institutional-grade backtesting and model validation framework
 */

// ===== Core Backtesting Types =====

export interface BacktestConfig {
  id: string;
  name: string;
  description?: string;
  strategy: StrategyConfig;
  data: DataConfig;
  execution: ExecutionConfig;
  validation: ValidationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyConfig {
  type: 'predictive_model' | 'technical_analysis' | 'sentiment_based' | 'hybrid';
  parameters: Record<string, any>;
  positionSizing: PositionSizingConfig;
  riskManagement: RiskManagementConfig;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface DataConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  benchmark?: string;
  dataSource: 'yahoo_finance' | 'alpha_vantage' | 'polygon' | 'custom';
  includeCorporateActions: boolean;
  includeDividends: boolean;
  priceAdjustment: 'split' | 'dividend' | 'all' | 'none';
}

export interface ExecutionConfig {
  initialCapital: number;
  commission: CommissionConfig;
  slippage: SlippageConfig;
  latency: LatencyConfig;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  fillModel: 'immediate' | 'realistic' | 'worst_case';
  shortSelling: boolean;
  leverage: number;
}

export interface ValidationConfig {
  crossValidation: CrossValidationConfig;
  outOfSampleTesting: OutOfSampleConfig;
  significanceTesting: SignificanceConfig;
  overfittingDetection: OverfittingConfig;
}

// ===== Position and Risk Management =====

export interface PositionSizingConfig {
  method: 'fixed_dollar' | 'fixed_percent' | 'volatility_target' | 'kelly_criterion' | 'risk_parity';
  parameters: {
    fixedDollarAmount?: number;
    fixedPercent?: number;
    targetVolatility?: number;
    maxPositionSize?: number;
    minPositionSize?: number;
  };
}

export interface RiskManagementConfig {
  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;
  maxDrawdown: number;
  maxConcentration: number;
  sectorLimits?: Record<string, number>;
  varLimit?: number;
  varConfidence?: number;
}

export interface StopLossConfig {
  enabled: boolean;
  method: 'fixed_percent' | 'atr_based' | 'volatility_based' | 'support_resistance';
  parameters: Record<string, number>;
}

export interface TakeProfitConfig {
  enabled: boolean;
  method: 'fixed_percent' | 'atr_based' | 'volatility_based' | 'resistance_level';
  parameters: Record<string, number>;
}

// ===== Execution Cost Models =====

export interface CommissionConfig {
  model: 'fixed_per_share' | 'fixed_per_trade' | 'percent_of_value' | 'tiered' | 'zero';
  parameters: {
    perShare?: number;
    perTrade?: number;
    percent?: number;
    minCommission?: number;
    maxCommission?: number;
  };
}

export interface SlippageConfig {
  model: 'fixed_percent' | 'volume_based' | 'volatility_based' | 'realistic' | 'zero';
  parameters: {
    buySlippage?: number;
    sellSlippage?: number;
    volumeImpact?: number;
    volatilityImpact?: number;
  };
}

export interface LatencyConfig {
  model: 'zero' | 'fixed' | 'realistic';
  parameters: {
    executionDelay?: number; // milliseconds
    dataDelay?: number; // milliseconds
  };
}

// ===== Backtest Results =====

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  performance: PerformanceMetrics;
  positions: Position[];
  trades: Trade[];
  equityCurve: EquityPoint[];
  analytics: AdvancedAnalytics;
  validation: ValidationResult;
  metadata: BacktestMetadata;
  generatedAt: string;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgTradeDuration: number;
  sharpeRatioAdjusted: number;
  informationRatio?: number;
  beta?: number;
  alpha?: number;
  trackingError?: number;
}

export interface Position {
  symbol: string;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  weight: number;
  sector?: string;
  entryReason?: string;
  exitReason?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell' | 'sell_short' | 'buy_cover';
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
  slippage: number;
  signal: TradeSignal;
  reason?: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
  returns: number;
  cumulativeReturns: number;
  drawdown: number;
  benchmark?: number;
  benchmarkReturns?: number;
  benchmarkDrawdown?: number;
}

export interface TradeSignal {
  type: 'entry' | 'exit';
  strength: number; // 0 to 1
  confidence: number; // 0 to 1
  prediction?: ModelPrediction;
  technicalIndicators?: Record<string, number>;
  sentimentScore?: number;
  reason?: string;
}

export interface ModelPrediction {
  modelId: string;
  modelName: string;
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  probabilityDistribution?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  features?: Record<string, number>;
  timestamp: string;
}

// ===== Advanced Analytics =====

export interface AdvancedAnalytics {
  attribution: PerformanceAttribution;
  riskMetrics: RiskMetrics;
  sectorAnalysis: SectorAnalysis;
  regimeAnalysis: RegimeAnalysis;
  correlationAnalysis: CorrelationAnalysis;
  factorExposure?: FactorExposure;
}

export interface PerformanceAttribution {
  stockSelection: number;
  sectorAllocation: number;
  timing: number;
  interaction: number;
  totalAlpha: number;
  breakdown: AttributionBreakdown[];
}

export interface AttributionBreakdown {
  period: string;
  stockSelection: number;
  sectorAllocation: number;
  timing: number;
  interaction: number;
  total: number;
}

export interface RiskMetrics {
  var1Day: number;
  var5Day: number;
  var95: number;
  var99: number;
  expectedShortfall: number;
  downsideDeviation: number;
  upsideCapture: number;
  downsideCapture: number;
  beta: number;
  correlationWithMarket: number;
  trackingError: number;
}

export interface SectorAnalysis {
  sectors: SectorPerformance[];
  concentration: ConcentrationMetrics;
  rotation: SectorRotation[];
}

export interface SectorPerformance {
  sector: string;
  weight: number;
  return: number;
  contribution: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface ConcentrationMetrics {
  herfindahlIndex: number;
  topPositionWeight: number;
  top5Weight: number;
  giniCoefficient: number;
}

export interface SectorRotation {
  date: string;
  fromSector: string;
  toSector: string;
  amount: number;
  reason: string;
}

export interface RegimeAnalysis {
  regimes: MarketRegime[];
  performanceByRegime: RegimePerformance[];
  regimeDetection: RegimeDetectionResult;
}

export interface MarketRegime {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  characteristics: RegimeCharacteristics;
}

export interface RegimeCharacteristics {
  volatility: 'low' | 'medium' | 'high';
  trend: 'bull' | 'bear' | 'sideways';
  correlation: 'low' | 'medium' | 'high';
  marketCondition: 'growth' | 'value' | 'crisis' | 'recovery';
}

export interface RegimePerformance {
  regime: string;
  return: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
}

export interface RegimeDetectionResult {
  method: string;
  parameters: Record<string, any>;
  confidence: number;
  predictedRegime?: string;
  transitionProbability?: number;
}

export interface CorrelationAnalysis {
  correlationMatrix: CorrelationMatrix;
  averageCorrelation: number;
  eigenvalues: number[];
  principalComponents: PrincipalComponent[];
  riskContribution: RiskContribution[];
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
}

export interface PrincipalComponent {
  component: number;
  eigenvalue: number;
  explainedVariance: number;
  loadings: Record<string, number>;
}

export interface RiskContribution {
  symbol: string;
  contribution: number;
  percentage: number;
}

export interface FactorExposure {
  factors: FactorExposureItem[];
  factorReturns: FactorReturn[];
  attribution: FactorAttribution;
}

export interface FactorExposureItem {
  factor: string;
  exposure: number;
  tStat: number;
  pValue: number;
}

export interface FactorReturn {
  factor: string;
  return: number;
  contribution: number;
}

export interface FactorAttribution {
  commonFactors: number;
  specificRisk: number;
  totalRisk: number;
  rSquared: number;
}

// ===== Model Validation =====

export interface ValidationResult {
  crossValidation: CrossValidationResult;
  outOfSample: OutOfSampleResult;
  significance: SignificanceResult;
  overfitting: OverfittingResult;
  walkForward: WalkForwardResult;
  monteCarlo: MonteCarloResult;
  bootstrap: BootstrapResult;
  overallScore: number;
  recommendation: 'accept' | 'reject' | 'conditional';
}

export interface CrossValidationConfig {
  method: 'time_series_split' | 'rolling_window' | 'expanding_window';
  folds: number;
  testSize: number;
  randomSeed?: number;
}

export interface CrossValidationResult {
  config: CrossValidationConfig;
  foldResults: FoldResult[];
  avgPerformance: PerformanceMetrics;
  performanceStdDev: PerformanceMetrics;
  stabilityScore: number;
  recommendation: string;
}

export interface FoldResult {
  fold: number;
  trainPeriod: string;
  testPeriod: string;
  performance: PerformanceMetrics;
  trainPerformance: PerformanceMetrics;
}

export interface OutOfSampleConfig {
  trainRatio: number;
  validationRatio: number;
  testRatio: number;
  shuffleSeed?: number;
}

export interface OutOfSampleResult {
  config: OutOfSampleConfig;
  trainPerformance: PerformanceMetrics;
  validationPerformance: PerformanceMetrics;
  testPerformance: PerformanceMetrics;
  degradationMetrics: DegradationMetrics;
}

export interface DegradationMetrics {
  trainToTest: number;
  validationToTest: number;
  significance: number;
  acceptable: boolean;
}

export interface SignificanceConfig {
  methods: ('t_test' | 'wilcoxon' | 'bootstrap')[];
  benchmark?: string;
  confidenceLevel: number;
  minObservations: number;
}

export interface SignificanceResult {
  config: SignificanceConfig;
  tests: StatisticalTest[];
  overallSignificance: number;
  isSignificant: boolean;
  benchmarkComparison?: BenchmarkComparison;
}

export interface StatisticalTest {
  method: string;
  statistic: number;
  pValue: number;
  criticalValue: number;
  isSignificant: boolean;
  confidenceInterval: [number, number];
}

export interface BenchmarkComparison {
  benchmark: string;
  alpha: number;
  beta: number;
  informationRatio: number;
  trackingError: number;
  alphaSignificance: StatisticalTest;
}

export interface OverfittingConfig {
  methods: ('cross_validation' | 'learning_curve' | 'feature_importance')[];
  threshold: number;
  lookAheadBias: boolean;
  survivorshipBias: boolean;
}

export interface OverfittingResult {
  config: OverfittingConfig;
  indicators: OverfittingIndicator[];
  riskScore: number;
  recommendation: 'low_risk' | 'medium_risk' | 'high_risk';
}

export interface OverfittingIndicator {
  method: string;
  value: number;
  threshold: number;
  isOverfit: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  overallPerformance: PerformanceMetrics;
  stabilityMetrics: StabilityMetrics;
  parameterStability: ParameterStability[];
}

export interface WalkForwardWindow {
  window: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  parameters: Record<string, any>;
  performance: PerformanceMetrics;
}

export interface StabilityMetrics {
  returnStability: number;
  volatilityStability: number;
  sharpeStability: number;
  drawdownStability: number;
  overallStability: number;
}

export interface ParameterStability {
  parameter: string;
  optimalValues: number[];
  stability: number;
  trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
}

export interface MonteCarloResult {
  simulations: MonteCarloSimulation[];
  summary: MonteCarloSummary;
  confidenceIntervals: ConfidenceInterval[];
  tailRisk: TailRiskMetrics;
}

export interface MonteCarloSimulation {
  simulation: number;
  finalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  equityCurve: EquityPoint[];
}

export interface MonteCarloSummary {
  meanReturn: number;
  medianReturn: number;
  stdDevReturn: number;
  percentiles: Record<number, number>;
  successProbability: number;
  riskOfRuin: number;
}

export interface ConfidenceInterval {
  metric: string;
  level: number;
  lower: number;
  upper: number;
  estimate: number;
  margin: number;
}

export interface TailRiskMetrics {
  expectedShortfall: number;
  conditionalVar: number;
  maximumLoss: number;
  recoveryTime: number;
  tailRiskPremium: number;
}

export interface BootstrapResult {
  samples: BootstrapSample[];
  originalPerformance: PerformanceMetrics;
  bootstrapDistribution: BootstrapDistribution;
  biasCorrectedPerformance: PerformanceMetrics;
  significanceTests: StatisticalTest[];
}

export interface BootstrapSample {
  sample: number;
  performance: PerformanceMetrics;
  resampledIndices: number[];
}

export interface BootstrapDistribution {
  mean: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  percentiles: Record<number, number>;
}

// ===== Metadata =====

export interface BacktestMetadata {
  version: string;
  environment: string;
  processingTime: number;
  warnings: string[];
  errors: BacktestError[];
  assumptions: Assumption[];
  dataQuality: DataQualityMetrics;
  executionLog: ExecutionLogEntry[];
}

export interface Assumption {
  category: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  justification: string;
}

export interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  gaps: DataGap[];
}

export interface DataGap {
  symbol: string;
  startDate: string;
  endDate: string;
  type: 'price' | 'volume' | 'corporate_action' | 'other';
  severity: 'low' | 'medium' | 'high';
}

export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  component: string;
  message: string;
  details?: Record<string, any>;
}

// ===== API Request/Response Types =====

export interface RunBacktestRequest {
  config: BacktestConfig;
  priority?: 'low' | 'normal' | 'high';
  dryRun?: boolean;
  notification?: NotificationConfig;
}

export interface NotificationConfig {
  email?: string;
  webhook?: string;
  onCompletion: boolean;
  onError: boolean;
}

export interface RunBacktestResponse {
  backtestId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  estimatedDuration?: number;
  queuePosition?: number;
  startedAt?: string;
  estimatedCompletion?: string;
}

export interface BacktestStatusResponse {
  backtestId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
  startedAt: string;
  estimatedCompletion?: string;
  error?: string;
  resultId?: string;
}

export interface BacktestResultsResponse {
  id: string;
  result: BacktestResult;
  downloadUrls: DownloadUrls;
  relatedBacktests: string[];
}

export interface DownloadUrls {
  pdf: string;
  csv: string;
  json: string;
  excel: string;
}

export interface CompareBacktestsRequest {
  backtestIds: string[];
  metrics?: (keyof PerformanceMetrics)[];
  charts?: string[];
  statistics?: boolean;
}

export interface CompareBacktestsResponse {
  comparison: BacktestComparison;
  ranking: BacktestRanking;
  statisticalTests: StatisticalTest[];
  recommendations: Recommendation[];
}

export interface BacktestComparison {
  backtestIds: string[];
  metrics: Record<string, number[]>;
  statisticalSignificance: Record<string, StatisticalTest>;
  charts: ComparisonChart[];
}

export interface BacktestRanking {
  bySharpe: RankingEntry[];
  byReturn: RankingEntry[];
  byCalmar: RankingEntry[];
  byWinRate: RankingEntry[];
  overall: RankingEntry[];
}

export interface RankingEntry {
  backtestId: string;
  rank: number;
  score: number;
  percentile: number;
}

export interface ComparisonChart {
  type: 'equity_curve' | 'drawdown' | 'rolling_returns' | 'correlation_matrix';
  title: string;
  data: any;
  metadata: Record<string, any>;
}

export interface Recommendation {
  category: 'performance' | 'risk' | 'robustness' | 'implementation';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  rationale: string;
  actionable: boolean;
}

export interface BacktestHistoryResponse {
  backtests: BacktestSummary[];
  pagination: PaginationInfo;
  filters: FilterInfo;
}

export interface BacktestSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  symbols: string[];
  strategy: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FilterInfo {
  appliedFilters: Record<string, any>;
  availableFilters: FilterOption[];
}

export interface FilterOption {
  field: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: string[];
  min?: number;
  max?: number;
}

// ===== Error Types =====

export interface BacktestError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface ValidationError {
  field: string;
  value: any;
  constraint: string;
  message: string;
}

// ===== Utility Types =====

export type MetricType = keyof PerformanceMetrics;
export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StrategyType = 'predictive_model' | 'technical_analysis' | 'sentiment_based' | 'hybrid';
export type ValidationMethod = 'cross_validation' | 'out_of_sample' | 'walk_forward' | 'monte_carlo' | 'bootstrap';