/**
 * Regulatory Compliance Engine
 * Comprehensive regulatory compliance checking and reporting system
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */

import { createDAL } from './dal.js';

// Simple KV functions using DAL
async function getKVStore(env: any, key: any) {
  const dal = createDAL(env);
  const result = await dal.read(key);
  return result.success ? result.data : null;
}

async function setKVStore(env, key, data, ttl) {
  const dal = createDAL(env);
  const result = await dal.write(key, data, { expirationTtl: ttl });
  return result.success;
}

// Compliance namespaces and TTL
export const COMPLIANCE_NAMESPACES = {
  COMPLIANCE_ASSESSMENTS: 'compliance_assessments',
  REGULATORY_REPORTS: 'regulatory_reports',
  AUDIT_TRAILS: 'audit_trails',
  POLICIES: 'compliance_policies',
  TRAINING_RECORDS: 'training_records',
  COMPLIANCE_ALERTS: 'compliance_alerts'
};

export const COMPLIANCE_TTL = {
  ASSESSMENT_CACHE: 3600,       // 1 hour for assessments
  REPORTS_CACHE: 86400,         // 1 day for reports
  AUDIT_CACHE: 2592000,          // 1 month for audit trails
  POLICY_CACHE: 604800,          // 1 week for policies
  TRAINING_CACHE: 2592000,       // 1 month for training records
  ALERTS_CACHE: 604800           // 1 week for alerts
};

/**
 * Regulatory Frameworks and Requirements
 */
export const REGULATORY_FRAMEWORKS = {
  SEC_US: {
    name: 'SEC U.S. Regulations',
    jurisdiction: 'US',
    requirements: {
      REGISTRATION: {
        description: 'Investment Adviser Registration',
        rules: ['Section 203(a)', 'Form ADV'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      DISCLOSURE: {
        description: 'Client Disclosure Requirements',
        rules: ['Form ADV Part 2A/B', 'Brochure Updates'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      CUSTODY: {
        description: 'Custody Rule (Rule 206(4)-2)',
        rules: ['Annual Surprise Exam', 'Qualified Custodian'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      BOOKS_RECORDS: {
        description: 'Books and Records Rule',
        rules: ['Record Retention', 'Electronic Records'],
        frequency: 'CONTINUOUS',
        mandatory: true
      },
      COMPLIANCE_PROGRAM: {
        description: 'Compliance Program (Rule 206(4)-7)',
        rules: ['Written Policies', 'Annual Review', 'Chief Compliance Officer'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      PRIVACY: {
        description: 'Privacy Rule (Regulation S-P)',
        rules: ['Privacy Notice', 'Opt-Out', 'Safeguards'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      MARKETING: {
        description: 'Marketing and Advertising Rules',
        rules: ['Performance Advertising', 'Testimonials', 'Cherry-Picking'],
        frequency: 'CONTINUOUS',
        mandatory: true
      },
      CODE_OF_ETHICS: {
        description: 'Code of Ethics (Rule 204-1)',
        rules: ['Personal Trading', 'Access Persons', 'Reports'],
        frequency: 'QUARTERLY',
        mandatory: true
      }
    }
  },
  FINRA: {
    name: 'FINRA Rules',
    jurisdiction: 'US',
    requirements: {
      SUITABILITY: {
        description: 'Suitability Rule (Rule 2111)',
        rules: ['Customer Profile', 'Reasonable Basis', 'Quantitative Suitability'],
        frequency: 'PER_TRANSACTION',
        mandatory: true
      },
      MARGIN: {
        description: 'Margin Rules (Rule 4210)',
        rules: ['Initial Margin', 'Maintenance Margin', 'Concentration Limits'],
        frequency: 'DAILY',
        mandatory: true
      },
      SUPERVISION: {
        description: 'Supervision Rules (Rule 3110)',
        rules: ['Written Supervisory Procedures', 'Annual Review', 'Testing'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      ANTI_MONEY_LAUNDERING: {
        description: 'AML Program (Rule 3310)',
        rules: ['Customer Identification Program', 'Suspicious Activity Reports', 'Independent Testing'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      CONTINGENCY_PLANNING: {
        description: 'Business Continuity Plans (Rule 4370)',
        rules: ['BCP Plan', 'Emergency Contact', 'Annual Review'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      CYBERSECURITY: {
        description: 'Cybersecurity Controls',
        rules: ['Written Procedures', 'Incident Response', 'Vulnerability Testing'],
        frequency: 'ANNUAL',
        mandatory: true
      }
    }
  },
  MIFID_II: {
    name: 'MiFID II (EU)',
    jurisdiction: 'EU',
    requirements: {
      BEST_EXECUTION: {
        description: 'Best Execution (Article 64)',
        rules: ['Execution Factors', 'Regular Review', 'Disclosure'],
        frequency: 'ANNUAL',
        mandatory: true
      },
      REPORTING: {
        description: 'Transaction Reporting (Article 26)',
        rules: ['Trade Reporting', 'Timestamping', 'Record Keeping'],
        frequency: 'PER_TRANSACTION',
        mandatory: true
      },
      INVESTOR_PROTECTION: {
        description: 'Investor Protection (Chapter II)',
        rules: ['Suitability Assessment', 'Client Classification', 'Risk Warning'],
        frequency: 'PER_CLIENT',
        mandatory: true
      },
      PRODUCT_GOVERNANCE: {
        description: 'Product Governance (Article 16)',
        rules: ['Product Approval', 'Target Market Assessment', 'Review Process'],
        frequency: 'PER_PRODUCT',
        mandatory: true
      },
      ORDER_EXECUTION: {
        description: 'Order Execution (Article 24)',
        rules: ['Execution Policy', 'Client Consent', 'Transparency'],
        frequency: 'CONTINUOUS',
        mandatory: true
      },
      RESEARCH: {
        description: 'Research Rules (Chapter III)',
        rules: ['Research Disclosure', 'Cost Allocation', 'Independence'],
        frequency: 'ANNUAL',
        mandatory: true
      }
    }
  },
  GDPR: {
    name: 'GDPR (EU)',
    jurisdiction: 'EU',
    requirements: {
      DATA_PROTECTION: {
        description: 'Data Protection Principles',
        rules: ['Lawful Basis', 'Purpose Limitation', 'Data Minimization'],
        frequency: 'CONTINUOUS',
        mandatory: true
      },
      RIGHTS_MANAGEMENT: {
        description: 'Individual Rights Management',
        rules: ['Access Requests', 'Rectification', 'Erasure', 'Portability'],
        frequency: 'PER_REQUEST',
        mandatory: true
      },
      BREACH_NOTIFICATION: {
        description: 'Breach Notification (Article 33)',
        rules: ['72-Hour Notification', 'Risk Assessment', 'Documentation'],
        frequency: 'PER_BREACH',
        mandatory: true
      },
      DPIA: {
        description: 'Data Protection Impact Assessment',
        rules: ['High-Risk Processing', 'Consultation', 'Documentation'],
        frequency: 'PER_PROJECT',
        mandatory: true
      },
      DATA_PROCESSING_AGREEMENTS: {
        description: 'Data Processing Agreements',
        rules: ['Processor Contracts', 'Security Measures', 'Audits'],
        frequency: 'ANNUAL',
        mandatory: true
      }
    }
  }
};

/**
 * Compliance Status Types
 */
export const COMPLIANCE_STATUS = {
  COMPLIANT: { value: 1, label: 'Compliant', color: '#4CAF50' },
  PARTIALLY_COMPLIANT: { value: 2, label: 'Partially Compliant', color: '#FF9800' },
  NON_COMPLIANT: { value: 3, label: 'Non-Compliant', color: '#F44336' },
  NOT_APPLICABLE: { value: 0, label: 'Not Applicable', color: '#9E9E9E' }
};

/**
 * Regulatory Compliance Engine
 */
export class RegulatoryComplianceEngine {
  constructor(env) {
    this.env = env;
    this.activeFrameworks = new Set(['SEC_US', 'FINRA']);
    this.complianceCalendar = this.initializeComplianceCalendar();
    this.policies = this.initializePolicies();
  }

  /**
   * Perform comprehensive compliance assessment
   */
  async performComplianceAssessment(portfolioData, clientData = {}, frameworks = []) {
    try {
      const assessment = {
        id: this.generateAssessmentId(),
        assessmentDate: new Date().toISOString(),
        portfolioId: portfolioData.portfolioId,
        frameworks: frameworks.length > 0 ? frameworks : Array.from(this.activeFrameworks),
        overallStatus: COMPLIANCE_STATUS.COMPLIANT,
        frameworkResults: {},
        violations: [],
        recommendations: [],
        upcomingDeadlines: [],
        auditTrail: this.createAuditEntry('COMPLIANCE_ASSESSMENT', 'Assessment started')
      };

      // Check each framework
      for (const framework of assessment.frameworks) {
        const frameworkResult = await this.assessFramework(
          portfolioData, clientData, framework
        );
        assessment.frameworkResults[framework] = frameworkResult;

        if (frameworkResult.status.value > assessment.overallStatus.value) {
          assessment.overallStatus = frameworkResult.status;
        }

        assessment.violations.push(...(frameworkResult.violations || []));
        assessment.recommendations.push(...(frameworkResult.recommendations || []));
      }

      // Get upcoming deadlines
      assessment.upcomingDeadlines = this.getUpcomingDeadlines(assessment.frameworks);

      // Store assessment
      await this.persistComplianceAssessment(assessment);

      return assessment;
    } catch (error: unknown) {
      console.error('Compliance assessment failed:', error);
      throw new Error(`Compliance assessment failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Assess specific regulatory framework
   */
  async assessFramework(portfolioData, clientData, framework) {
    try {
      const frameworkConfig = REGULATORY_FRAMEWORKS[framework];
      if (!frameworkConfig) {
        throw new Error(`Unknown regulatory framework: ${framework}`);
      }

      const frameworkResult = {
        framework,
        frameworkName: frameworkConfig.name,
        jurisdiction: frameworkConfig.jurisdiction,
        assessmentDate: new Date().toISOString(),
        status: COMPLIANCE_STATUS.COMPLIANT,
        requirements: {},
        violations: [],
        recommendations: [],
        score: 100,
        lastReview: new Date().toISOString()
      };

      // Assess each requirement
      for (const [requirement, config] of Object.entries(frameworkConfig.requirements)) {
        const requirementResult = await this.assessRequirement(
          portfolioData, clientData, framework, requirement, config
        );
        frameworkResult.requirements[requirement] = requirementResult;

        if (requirementResult.status.value > COMPLIANCE_STATUS.COMPLIANT.value) {
          frameworkResult.status = this.getWorstStatus(
            frameworkResult.status, requirementResult.status
          );
          frameworkResult.violations.push({
            framework,
            requirement,
            rule: config.rules.join(', '),
            description: requirementResult.description,
            severity: requirementResult.status.label,
            dueDate: requirementResult.dueDate,
            recommendation: requirementResult.recommendation
          });
        }

        frameworkResult.recommendations.push(...(requirementResult.recommendations || []));
        frameworkResult.score -= (requirementResult.deduction || 0);
      }

      return frameworkResult;
    } catch (error: unknown) {
      console.error(`Framework assessment failed for ${framework}:`, error);
      return {
        framework,
        status: COMPLIANCE_STATUS.NON_COMPLIANT,
        error: error.message,
        violations: [{ framework, error: error.message, severity: 'HIGH' }],
        recommendations: []
      };
    }
  }

  /**
   * Assess specific requirement
   */
  async assessRequirement(portfolioData, clientData, framework, requirement, config) {
    try {
      const assessment = {
        requirement,
        requirementDescription: config.description,
        rules: config.rules,
        frequency: config.frequency,
        mandatory: config.mandatory,
        status: COMPLIANCE_STATUS.COMPLIANT,
        lastChecked: new Date().toISOString(),
        nextDue: this.calculateNextDueDate(config.frequency),
        evidence: [],
        description: '',
        deduction: 0,
        recommendation: '',
        recommendations: []
      };

      // Perform requirement-specific assessment
      switch (requirement) {
        case 'REGISTRATION':
          await this.assessRegistrationRequirement(portfolioData, assessment);
          break;
        case 'DISCLOSURE':
          await this.assessDisclosureRequirement(portfolioData, clientData, assessment);
          break;
        case 'SUITABILITY':
          await this.assessSuitabilityRequirement(portfolioData, clientData, assessment);
          break;
        case 'MARGIN':
          await this.assessMarginRequirement(portfolioData, assessment);
          break;
        case 'BEST_EXECUTION':
          await this.assessBestExecutionRequirement(portfolioData, assessment);
          break;
        case 'DATA_PROTECTION':
          await this.assessDataProtectionRequirement(clientData, assessment);
          break;
        case 'ANTI_MONEY_LAUNDERING':
          await this.assessAMLRequirement(portfolioData, clientData, assessment);
          break;
        default:
          await this.assessGenericRequirement(portfolioData, assessment);
      }

      return assessment;
    } catch (error: unknown) {
      console.error(`Requirement assessment failed for ${requirement}:`, error);
      return {
        requirement,
        status: COMPLIANCE_STATUS.NON_COMPLIANT,
        description: `Assessment failed: ${error.message}`,
        deduction: 25,
        recommendations: []
      };
    }
  }

  /**
   * Assess registration requirement
   */
  async assessRegistrationRequirement(portfolioData, assessment) {
    // Check if firm is registered with appropriate authorities
    const isRegistered = await this.checkRegistrationStatus(portfolioData);

    if (!isRegistered) {
      assessment.status = COMPLIANCE_STATUS.NON_COMPLIANT;
      assessment.description = 'Firm registration required with SEC';
      assessment.deduction = 30;
      assessment.recommendation = 'Submit Form ADV and complete registration process';
      assessment.evidence = ['Registration status check failed'];
    } else {
      assessment.description = 'Firm registration verified';
      assessment.evidence = ['SEC registration confirmed', 'Form ADV on file'];
    }
  }

  /**
   * Assess disclosure requirement
   */
  async assessDisclosureRequirement(portfolioData, clientData, assessment) {
    const disclosuresComplete = await this.checkDisclosureCompleteness(portfolioData, clientData);

    if (!disclosuresComplete) {
      assessment.status = COMPLIANCE_STATUS.PARTIALLY_COMPLIANT;
      assessment.description = 'Client disclosures incomplete or outdated';
      assessment.deduction = 15;
      assessment.recommendation = 'Update Form ADV Part 2A/B and client brochures';
      assessment.evidence = ['Missing disclosure items detected'];
    } else {
      assessment.description = 'Client disclosures complete and current';
      assessment.evidence = ['Form ADV Part 2A current', 'Client brochure updated'];
    }
  }

  /**
   * Assess suitability requirement
   */
  async assessSuitabilityRequirement(portfolioData, clientData, assessment) {
    const suitabilityCheck = await this.performSuitabilityCheck(portfolioData, clientData);

    if (!suitibilityCheck.suitable) {
      assessment.status = COMPLIANCE_STATUS.NON_COMPLIANT;
      assessment.description = suitabilityCheck.reason || 'Portfolio not suitable for client profile';
      assessment.deduction = 25;
      assessment.recommendation = 'Reassess client risk tolerance and adjust portfolio';
      assessment.evidence = [suitabilityCheck.evidence];
    } else {
      assessment.description = 'Portfolio suitable for client profile';
      assessment.evidence = ['Client profile current', 'Risk assessment completed'];
    }
  }

  /**
   * Assess margin requirement
   */
  async assessMarginRequirement(portfolioData, assessment) {
    const marginCheck = await this.checkMarginCompliance(portfolioData);

    if (!marginCheck.compliant) {
      assessment.status = COMPLIANCE_STATUS.NON_COMPLIANT;
      assessment.description = `Margin requirements not met: ${marginCheck.violation}`;
      assessment.deduction = 20;
      assessment.recommendation = 'Reduce margin usage or add additional collateral';
      assessment.evidence = [marginCheck.evidence];
    } else {
      assessment.description = 'Margin requirements within FINRA limits';
      assessment.evidence = ['Initial margin met', 'Maintenance margin satisfied'];
    }
  }

  /**
   * Assess best execution requirement
   */
  async assessBestExecutionRequirement(portfolioData, assessment) {
    const bestExecutionCheck = await this.checkBestExecution(portfolioData);

    if (!bestExecutionCheck.compliant) {
      assessment.status = COMPLIANCE_STATUS.PARTIALLY_COMPLIANT;
      assessment.description = 'Best execution processes need improvement';
      assessment.deduction = 10;
      assessment.recommendation = 'Review execution venues and update best execution policy';
      assessment.evidence = [bestExecutionCheck.evidence];
    } else {
      assessment.description = 'Best execution policy followed';
      assessment.evidence = ['Execution venues reviewed', 'Best execution policy current'];
    }
  }

  /**
   * Assess data protection requirement
   */
  async assessDataProtectionRequirement(clientData, assessment) {
    const dataProtectionCheck = await this.checkDataProtectionCompliance(clientData);

    if (!dataProtectionCheck.compliant) {
      assessment.status = COMPLIANCE_STATUS.NON_COMPLIANT;
      assessment.description = `GDPR compliance issues: ${dataProtectionCheck.issue}`;
      assessment.deduction = 25;
      assessment.recommendation = 'Update privacy policies and implement GDPR controls';
      assessment.evidence = [dataProtectionCheck.evidence];
    } else {
      assessment.description = 'Data protection requirements satisfied';
      assessment.evidence = ['Privacy notice current', 'Data processing agreements in place'];
    }
  }

  /**
   * Assess AML requirement
   */
  async assessAMLRequirement(portfolioData, clientData, assessment) {
    const amlCheck = await this.checkAMLCompliance(portfolioData, clientData);

    if (!amlCheck.compliant) {
      assessment.status = COMPLIANCE_STATUS.NON_COMPLIANT;
      assessment.description = `AML compliance issues: ${amlCheck.issue}`;
      assessment.deduction = 30;
      assessment.recommendation = 'Complete customer due diligence and update AML program';
      assessment.evidence = [amlCheck.evidence];
    } else {
      assessment.description = 'AML program compliant';
      assessment.evidence = ['CIP completed', 'Annual AML training current'];
    }
  }

  /**
   * Assess generic requirement
   */
  async assessGenericRequirement(portfolioData, assessment) {
    // Generic assessment for requirements without specific logic
    assessment.description = 'Requirement under review';
    assessment.evidence = ['Generic assessment completed'];
    assessment.status = COMPLIANCE_STATUS.PARTIALLY_COMPLIANT;
    assessment.deduction = 5;
    assessment.recommendation = 'Implement specific assessment logic for this requirement';
  }

  /**
   * Generate regulatory report
   */
  async generateRegulatoryReport(portfolioData, reportType, framework, period = {}) {
    try {
      const report = {
        id: this.generateReportId(),
        reportType,
        framework,
        reportDate: new Date().toISOString(),
        period: period || this.getDefaultReportPeriod(reportType),
        portfolioId: portfolioData.portfolioId,
        status: 'GENERATED',
        content: {},
        attachments: [],
        signed: false,
        submitted: false
      };

      // Generate report content based on type
      switch (reportType) {
        case 'FORM_ADV':
          report.content = await this.generateFormADV(portfolioData, framework);
          break;
        case 'COMPLIANCE_REPORT':
          report.content = await this.generateComplianceReport(portfolioData, framework);
          break;
        case 'AML_REPORT':
          report.content = await this.generateAMLReport(portfolioData, framework);
          break;
        case 'PRIVACY_NOTICE':
          report.content = await this.generatePrivacyNotice(portfolioData);
          break;
        case 'AUDIT_REPORT':
          report.content = await this.generateAuditReport(portfolioData, framework);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      // Store report
      await this.persistRegulatoryReport(report);

      return report;
    } catch (error: unknown) {
      console.error('Regulatory report generation failed:', error);
      throw new Error(`Report generation failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Create compliance policy
   */
  async createCompliancePolicy(policyData) {
    try {
      const policy = {
        id: this.generatePolicyId(),
        ...policyData,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: '1.0',
        status: 'ACTIVE',
        approvals: [],
        acknowledgments: []
      };

      // Validate policy
      await this.validateCompliancePolicy(policy);

      // Store policy
      await this.persistCompliancePolicy(policy);

      return policy;
    } catch (error: unknown) {
      console.error('Compliance policy creation failed:', error);
      throw new Error(`Policy creation failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Update compliance training records
   */
  async updateTrainingRecords(employeeId, trainingData) {
    try {
      const records = {
        employeeId,
        trainingId: this.generateTrainingId(),
        ...trainingData,
        completionDate: new Date().toISOString(),
        certificate: trainingData.certificate || null,
        nextDue: this.calculateNextTrainingDate(trainingData.type)
      };

      // Store training record
      await this.persistTrainingRecord(records);

      return records;
    } catch (error: unknown) {
      console.error('Training record update failed:', error);
      throw new Error(`Training update failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  // Helper methods

  generateAssessmentId() {
    return `compliance_assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReportId() {
    return `regulatory_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generatePolicyId() {
    return `compliance_policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTrainingId() {
    return `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeComplianceCalendar() {
    const calendar = {};
    const currentYear = new Date().getFullYear();

    // Add recurring compliance deadlines
    calendar[`SEC_ADV_UPDATE_${currentYear}`] = {
      name: 'Form ADV Annual Update',
      date: new Date(currentYear, 2, 1), // March 1st
      framework: 'SEC_US',
      requirement: 'DISCLOSURE',
      priority: 'HIGH'
    };

    calendar[`FINRA_ANNUAL_REVIEW_${currentYear}`] = {
      name: 'FINRA Annual Review',
      date: new Date(currentYear, 11, 31), // December 31st
      framework: 'FINRA',
      requirement: 'SUPERVISION',
      priority: 'HIGH'
    };

    return calendar;
  }

  initializePolicies() {
    return {
      codeOfEthics: {
        id: 'policy_ethics_001',
        name: 'Code of Ethics',
        version: '2.1',
        lastUpdated: '2024-01-15',
        status: 'ACTIVE',
        applicableFrameworks: ['SEC_US', 'FINRA']
      },
      privacyPolicy: {
        id: 'policy_privacy_001',
        name: 'Privacy Policy',
        version: '1.5',
        lastUpdated: '2024-02-01',
        status: 'ACTIVE',
        applicableFrameworks: ['GDPR', 'SEC_US']
      },
      bestExecution: {
        id: 'policy_execution_001',
        name: 'Best Execution Policy',
        version: '1.3',
        lastUpdated: '2024-01-20',
        status: 'ACTIVE',
        applicableFrameworks: ['MIFID_II', 'FINRA']
      }
    };
  }

  createAuditEntry(action, description) {
    return {
      timestamp: new Date().toISOString(),
      action,
      description,
      userId: 'system', // Would be actual user in production
      ipAddress: '0.0.0.0' // Would be actual IP in production
    };
  }

  getWorstStatus(status1, status2) {
    return status1.value > status2.value ? status1 : status2;
  }

  calculateNextDueDate(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'DAILY':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'WEEKLY':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'MONTHLY':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'QUARTERLY':
        return new Date(now.getFullYear(), now.getMonth() + 3, 1);
      case 'ANNUAL':
        return new Date(now.getFullYear() + 1, now.getMonth(), 1);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  calculateNextTrainingDate(trainingType) {
    const now = new Date();
    switch (trainingType) {
      case 'AML':
        return new Date(now.getFullYear() + 1, now.getMonth(), 1);
      case 'SECURITY':
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      case 'COMPLIANCE':
        return new Date(now.getFullYear() + 1, now.getMonth(), 1);
      default:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
  }

  getDefaultReportPeriod(reportType) {
    const now = new Date();
    switch (reportType) {
      case 'FORM_ADV':
        return {
          startDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
          endDate: now
        };
      case 'QUARTERLY_REPORT':
        return {
          startDate: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
          endDate: now
        };
      default:
        return {
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: now
        };
    }
  }

  getUpcomingDeadlines(frameworks) {
    const now = new Date();
    const upcoming = [];

    Object.entries(this.complianceCalendar).forEach(([key, deadline]) => {
      if (frameworks.includes(deadline.framework) && deadline.date > now) {
        upcoming.push(deadline);
      }
    });

    return upcoming.sort((a: any, b: any) => a.date - b.date).slice(0, 10); // Next 10 deadlines
  }

  // Simplified assessment methods - would implement actual logic in production
  async checkRegistrationStatus(portfolioData) { return true; }
  async checkDisclosureCompleteness(portfolioData, clientData) { return true; }
  async performSuitabilityCheck(portfolioData, clientData) { return { suitable: true }; }
  async checkMarginCompliance(portfolioData) { return { compliant: true }; }
  async checkBestExecution(portfolioData) { return { compliant: true }; }
  async checkDataProtectionCompliance(clientData) { return { compliant: true }; }
  async checkAMLCompliance(portfolioData, clientData) { return { compliant: true }; }

  // Report generation methods
  async generateFormADV(portfolioData, framework) {
    return {
      type: 'FORM_ADV',
      content: {
        part1: {
          firmInfo: 'Mock firm information',
          assetsUnderManagement: portfolioData.totalValue || 1000000,
          clients: 150
        },
        part2A: {
          strategies: 'Mock investment strategies',
          risks: 'Mock risk disclosures',
          fees: 'Mock fee schedule'
        }
      }
    };
  }

  async generateComplianceReport(portfolioData, framework) {
    return {
      type: 'COMPLIANCE_REPORT',
      content: {
        executiveSummary: 'Compliance overview',
        frameworkStatus: 'Compliant',
        violations: [],
        correctiveActions: []
      }
    };
  }

  async generateAMLReport(portfolioData, framework) {
    return {
      type: 'AML_REPORT',
      content: {
        programOverview: 'AML program summary',
        riskAssessment: 'Risk assessment results',
        trainingRecords: 'Training completion status',
        suspiciousActivity: 'No suspicious activity reported'
      }
    };
  }

  async generatePrivacyNotice(portfolioData) {
    return {
      type: 'PRIVACY_NOTICE',
      content: {
        dataCollection: 'Types of data collected',
        usage: 'How data is used',
        sharing: 'Data sharing practices',
        rights: 'Individual rights under GDPR'
      }
    };
  }

  async generateAuditReport(portfolioData, framework) {
    return {
      type: 'AUDIT_REPORT',
      content: {
        scope: 'Audit scope and methodology',
        findings: 'Key findings',
        recommendations: 'Improvement recommendations',
        conclusion: 'Overall compliance status'
      }
    };
  }

  async validateCompliancePolicy(policy) {
    // Validate required fields
    if (!policy.name || !policy.description || !policy.approver) {
      throw new Error('Missing required policy fields');
    }
  }

  // Persistence methods
  async persistComplianceAssessment(assessment) {
    const key = `${COMPLIANCE_NAMESPACES.COMPLIANCE_ASSESSMENTS}:${assessment.id}`;
    await setKVStore(this.env, key, assessment, COMPLIANCE_TTL.ASSESSMENT_CACHE);
  }

  async persistRegulatoryReport(report) {
    const key = `${COMPLIANCE_NAMESPACES.REGULATORY_REPORTS}:${report.id}`;
    await setKVStore(this.env, key, report, COMPLIANCE_TTL.REPORTS_CACHE);
  }

  async persistCompliancePolicy(policy) {
    const key = `${COMPLIANCE_NAMESPACES.POLICIES}:${policy.id}`;
    await setKVStore(this.env, key, policy, COMPLIANCE_TTL.POLICY_CACHE);
  }

  async persistTrainingRecord(record) {
    const key = `${COMPLIANCE_NAMESPACES.TRAINING_RECORDS}:${record.employeeId}_${record.trainingId}`;
    await setKVStore(this.env, key, record, COMPLIANCE_TTL.TRAINING_CACHE);
  }
}

/**
 * Factory function for creating compliance engine instances
 */
export function createRegulatoryComplianceEngine(env: any) {
  return new RegulatoryComplianceEngine(env);
}

/**
 * Utility functions for regulatory compliance
 */
export async function assessCompliance(env, portfolioData, clientData, frameworks) {
  const engine = createRegulatoryComplianceEngine(env);
  return await engine.performComplianceAssessment(portfolioData, clientData, frameworks);
}

export async function generateReport(env, portfolioData, reportType, framework, period) {
  const engine = createRegulatoryComplianceEngine(env);
  return await engine.generateRegulatoryReport(portfolioData, reportType, framework, period);
}

export async function createPolicy(env: any, policyData: any) {
  const engine = createRegulatoryComplianceEngine(env);
  return await engine.createCompliancePolicy(policyData);
}