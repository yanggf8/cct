/**
 * Exemption Lifecycle Manager
 * Smart tracking of production exemptions with Jira references, owners, and expiration dates
 */
import type { CloudflareEnvironment } from '../types.js';
export interface Exemption {
    id: string;
    pattern: string;
    file: string;
    line: number;
    jiraReference: string;
    owner: string;
    reason: string;
    expirationDate: string;
    createdAt: string;
    createdBy: string;
    status: 'active' | 'expired' | 'revoked';
    autoRenew: boolean;
    metadata?: Record<string, any>;
}
export interface ExemptionReport {
    totalActive: number;
    totalExpired: number;
    upcomingExpirations: Exemption[];
    byOwner: Record<string, number>;
    byPattern: Record<string, number>;
    generatedAt: string;
}
export interface ExemptionValidationResult {
    valid: boolean;
    exemptions: Exemption[];
    violations: Array<{
        pattern: string;
        file: string;
        line: number;
        reason: string;
        severity: 'warning' | 'error';
    }>;
}
/**
 * Exemption Manager Class
 */
export declare class ExemptionManager {
    private env;
    private cache;
    constructor(env: CloudflareEnvironment);
    /**
     * Parse and validate exemptions in code
     */
    parseExemptions(sourceFiles: string[]): Promise<ExemptionValidationResult>;
    /**
     * Validate exemption data against policies
     */
    private validateExemptions;
    /**
     * Get exemption report
     */
    getExemptionReport(): Promise<ExemptionReport>;
    /**
     * Create or update exemption
     */
    createExemption(exemption: Omit<Exemption, 'id' | 'createdAt' | 'createdBy'>): Promise<Exemption>;
    /**
     * Revoke exemption
     */
    revokeExemption(exemptionId: string): Promise<void>;
    /**
     * Get all exemptions
     */
    private getAllExemptions;
    /**
     * Store exemption
     */
    private storeExemption;
    /**
     * Get specific exemption
     */
    private getExemption;
    /**
     * Extract owner from JIRA reference
     */
    private extractOwnerFromJira;
    /**
     * Calculate default expiration date (30 days from now)
     */
    private calculateExpirationDate;
    /**
     * Read file content
     */
    private readFileContent;
    /**
     * Auto-renew expiring exemptions
     */
    autoRenewExemptions(): Promise<void>;
    /**
     * Clean up expired exemptions
     */
    cleanupExpiredExemptions(): Promise<void>;
}
//# sourceMappingURL=exemption-manager.d.ts.map