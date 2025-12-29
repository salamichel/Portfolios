import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle, RefreshCw, TrendingUp, Activity } from 'lucide-react';

interface ApiCallDetail {
  timestamp: string;
  success: boolean;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration_ms: number;
  error?: string;
  retry_attempt?: number;
}

interface ProcessingReport {
  id: string;
  book_id: string;
  status: 'processing' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  image_count: number;
  total_api_calls: number;
  successful_api_calls: number;
  failed_api_calls: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  execution_time_ms: number | null;
  error_message: string | null;
  api_calls_detail: ApiCallDetail[] | null;
  cache_hit: boolean;
  created_at: string;
  updated_at: string;
}

interface ProcessingReportModalProps {
  bookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProcessingReportModal({ bookId, isOpen, onClose }: ProcessingReportModalProps) {
  const [reports, setReports] = useState<ProcessingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ProcessingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bookId) {
      loadReports();
    }
  }, [isOpen, bookId]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/books/${bookId}/reports`);
      if (!response.ok) {
        throw new Error('Failed to load reports');
      }
      const data = await response.json();
      setReports(data);
      if (data.length > 0) {
        setSelectedReport(data[0]); // Select latest report by default
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Rapports de traitement IA</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Reports List */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-4 space-y-2">
              {loading && (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Chargement...
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-800 p-4 rounded-lg">
                  {error}
                </div>
              )}

              {!loading && !error && reports.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Aucun rapport disponible
                </div>
              )}

              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedReport?.id === report.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                      {report.status === 'success' ? 'Succès' : report.status === 'failed' ? 'Échec' : 'En cours'}
                    </span>
                    {report.cache_hit && (
                      <span className="text-xs text-purple-600 font-medium">Cache</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(report.started_at)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {report.image_count} images • {formatDuration(report.execution_time_ms)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content - Report Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedReport ? (
              <div className="space-y-6">
                {/* Status Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(selectedReport.status)}
                    <h3 className="text-xl font-semibold">
                      {selectedReport.cache_hit ? 'Résultat depuis le cache' : 'Traitement IA'}
                    </h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedReport.status)}`}>
                    {selectedReport.status === 'success' ? 'Succès' : selectedReport.status === 'failed' ? 'Échec' : 'En cours'}
                  </span>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Images</div>
                    <div className="text-2xl font-bold text-gray-900">{selectedReport.image_count}</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 mb-1">Appels API</div>
                    <div className="text-2xl font-bold text-blue-900">{selectedReport.total_api_calls}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 mb-1">Tokens</div>
                    <div className="text-2xl font-bold text-green-900">{selectedReport.total_tokens.toLocaleString()}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 mb-1">Durée</div>
                    <div className="text-2xl font-bold text-purple-900">{formatDuration(selectedReport.execution_time_ms)}</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Début:</span>
                      <span className="font-medium">{formatDate(selectedReport.started_at)}</span>
                    </div>
                    {selectedReport.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fin:</span>
                        <span className="font-medium">{formatDate(selectedReport.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* API Calls Stats */}
                {!selectedReport.cache_hit && selectedReport.total_api_calls > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Statistiques API
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Succès:</span>
                        <span className="font-medium text-green-600">{selectedReport.successful_api_calls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Échecs:</span>
                        <span className="font-medium text-red-600">{selectedReport.failed_api_calls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tokens prompt:</span>
                        <span className="font-medium">{selectedReport.prompt_tokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tokens réponse:</span>
                        <span className="font-medium">{selectedReport.completion_tokens.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {selectedReport.error_message && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">Erreur</h4>
                    <p className="text-sm text-red-700">{selectedReport.error_message}</p>
                  </div>
                )}

                {/* API Calls Detail */}
                {selectedReport.api_calls_detail && selectedReport.api_calls_detail.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">Détails des appels API</h4>
                    <div className="space-y-2">
                      {selectedReport.api_calls_detail.map((call, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded border-l-4 ${
                            call.success
                              ? 'bg-white border-green-500'
                              : 'bg-red-50 border-red-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              Appel #{index + 1}
                              {call.retry_attempt && ` (Tentative ${call.retry_attempt})`}
                            </span>
                            <span className={`text-xs font-medium ${call.success ? 'text-green-600' : 'text-red-600'}`}>
                              {call.success ? 'Succès' : 'Échec'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>Durée: {formatDuration(call.duration_ms)}</div>
                            {call.tokens && (
                              <div>Tokens: {call.tokens.total.toLocaleString()}</div>
                            )}
                          </div>
                          {call.error && (
                            <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                              {call.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Sélectionnez un rapport pour voir les détails
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
