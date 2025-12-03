/**
 * Exemption Management Routes - Admin endpoints for managing production exemptions
 * Protected endpoints for tracking and managing production exemptions
 */
import { ExemptionManager } from '../modules/exemption-manager.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';
/**
 * Handle exemption report request
 */
export async function handleExemptionReport(request, env) {
    try {
        const exemptionManager = new ExemptionManager(env);
        const report = await exemptionManager.getExemptionReport();
        return ApiResponseFactory.success({
            service: 'exemption-management',
            timestamp: new Date().toISOString(),
            data: report
        });
    }
    catch (error) {
        console.error('Exemption report request failed:', error);
        return ApiResponseFactory.error('Failed to retrieve exemption report', 'EXEMPTION_REPORT_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Handle exemption validation request
 */
export async function handleExemptionValidation(request, env) {
    try {
        const body = await request.json();
        const exemptionManager = new ExemptionManager(env);
        // Default to source files if none provided
        const sourceFiles = body.files || [
            'src/**/*.ts',
            'src/**/*.js',
            'public/**/*.html',
            'public/**/*.js'
        ];
        const validationResult = await exemptionManager.parseExemptions(sourceFiles);
        return ApiResponseFactory.success({
            service: 'exemption-management',
            timestamp: new Date().toISOString(),
            data: {
                valid: validationResult.valid,
                totalExemptions: validationResult.exemptions.length,
                violations: validationResult.violations,
                exemptions: validationResult.exemptions.map(e => ({
                    id: e.id,
                    pattern: e.pattern,
                    file: e.file,
                    line: e.line,
                    jiraReference: e.jiraReference,
                    owner: e.owner,
                    expirationDate: e.expirationDate,
                    status: e.status
                }))
            }
        });
    }
    catch (error) {
        console.error('Exemption validation request failed:', error);
        return ApiResponseFactory.error('Failed to validate exemptions', 'EXEMPTION_VALIDATION_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Handle exemption creation request
 */
export async function handleExemptionCreate(request, env) {
    try {
        const body = await request.json();
        const { pattern, file, line, jiraReference, owner, reason, expirationDate, autoRenew } = body;
        // Validate required fields
        if (!pattern || !file || !line || !jiraReference || !owner) {
            return ApiResponseFactory.error('Missing required fields', 'MISSING_FIELDS', {
                required: ['pattern', 'file', 'line', 'jiraReference', 'owner']
            });
        }
        // Validate JIRA reference format
        if (!/^[A-Z]+-\d+$/.test(jiraReference)) {
            return ApiResponseFactory.error('Invalid JIRA reference format', 'INVALID_JIRA_FORMAT', {
                expected: 'PROJECT-123'
            });
        }
        const exemptionManager = new ExemptionManager(env);
        const exemption = await exemptionManager.createExemption({
            pattern,
            file,
            line,
            jiraReference,
            owner,
            reason: reason || 'No reason provided',
            expirationDate: expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            autoRenew: autoRenew || false,
            status: 'active'
        });
        return ApiResponseFactory.success({
            service: 'exemption-management',
            message: 'Exemption created successfully',
            timestamp: new Date().toISOString(),
            data: exemption
        });
    }
    catch (error) {
        console.error('Exemption creation request failed:', error);
        return ApiResponseFactory.error('Failed to create exemption', 'EXEMPTION_CREATION_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Handle exemption revocation request
 */
export async function handleExemptionRevoke(request, env) {
    try {
        const url = new URL(request.url);
        const exemptionId = url.searchParams.get('id');
        if (!exemptionId) {
            return ApiResponseFactory.error('Exemption ID is required', 'MISSING_EXEMPTION_ID');
        }
        const exemptionManager = new ExemptionManager(env);
        await exemptionManager.revokeExemption(exemptionId);
        return ApiResponseFactory.success({
            service: 'exemption-management',
            message: `Exemption ${exemptionId} revoked successfully`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Exemption revocation request failed:', error);
        return ApiResponseFactory.error('Failed to revoke exemption', 'EXEMPTION_REVOCATION_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Handle exemption maintenance tasks
 */
export async function handleExemptionMaintenance(request, env) {
    try {
        const body = await request.json();
        const task = body.task || 'all';
        const exemptionManager = new ExemptionManager(env);
        const results = {};
        if (task === 'auto-renew' || task === 'all') {
            await exemptionManager.autoRenewExemptions();
            results.autoRenew = 'completed';
        }
        if (task === 'cleanup' || task === 'all') {
            await exemptionManager.cleanupExpiredExemptions();
            results.cleanup = 'completed';
        }
        return ApiResponseFactory.success({
            service: 'exemption-management',
            message: 'Exemption maintenance tasks completed',
            timestamp: new Date().toISOString(),
            data: {
                task,
                results,
                report: await exemptionManager.getExemptionReport()
            }
        });
    }
    catch (error) {
        console.error('Exemption maintenance request failed:', error);
        return ApiResponseFactory.error('Failed to perform exemption maintenance', 'EXEMPTION_MAINTENANCE_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Generate weekly exemption report
 */
export async function handleWeeklyReport(request, env) {
    try {
        const exemptionManager = new ExemptionManager(env);
        const report = await exemptionManager.getExemptionReport();
        // Generate formatted weekly report
        const weeklyReport = {
            summary: {
                totalActive: report.totalActive,
                totalExpired: report.totalExpired,
                upcomingExpirations: report.upcomingExpirations.length,
                generatedAt: report.generatedAt
            },
            upcomingExpirations: report.upcomingExpirations.map(e => ({
                jiraReference: e.jiraReference,
                file: e.file,
                line: e.line,
                owner: e.owner,
                expirationDate: e.expirationDate,
                daysUntilExpiration: Math.ceil((new Date(e.expirationDate).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
            })),
            byOwner: Object.entries(report.byOwner)
                .map(([owner, count]) => ({ owner, count }))
                .sort((a, b) => b.count - a.count),
            byPattern: Object.entries(report.byPattern)
                .map(([pattern, count]) => ({ pattern, count }))
                .sort((a, b) => b.count - a.count),
            recommendations: generateRecommendations(report)
        };
        return ApiResponseFactory.success({
            service: 'exemption-management',
            message: 'Weekly exemption report generated',
            timestamp: new Date().toISOString(),
            data: weeklyReport
        });
    }
    catch (error) {
        console.error('Weekly report generation failed:', error);
        return ApiResponseFactory.error('Failed to generate weekly report', 'WEEKLY_REPORT_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
/**
 * Generate recommendations based on exemption report
 */
function generateRecommendations(report) {
    const recommendations = [];
    if (report.totalActive > 10) {
        recommendations.push('High number of active exemptions - consider implementing permanent solutions');
    }
    if (report.upcomingExpirations.length > 5) {
        recommendations.push('Multiple exemptions expiring soon - review and plan renewals or implementations');
    }
    const ownersWithManyExemptions = Object.entries(report.byOwner)
        .filter(([_, count]) => count > 3)
        .map(([owner, _]) => owner);
    if (ownersWithManyExemptions.length > 0) {
        recommendations.push(`Consider reviewing exemptions for owners: ${ownersWithManyExemptions.join(', ')}`);
    }
    const patternsWithHighUsage = Object.entries(report.byPattern)
        .filter(([_, count]) => count > 5)
        .map(([pattern, _]) => pattern);
    if (patternsWithHighUsage.length > 0) {
        recommendations.push(`High usage patterns detected: ${patternsWithHighUsage.join(', ')} - consider permanent alternatives`);
    }
    if (recommendations.length === 0) {
        recommendations.push('Exemption usage looks healthy - continue monitoring');
    }
    return recommendations;
}
/**
 * Exemption Management Route Handler
 */
export async function handleExemptionManagementRequest(request, env) {
    try {
        const url = new URL(request.url);
        const path = url.pathname;
        // Route to specific handlers
        if (path === '/api/v1/exemptions/report') {
            return await handleExemptionReport(request, env);
        }
        else if (path === '/api/v1/exemptions/validate') {
            return await handleExemptionValidation(request, env);
        }
        else if (path === '/api/v1/exemptions/create') {
            return await handleExemptionCreate(request, env);
        }
        else if (path === '/api/v1/exemptions/revoke') {
            return await handleExemptionRevoke(request, env);
        }
        else if (path === '/api/v1/exemptions/maintenance') {
            return await handleExemptionMaintenance(request, env);
        }
        else if (path === '/api/v1/exemptions/weekly-report') {
            return await handleWeeklyReport(request, env);
        }
        else {
            return ApiResponseFactory.error('Exemption management endpoint not found', 'ENDPOINT_NOT_FOUND', {
                available_endpoints: [
                    'GET /api/v1/exemptions/report',
                    'POST /api/v1/exemptions/validate',
                    'POST /api/v1/exemptions/create',
                    'DELETE /api/v1/exemptions/revoke',
                    'POST /api/v1/exemptions/maintenance',
                    'GET /api/v1/exemptions/weekly-report'
                ]
            });
        }
    }
    catch (error) {
        console.error('Exemption management request failed:', error);
        return ApiResponseFactory.error('Exemption management request failed', 'EXEMPTION_MANAGEMENT_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
//# sourceMappingURL=exemption-management-routes.js.map