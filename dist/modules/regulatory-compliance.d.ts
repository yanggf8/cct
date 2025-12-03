/**
 * Regulatory Compliance Engine
 * Comprehensive regulatory compliance checking and reporting system
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */
export declare const COMPLIANCE_NAMESPACES: {
    COMPLIANCE_ASSESSMENTS: string;
    REGULATORY_REPORTS: string;
    AUDIT_TRAILS: string;
    POLICIES: string;
    TRAINING_RECORDS: string;
    COMPLIANCE_ALERTS: string;
};
export declare const COMPLIANCE_TTL: {
    ASSESSMENT_CACHE: number;
    REPORTS_CACHE: number;
    AUDIT_CACHE: number;
    POLICY_CACHE: number;
    TRAINING_CACHE: number;
    ALERTS_CACHE: number;
};
/**
 * Regulatory Frameworks and Requirements
 */
export declare const REGULATORY_FRAMEWORKS: {
    SEC_US: {
        name: string;
        jurisdiction: string;
        requirements: {
            REGISTRATION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            DISCLOSURE: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            CUSTODY: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            BOOKS_RECORDS: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            COMPLIANCE_PROGRAM: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            PRIVACY: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            MARKETING: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            CODE_OF_ETHICS: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
        };
    };
    FINRA: {
        name: string;
        jurisdiction: string;
        requirements: {
            SUITABILITY: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            MARGIN: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            SUPERVISION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            ANTI_MONEY_LAUNDERING: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            CONTINGENCY_PLANNING: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            CYBERSECURITY: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
        };
    };
    MIFID_II: {
        name: string;
        jurisdiction: string;
        requirements: {
            BEST_EXECUTION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            REPORTING: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            INVESTOR_PROTECTION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            PRODUCT_GOVERNANCE: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            ORDER_EXECUTION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            RESEARCH: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
        };
    };
    GDPR: {
        name: string;
        jurisdiction: string;
        requirements: {
            DATA_PROTECTION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            RIGHTS_MANAGEMENT: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            BREACH_NOTIFICATION: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            DPIA: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
            DATA_PROCESSING_AGREEMENTS: {
                description: string;
                rules: string[];
                frequency: string;
                mandatory: boolean;
            };
        };
    };
};
/**
 * Compliance Status Types
 */
export declare const COMPLIANCE_STATUS: {
    COMPLIANT: {
        value: number;
        label: string;
        color: string;
    };
    PARTIALLY_COMPLIANT: {
        value: number;
        label: string;
        color: string;
    };
    NON_COMPLIANT: {
        value: number;
        label: string;
        color: string;
    };
    NOT_APPLICABLE: {
        value: number;
        label: string;
        color: string;
    };
};
/**
 * Regulatory Compliance Engine
 */
export declare class RegulatoryComplianceEngine {
    private env;
    private activeFrameworks;
    private complianceCalendar;
    private policies;
    constructor(env: any);
    /**
     * Perform comprehensive compliance assessment
     */
    performComplianceAssessment(portfolioData: any, clientData?: any, frameworks?: string[]): Promise<any>;
    /**
     * Assess specific regulatory framework
     */
    assessFramework(portfolioData: any, clientData: any, framework: string): Promise<any>;
    /**
     * Assess specific requirement
     */
    assessRequirement(portfolioData: any, clientData: any, framework: any, requirement: any, config: any): Promise<{
        requirement: any;
        requirementDescription: any;
        rules: any;
        frequency: any;
        mandatory: any;
        status: {
            value: number;
            label: string;
            color: string;
        };
        lastChecked: string;
        nextDue: Date;
        evidence: any[];
        description: string;
        deduction: number;
        recommendation: string;
        recommendations: any[];
    } | {
        requirement: any;
        status: {
            value: number;
            label: string;
            color: string;
        };
        description: string;
        deduction: number;
        recommendations: any[];
    }>;
    /**
     * Assess registration requirement
     */
    assessRegistrationRequirement(portfolioData: any, assessment: any): Promise<void>;
    /**
     * Assess disclosure requirement
     */
    assessDisclosureRequirement(portfolioData: any, clientData: any, assessment: any): Promise<void>;
    /**
     * Assess suitability requirement
     */
    assessSuitabilityRequirement(portfolioData: any, clientData: any, assessment: any): Promise<void>;
    /**
     * Assess margin requirement
     */
    assessMarginRequirement(portfolioData: any, assessment: any): Promise<void>;
    /**
     * Assess best execution requirement
     */
    assessBestExecutionRequirement(portfolioData: any, assessment: any): Promise<void>;
    /**
     * Assess data protection requirement
     */
    assessDataProtectionRequirement(clientData: any, assessment: any): Promise<void>;
    /**
     * Assess AML requirement
     */
    assessAMLRequirement(portfolioData: any, clientData: any, assessment: any): Promise<void>;
    /**
     * Assess generic requirement
     */
    assessGenericRequirement(portfolioData: any, assessment: any): Promise<void>;
    /**
     * Generate regulatory report
     */
    generateRegulatoryReport(portfolioData: any, reportType: any, framework: any, period?: {}): Promise<{
        id: string;
        reportType: any;
        framework: any;
        reportDate: string;
        period: {};
        portfolioId: any;
        status: string;
        content: {};
        attachments: any[];
        signed: boolean;
        submitted: boolean;
    }>;
    /**
     * Create compliance policy
     */
    createCompliancePolicy(policyData: any): Promise<any>;
    /**
     * Update compliance training records
     */
    updateTrainingRecords(employeeId: any, trainingData: any): Promise<any>;
    generateAssessmentId(): string;
    generateReportId(): string;
    generatePolicyId(): string;
    generateTrainingId(): string;
    initializeComplianceCalendar(): {};
    initializePolicies(): {
        codeOfEthics: {
            id: string;
            name: string;
            version: string;
            lastUpdated: string;
            status: string;
            applicableFrameworks: string[];
        };
        privacyPolicy: {
            id: string;
            name: string;
            version: string;
            lastUpdated: string;
            status: string;
            applicableFrameworks: string[];
        };
        bestExecution: {
            id: string;
            name: string;
            version: string;
            lastUpdated: string;
            status: string;
            applicableFrameworks: string[];
        };
    };
    createAuditEntry(action: any, description: any): {
        timestamp: string;
        action: any;
        description: any;
        userId: string;
        ipAddress: string;
    };
    getWorstStatus(status1: any, status2: any): any;
    calculateNextDueDate(frequency: any): Date;
    calculateNextTrainingDate(trainingType: any): Date;
    getDefaultReportPeriod(reportType: any): {
        startDate: Date;
        endDate: Date;
    };
    getUpcomingDeadlines(frameworks: any): any[];
    checkRegistrationStatus(portfolioData: any): Promise<boolean>;
    checkDisclosureCompleteness(portfolioData: any, clientData: any): Promise<boolean>;
    performSuitabilityCheck(portfolioData: any, clientData: any): Promise<{
        suitable: boolean;
    }>;
    checkMarginCompliance(portfolioData: any): Promise<{
        compliant: boolean;
    }>;
    checkBestExecution(portfolioData: any): Promise<{
        compliant: boolean;
    }>;
    checkDataProtectionCompliance(clientData: any): Promise<{
        compliant: boolean;
    }>;
    checkAMLCompliance(portfolioData: any, clientData: any): Promise<{
        compliant: boolean;
    }>;
    generateFormADV(portfolioData: any, framework: any): Promise<{
        type: string;
        content: {
            part1: {
                firmInfo: string;
                assetsUnderManagement: any;
                clients: number;
            };
            part2A: {
                strategies: string;
                risks: string;
                fees: string;
            };
        };
    }>;
    generateComplianceReport(portfolioData: any, framework: any): Promise<{
        type: string;
        content: {
            executiveSummary: string;
            frameworkStatus: string;
            violations: any[];
            correctiveActions: any[];
        };
    }>;
    generateAMLReport(portfolioData: any, framework: any): Promise<{
        type: string;
        content: {
            programOverview: string;
            riskAssessment: string;
            trainingRecords: string;
            suspiciousActivity: string;
        };
    }>;
    generatePrivacyNotice(portfolioData: any): Promise<{
        type: string;
        content: {
            dataCollection: string;
            usage: string;
            sharing: string;
            rights: string;
        };
    }>;
    generateAuditReport(portfolioData: any, framework: any): Promise<{
        type: string;
        content: {
            scope: string;
            findings: string;
            recommendations: string;
            conclusion: string;
        };
    }>;
    validateCompliancePolicy(policy: any): Promise<void>;
    persistComplianceAssessment(assessment: any): Promise<void>;
    persistRegulatoryReport(report: any): Promise<void>;
    persistCompliancePolicy(policy: any): Promise<void>;
    persistTrainingRecord(record: any): Promise<void>;
}
/**
 * Factory function for creating compliance engine instances
 */
export declare function createRegulatoryComplianceEngine(env: any): RegulatoryComplianceEngine;
/**
 * Utility functions for regulatory compliance
 */
export declare function assessCompliance(env: any, portfolioData: any, clientData: any, frameworks: any): Promise<any>;
export declare function generateReport(env: any, portfolioData: any, reportType: any, framework: any, period: any): Promise<{
    id: string;
    reportType: any;
    framework: any;
    reportDate: string;
    period: {};
    portfolioId: any;
    status: string;
    content: {};
    attachments: any[];
    signed: boolean;
    submitted: boolean;
}>;
export declare function createPolicy(env: any, policyData: any): Promise<any>;
//# sourceMappingURL=regulatory-compliance.d.ts.map