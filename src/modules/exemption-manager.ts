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
  owner: string; // Email or user ID
  reason: string;
  expirationDate: string; // ISO date string
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
export class ExemptionManager {
  private env: CloudflareEnvironment;
  private cache: Map<string, Exemption> = new Map();

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  /**
   * Parse and validate exemptions in code
   */
  async parseExemptions(sourceFiles: string[]): Promise<ExemptionValidationResult> {
    const exemptions: Exemption[] = [];
    const violations: Array<{
      pattern: string;
      file: string;
      line: number;
      reason: string;
      severity: 'warning' | 'error';
    }> = [];

    const exemptionRegex = /\/\*\s*MOCK-EXEMPTION:\s*([A-Z]+-\d+)\s*-\s*([^*\n]+)\s*\*\/|\/\/\s*MOCK-EXEMPTION:\s*([A-Z]+-\d+)\s*-\s*([^\n]*)/g;

    for (const filePath of sourceFiles) {
      try {
        const content = await this.readFileContent(filePath);
        const lines = content.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          let match;

          // Find exemptions in this line
          while ((match = exemptionRegex.exec(line)) !== null) {
            const jiraReference = match[1] || match[3];
            const reason = match[2] || match[4];

            if (!jiraReference) {
              violations.push({
                pattern: 'MOCK-EXEMPTION',
                file: filePath,
                line: lineNum + 1,
                reason: 'Missing JIRA reference in exemption',
                severity: 'error'
              });
              continue;
            }

            // Validate JIRA reference format
            if (!/^[A-Z]+-\d+$/.test(jiraReference)) {
              violations.push({
                pattern: 'MOCK-EXEMPTION',
                file: filePath,
                line: lineNum + 1,
                reason: `Invalid JIRA reference format: ${jiraReference}`,
                severity: 'error'
              });
              continue;
            }

            // Create exemption object
            const exemption: Exemption = {
              id: `${filePath}:${lineNum + 1}:${jiraReference}`,
              pattern: 'MOCK-EXEMPTION',
              file: filePath,
              line: lineNum + 1,
              jiraReference,
              owner: this.extractOwnerFromJira(jiraReference),
              reason: reason?.trim() || 'No reason provided',
              expirationDate: this.calculateExpirationDate(),
              createdAt: new Date().toISOString(),
              createdBy: 'system',
              status: 'active',
              autoRenew: false
            };

            exemptions.push(exemption);
          }
        }
      } catch (error) {
        console.error(`Error parsing exemptions in ${filePath}:`, error);
      }
    }

    // Validate all exemptions
    const validationResult = await this.validateExemptions(exemptions);
    return {
      valid: validationResult.valid && violations.length === 0,
      exemptions: [...exemptions, ...validationResult.exemptions],
      violations: [...violations, ...validationResult.violations]
    };
  }

  /**
   * Validate exemption data against policies
   */
  private async validateExemptions(exemptions: Exemption[]): Promise<ExemptionValidationResult> {
    const validExemptions: Exemption[] = [];
    const violations: Array<{
      pattern: string;
      file: string;
      line: number;
      reason: string;
      severity: 'warning' | 'error';
    }> = [];

    const now = new Date();

    for (const exemption of exemptions) {
      // Check expiration
      const expirationDate = new Date(exemption.expirationDate);
      if (expirationDate <= now) {
        violations.push({
          pattern: exemption.pattern,
          file: exemption.file,
          line: exemption.line,
          reason: `Exemption expired on ${exemption.expirationDate}`,
          severity: 'error'
        });
        continue;
      }

      // Check owner assignment
      if (!exemption.owner || exemption.owner === 'unknown') {
        violations.push({
          pattern: exemption.pattern,
          file: exemption.file,
          line: exemption.line,
          reason: 'Exemption has no assigned owner',
          severity: 'warning'
        });
      }

      // Check expiration is within reasonable time (90 days max)
      const maxExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      if (expirationDate > maxExpiration && !exemption.autoRenew) {
        violations.push({
          pattern: exemption.pattern,
          file: exemption.file,
          line: exemption.line,
          reason: 'Exemption expiration date exceeds 90-day limit',
          severity: 'warning'
        });
      }

      validExemptions.push(exemption);
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      exemptions: validExemptions,
      violations
    };
  }

  /**
   * Get exemption report
   */
  async getExemptionReport(): Promise<ExemptionReport> {
    try {
      // Get exemptions from storage
      const exemptions = await this.getAllExemptions();
      const now = new Date();

      const activeExemptions = exemptions.filter(e => e.status === 'active');
      const expiredExemptions = exemptions.filter(e => e.status === 'expired');

      // Find upcoming expirations (next 30 days)
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcomingExpirations = activeExemptions
        .filter(e => new Date(e.expirationDate) <= thirtyDaysFromNow)
        .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());

      // Group by owner
      const byOwner: Record<string, number> = {};
      for (const exemption of activeExemptions) {
        byOwner[exemption.owner] = (byOwner[exemption.owner] || 0) + 1;
      }

      // Group by pattern
      const byPattern: Record<string, number> = {};
      for (const exemption of activeExemptions) {
        byPattern[exemption.pattern] = (byPattern[exemption.pattern] || 0) + 1;
      }

      return {
        totalActive: activeExemptions.length,
        totalExpired: expiredExemptions.length,
        upcomingExpirations,
        byOwner,
        byPattern,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating exemption report:', error);
      return {
        totalActive: 0,
        totalExpired: 0,
        upcomingExpirations: [],
        byOwner: {},
        byPattern: {},
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Create or update exemption
   */
  async createExemption(exemption: Omit<Exemption, 'id' | 'createdAt' | 'createdBy'>): Promise<Exemption> {
    const newExemption: Exemption = {
      ...exemption,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    };

    // Validate exemption
    if (!/^[A-Z]+-\d+$/.test(newExemption.jiraReference)) {
      throw new Error('Invalid JIRA reference format');
    }

    if (!newExemption.owner) {
      throw new Error('Owner is required');
    }

    // Store exemption
    await this.storeExemption(newExemption);

    return newExemption;
  }

  /**
   * Revoke exemption
   */
  async revokeExemption(exemptionId: string): Promise<void> {
    try {
      const exemption = await this.getExemption(exemptionId);
      if (exemption) {
        exemption.status = 'revoked';
        await this.storeExemption(exemption);
      }
    } catch (error) {
      console.error('Error revoking exemption:', error);
      throw error;
    }
  }

  /**
   * Get all exemptions
   */
  private async getAllExemptions(): Promise<Exemption[]> {
    try {
      if (this.env.CACHE) {
        // Try to get from cache first
        const cached = await (this.env as any).CACHE.get('exemptions:all', 'json');
        if (cached) {
          return cached;
        }
      }

      // Default to empty array if no storage available
      return [];

    } catch (error) {
      console.error('Error getting exemptions:', error);
      return [];
    }
  }

  /**
   * Store exemption
   */
  private async storeExemption(exemption: Exemption): Promise<void> {
    try {
      if (this.env.CACHE) {
        const storageKey = `exemption:${exemption.id}`;
        await (this.env as any).CACHE.put(storageKey, JSON.stringify(exemption), {
          expirationTtl: 365 * 24 * 60 * 60 // 1 year
        });

        // Also update the all exemptions cache
        const allExemptions = await this.getAllExemptions();
        const updatedExemptions = [
          ...allExemptions.filter(e => e.id !== exemption.id),
          exemption
        ];

        await (this.env as any).CACHE.put('exemptions:all', JSON.stringify(updatedExemptions), {
          expirationTtl: 24 * 60 * 60 // 24 hours
        });
      }
    } catch (error) {
      console.error('Error storing exemption:', error);
    }
  }

  /**
   * Get specific exemption
   */
  private async getExemption(exemptionId: string): Promise<Exemption | null> {
    try {
      if (this.env.CACHE) {
        const stored = await (this.env as any).CACHE.get(`exemption:${exemptionId}`, 'json');
        return stored;
      }
      return null;
    } catch (error) {
      console.error('Error getting exemption:', error);
      return null;
    }
  }

  /**
   * Extract owner from JIRA reference
   */
  private extractOwnerFromJira(jiraReference: string): string {
    // This would integrate with your JIRA API to get assignee
    // For now, return a default
    return 'team-lead@example.com';
  }

  /**
   * Calculate default expiration date (30 days from now)
   */
  private calculateExpirationDate(): string {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30);
    return expiration.toISOString();
  }

  /**
   * Read file content
   */
  private async readFileContent(filePath: string): Promise<string> {
    // In a real implementation, this would read from the file system
    // For Cloudflare Workers, you might need to use a different approach
    try {
      // This is a placeholder - implement based on your environment
      return `// File content for ${filePath}`;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Auto-renew expiring exemptions
   */
  async autoRenewExemptions(): Promise<void> {
    const exemptions = await this.getAllExemptions();
    const now = new Date();

    for (const exemption of exemptions) {
      if (exemption.autoRenew && exemption.status === 'active') {
        const expirationDate = new Date(exemption.expirationDate);
        const threeDaysBefore = new Date(expirationDate.getTime() - 3 * 24 * 60 * 60 * 1000);

        if (now >= threeDaysBefore && now < expirationDate) {
          // Auto-renew for another 30 days
          exemption.expirationDate = this.calculateExpirationDate();
          await this.storeExemption(exemption);

          console.log(`Auto-renewed exemption ${exemption.id} until ${exemption.expirationDate}`);
        }
      }
    }
  }

  /**
   * Clean up expired exemptions
   */
  async cleanupExpiredExemptions(): Promise<void> {
    const exemptions = await this.getAllExemptions();
    const now = new Date();

    for (const exemption of exemptions) {
      if (exemption.status === 'active') {
        const expirationDate = new Date(exemption.expirationDate);
        if (expirationDate <= now) {
          exemption.status = 'expired';
          await this.storeExemption(exemption);

          console.log(`Marked exemption ${exemption.id} as expired`);
        }
      }
    }
  }
}