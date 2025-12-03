/**
 * Messenger Alerts - Facebook Messenger & LINE Integration
 * Send trading alerts via Facebook Messenger and LINE messaging platforms
 */
import type { CloudflareEnvironment } from '../types';
/**
 * Alert level enumeration
 */
export type AlertLevel = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE';
/**
 * Trading signal interface
 */
export interface TradingSignal {
    symbol: string;
    action: string;
    current_price: number;
    confidence: number;
    reasoning: string;
    components?: {
        price_prediction?: {
            predicted_price?: number;
            confidence?: number;
            time_horizon?: string;
        };
        sentiment_analysis?: {
            overall_sentiment?: string;
            confidence?: number;
            key_factors?: string[];
        };
    };
}
/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    success_rate: number;
    avg_confidence: number;
    signal_distribution: {
        BUY?: number;
        SELL?: number;
        HOLD?: number;
    };
}
/**
 * Analysis results interface
 */
export interface AnalysisResults {
    trading_signals: Record<string, TradingSignal>;
    performance_metrics: PerformanceMetrics;
}
/**
 * Alert interface
 */
export interface TradingAlert {
    symbol: string;
    level: AlertLevel;
    timestamp?: Date;
    message?: string;
}
/**
 * Facebook Graph API response interface
 */
export interface FacebookGraphResponse {
    recipient_id: string;
    message_id: string;
}
/**
 * Facebook Graph API error interface
 */
export interface FacebookGraphError {
    error: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number;
    };
}
/**
 * LINE Messaging API response interface
 */
export interface LineMessageResponse {
    [key: string]: any;
}
/**
 * LINE Messaging API error interface
 */
export interface LineMessageError {
    error: {
        message: string;
        details?: any[];
    };
}
/**
 * Facebook message recipient interface
 */
export interface FacebookRecipient {
    id: string;
}
/**
 * Facebook message interface
 */
export interface FacebookMessage {
    text?: string;
    attachment?: {
        type: 'template';
        payload: {
            template_type: 'generic';
            elements: FacebookGenericElement[];
        };
    };
}
/**
 * Facebook generic template element interface
 */
export interface FacebookGenericElement {
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: FacebookButton[];
}
/**
 * Facebook button interface
 */
export interface FacebookButton {
    type: 'web_url' | 'postback';
    url?: string;
    title: string;
    payload?: string;
}
/**
 * Facebook message request payload interface
 */
export interface FacebookMessageRequest {
    recipient: FacebookRecipient;
    message: FacebookMessage;
    messaging_type: 'UPDATE' | 'MESSAGE_TAG' | 'RESPONSE';
}
/**
 * LINE message action interface
 */
export interface LineMessageAction {
    type: 'uri' | 'postback';
    label: string;
    uri?: string;
    data?: string;
}
/**
 * LINE flex content interface
 */
export interface LineFlexContent {
    type: string;
    text?: string;
    weight?: 'bold' | 'normal';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    color?: string;
    align?: 'start' | 'center' | 'end';
    margin?: string;
    spacing?: string;
    wrap?: boolean;
    flex?: number;
    url?: string;
    aspectRatio?: string;
    aspectMode?: string;
    layout?: 'horizontal' | 'vertical' | 'baseline';
    contents?: LineFlexContent[];
    action?: LineMessageAction;
    style?: string;
    height?: string;
}
/**
 * LINE bubble container interface
 */
export interface LineBubbleContainer {
    type: 'bubble';
    hero?: {
        type: 'image';
        url: string;
        size?: string;
        aspectRatio?: string;
        aspectMode?: string;
    };
    body: {
        type: 'box';
        layout: 'vertical';
        contents: LineFlexContent[];
    };
    footer?: {
        type: 'box';
        layout: 'vertical';
        spacing?: string;
        contents: LineFlexContent[];
        flex?: number;
    };
}
/**
 * LINE carousel container interface
 */
export interface LineCarouselContainer {
    type: 'carousel';
    contents: LineBubbleContainer[];
}
/**
 * LINE flex message interface
 */
export interface LineFlexMessage {
    type: 'flex';
    altText: string;
    contents: LineCarouselContainer;
}
/**
 * LINE sticker message interface
 */
export interface LineStickerMessage {
    type: 'sticker';
    packageId: string;
    stickerId: string;
}
/**
 * LINE message push request interface
 */
export interface LineMessagePushRequest {
    to: string;
    messages: (LineFlexMessage | LineStickerMessage | {
        type: 'text';
        text: string;
    })[];
}
/**
 * Company domain mapping interface
 */
export interface CompanyDomainMap {
    [symbol: string]: string;
}
/**
 * Send Facebook Messenger alert
 *
 * @param alerts - Array of trading alerts
 * @param analysisResults - Complete analysis results with trading signals
 * @param env - Cloudflare environment variables
 */
export declare function sendFacebookMessengerAlert(alerts: TradingAlert[], analysisResults: AnalysisResults, env: CloudflareEnvironment): Promise<void>;
/**
 * Send detailed signal card via Facebook Messenger
 *
 * @param alert - Trading alert information
 * @param signal - Detailed trading signal
 * @param env - Cloudflare environment variables
 */
export declare function sendFacebookSignalCard(alert: TradingAlert, signal: TradingSignal, env: CloudflareEnvironment): Promise<void>;
/**
 * Send LINE (Taiwan) alert
 *
 * @param alerts - Array of trading alerts
 * @param analysisResults - Complete analysis results with trading signals
 * @param env - Cloudflare environment variables
 */
export declare function sendLINEAlert(alerts: TradingAlert[], analysisResults: AnalysisResults, env: CloudflareEnvironment): Promise<void>;
/**
 * Create LINE Flex Message for trading alerts
 *
 * @param alerts - Array of high confidence alerts
 * @param analysisResults - Complete analysis results
 * @returns LINE Flex Message object
 */
export declare function createLINEFlexMessage(alerts: TradingAlert[], analysisResults: AnalysisResults): LineFlexMessage;
/**
 * Send celebratory LINE sticker for strong signals
 *
 * @param userId - LINE user ID
 * @param token - LINE channel access token
 */
export declare function sendLINESticker(userId: string, token: string): Promise<void>;
/**
 * Get company domain for logo fetching
 *
 * @param symbol - Stock symbol
 * @returns Company domain string
 */
export declare function getCompanyDomain(symbol: string): string;
/**
 * Send critical system alert via all messenger platforms
 *
 * @param errorMessage - Error message to send
 * @param env - Cloudflare environment variables
 */
export declare function sendCriticalMessengerAlert(errorMessage: string, env: CloudflareEnvironment): Promise<void>;
//# sourceMappingURL=messenger-alerts.d.ts.map