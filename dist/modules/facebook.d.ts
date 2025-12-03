/**
 * Facebook Integration Module
 * Stubbed for local testing; integrate real Facebook API in production
 */
export interface FacebookMessageResult {
    ok: boolean;
    psid: string;
    message: string;
}
export declare function sendFacebookMessage(psid: string, message: string): Promise<FacebookMessageResult>;
//# sourceMappingURL=facebook.d.ts.map