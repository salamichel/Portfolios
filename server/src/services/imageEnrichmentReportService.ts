import { randomUUID } from 'crypto';
import { enrichmentReportDb, ImageEnrichmentReport, ApiCallDetail, ProcessingStatus } from '../database.js';

/**
 * Service to track image batch enrichment reports for AI analysis
 */
export class ImageEnrichmentReportTracker {
  private reportId: string;
  private startTime: number;
  private apiCalls: ApiCallDetail[] = [];
  private imagesEnriched: number = 0;
  private imagesFailed: number = 0;

  constructor(imageCount: number) {
    this.reportId = randomUUID();
    this.startTime = Date.now();

    // Create initial report
    enrichmentReportDb.create({
      id: this.reportId,
      status: 'processing',
      started_at: new Date().toISOString(),
      completed_at: null,
      image_count: imageCount,
      total_api_calls: 0,
      successful_api_calls: 0,
      failed_api_calls: 0,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      execution_time_ms: null,
      error_message: null,
      api_calls_detail: null,
      images_enriched: 0,
      images_failed: 0
    });
  }

  /**
   * Track a successful API call
   */
  trackApiCall(tokens: { prompt: number; completion: number; total: number }, durationMs: number, imagesInBatch: number): void {
    const apiCall: ApiCallDetail = {
      timestamp: new Date().toISOString(),
      success: true,
      tokens,
      duration_ms: durationMs
    };

    this.apiCalls.push(apiCall);
    this.imagesEnriched += imagesInBatch;
  }

  /**
   * Track a failed API call
   */
  trackApiError(error: string, durationMs: number, imagesInBatch: number): void {
    const apiCall: ApiCallDetail = {
      timestamp: new Date().toISOString(),
      success: false,
      duration_ms: durationMs,
      error
    };

    this.apiCalls.push(apiCall);
    this.imagesFailed += imagesInBatch;
  }

  /**
   * Track individual image failures (not API failures, but enrichment failures)
   */
  trackImageFailure(): void {
    this.imagesFailed++;
    if (this.imagesEnriched > 0) {
      this.imagesEnriched--;
    }
  }

  /**
   * Complete the report successfully
   */
  complete(): void {
    const executionTime = Date.now() - this.startTime;
    const successfulCalls = this.apiCalls.filter(c => c.success).length;
    const failedCalls = this.apiCalls.filter(c => !c.success).length;

    // Calculate token totals
    const totalPromptTokens = this.apiCalls
      .filter(c => c.success && c.tokens)
      .reduce((sum, c) => sum + (c.tokens?.prompt || 0), 0);

    const totalCompletionTokens = this.apiCalls
      .filter(c => c.success && c.tokens)
      .reduce((sum, c) => sum + (c.tokens?.completion || 0), 0);

    enrichmentReportDb.update(this.reportId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      total_api_calls: this.apiCalls.length,
      successful_api_calls: successfulCalls,
      failed_api_calls: failedCalls,
      total_tokens: totalPromptTokens + totalCompletionTokens,
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      api_calls_detail: this.apiCalls,
      images_enriched: this.imagesEnriched,
      images_failed: this.imagesFailed
    });
  }

  /**
   * Mark the report as failed
   */
  fail(errorMessage: string): void {
    const executionTime = Date.now() - this.startTime;
    const successfulCalls = this.apiCalls.filter(c => c.success).length;
    const failedCalls = this.apiCalls.filter(c => !c.success).length;

    // Calculate token totals even for failed processing
    const totalPromptTokens = this.apiCalls
      .filter(c => c.success && c.tokens)
      .reduce((sum, c) => sum + (c.tokens?.prompt || 0), 0);

    const totalCompletionTokens = this.apiCalls
      .filter(c => c.success && c.tokens)
      .reduce((sum, c) => sum + (c.tokens?.completion || 0), 0);

    enrichmentReportDb.update(this.reportId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      total_api_calls: this.apiCalls.length,
      successful_api_calls: successfulCalls,
      failed_api_calls: failedCalls,
      total_tokens: totalPromptTokens + totalCompletionTokens,
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      error_message: errorMessage,
      api_calls_detail: this.apiCalls,
      images_enriched: this.imagesEnriched,
      images_failed: this.imagesFailed
    });
  }

  /**
   * Get the report ID
   */
  getReportId(): string {
    return this.reportId;
  }

  /**
   * Get the current report
   */
  getReport(): ImageEnrichmentReport | undefined {
    return enrichmentReportDb.getById(this.reportId);
  }
}
