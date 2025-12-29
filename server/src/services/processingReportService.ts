import { randomUUID } from 'crypto';
import { processingReportDb, BookProcessingReport, ApiCallDetail, ProcessingStatus } from '../database';

/**
 * Service to track book processing reports for AI layout generation
 */
export class ProcessingReportTracker {
  private reportId: string;
  private bookId: string;
  private startTime: number;
  private apiCalls: ApiCallDetail[] = [];

  constructor(bookId: string, imageCount: number) {
    this.reportId = randomUUID();
    this.bookId = bookId;
    this.startTime = Date.now();

    // Create initial report
    processingReportDb.create({
      id: this.reportId,
      book_id: bookId,
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
      cache_hit: false
    });
  }

  /**
   * Track a successful API call
   */
  trackApiCall(tokens: { prompt: number; completion: number; total: number }, durationMs: number, retryAttempt?: number): void {
    const apiCall: ApiCallDetail = {
      timestamp: new Date().toISOString(),
      success: true,
      tokens,
      duration_ms: durationMs,
      retry_attempt: retryAttempt
    };

    this.apiCalls.push(apiCall);
  }

  /**
   * Track a failed API call
   */
  trackApiError(error: string, durationMs: number, retryAttempt?: number): void {
    const apiCall: ApiCallDetail = {
      timestamp: new Date().toISOString(),
      success: false,
      duration_ms: durationMs,
      error,
      retry_attempt: retryAttempt
    };

    this.apiCalls.push(apiCall);
  }

  /**
   * Mark the processing as using cache (no API call made)
   */
  markCacheHit(): void {
    const executionTime = Date.now() - this.startTime;

    processingReportDb.update(this.reportId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      cache_hit: true,
      api_calls_detail: []
    });
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

    processingReportDb.update(this.reportId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      total_api_calls: this.apiCalls.length,
      successful_api_calls: successfulCalls,
      failed_api_calls: failedCalls,
      total_tokens: totalPromptTokens + totalCompletionTokens,
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      api_calls_detail: this.apiCalls
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

    processingReportDb.update(this.reportId, {
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
      api_calls_detail: this.apiCalls
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
  getReport(): BookProcessingReport | undefined {
    return processingReportDb.getById(this.reportId);
  }
}
