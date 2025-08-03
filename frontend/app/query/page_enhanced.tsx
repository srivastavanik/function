'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { queryNaturalLanguage, getFunnelMetrics, type QueryResponse, type Session, type FunnelMetricsResponse } from '@/lib/api_enhanced';

export default function EnhancedQueryPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QueryResponse | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFunnelAnalytics, setShowFunnelAnalytics] = useState(false);

  const sampleQueries = [
    "Show me sessions with high friction in the last week",
    "What are the most common rage click patterns?",
    "Find sessions where users abandoned the checkout flow",
    "Which pages have the highest bounce rates?",
    "Show me sessions with form validation errors",
    "What's the average completion rate for our signup funnel?"
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await queryNaturalLanguage(query, true);
      setResults(response);
      
      // Load funnel metrics if query mentions funnels or conversion
      if (query.toLowerCase().includes('funnel') || query.toLowerCase().includes('conversion')) {
        const metrics = await getFunnelMetrics();
        setFunnelMetrics(metrics);
        setShowFunnelAnalytics(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getInsightIcon = (insight: string) => {
    if (insight.toLowerCase().includes('high') || insight.toLowerCase().includes('issue')) {
      return '⚠️';
    } else if (insight.toLowerCase().includes('improve')) {
      return '💡';
    } else if (insight.toLowerCase().includes('good') || insight.toLowerCase().includes('well')) {
      return '✅';
    }
    return '📊';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900">Insights & Analytics</h1>
            </div>
            <Link
              href="/sessions"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              View All Sessions
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-2">Ask Anything About Your Users</h2>
            <p className="text-gray-600">
              Use natural language to query across all your sessions and get AI-powered insights
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Show me sessions with rage clicks in the checkout flow"
                className="w-full px-6 py-4 pr-12 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Sample Queries */}
          <div className="mt-6">
            <p className="text-sm text-gray-500 text-center mb-3">Try these examples:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {sampleQueries.map((sampleQuery, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSampleQuery(sampleQuery)}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition"
                >
                  {sampleQuery}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className="space-y-8">
            {/* AI Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Analysis
              </h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {results.summary}
              </p>
            </div>

            {/* Analytics Overview */}
            {results.analytics && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Analytics Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.analytics.sessionCount}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Matching Sessions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.analytics.totalFrictionPoints}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Total Friction Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.analytics.averageFrictionPerSession.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Avg per Session</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.analytics.averageFunnelCompletion?.toFixed(0) || 0}%
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Funnel Completion</div>
                  </div>
                </div>

                {/* Friction Type Distribution */}
                {results.analytics.frictionTypeDistribution && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium mb-3">Friction Type Distribution</h4>
                    <div className="space-y-2">
                      {Object.entries(results.analytics.frictionTypeDistribution)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 capitalize">
                              {type.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600"
                                  style={{ 
                                    width: `${(count / (results.analytics?.totalFrictionPoints || 1)) * 100}%` 
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900 w-10 text-right">
                                {count}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Funnel Analytics */}
            {showFunnelAnalytics && funnelMetrics && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Funnel Analytics</h3>
                <div className="space-y-4">
                  {Object.entries(funnelMetrics.funnelStages).map(([stage, data]) => (
                    <div key={stage} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{stage.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-gray-500">
                          {data.completed} of {data.total} sessions
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${data.conversionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">
                          {data.conversionRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drop-off Analysis */}
                {funnelMetrics.dropoffAnalysis.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium mb-3">Drop-off Points</h4>
                    <div className="space-y-2">
                      {funnelMetrics.dropoffAnalysis
                        .sort((a, b) => b.dropoffRate - a.dropoffRate)
                        .slice(0, 3)
                        .map((dropoff, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              {dropoff.from.replace(/_/g, ' ')} → {dropoff.to.replace(/_/g, ' ')}
                            </span>
                            <span className={`font-medium ${
                              dropoff.dropoffRate > 50 ? 'text-red-600' : 
                              dropoff.dropoffRate > 30 ? 'text-yellow-600' : 
                              'text-gray-600'
                            }`}>
                              -{dropoff.dropoffRate}% ({dropoff.lost} users)
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Insights */}
            {results.insights && results.insights.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                <div className="space-y-3">
                  {results.insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-xl">{getInsightIcon(insight)}</span>
                      <p className="text-gray-700">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {results.recommendations && results.recommendations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {results.recommendations.map((recommendation, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="text-green-600 mt-1">•</span>
                      <p className="text-gray-700">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Sessions */}
            {results.results.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Matching Sessions ({results.totalMatches})
                  </h3>
                  <Link
                    href="/sessions"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All →
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {results.results.slice(0, 5).map((session) => {
                    const frictionCount = session.frictionPoints?.length || 0;
                    const highSeverityCount = session.frictionPoints?.filter(
                      fp => fp.severity === 'high'
                    ).length || 0;
                    
                    return (
                      <div
                        key={session.sessionId}
                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
                        onClick={() => router.push(`/session/${session.sessionId}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{session.filename}</h4>
                            <p className="text-sm text-gray-500">{formatTime(session.uploadTime)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${
                              highSeverityCount > 0 ? 'text-red-600' : 
                              frictionCount > 0 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {frictionCount} friction points
                            </p>
                            {highSeverityCount > 0 && (
                              <p className="text-xs text-red-600">{highSeverityCount} high severity</p>
                            )}
                          </div>
                        </div>
                        {session.behaviorSummary && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {session.behaviorSummary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!results && !loading && !error && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Ask a Question</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Use the search bar above to query your session data and get instant insights powered by AI
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
