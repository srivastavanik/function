'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { queryNaturalLanguage, getStatusColor, formatFileSize, QueryResponse } from '@/lib/api';
import { format } from 'date-fns';

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QueryResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await queryNaturalLanguage(query);
      setResults(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-bg text-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/sessions" className="inline-flex items-center text-white/80 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sessions
          </Link>
          <h1 className="text-3xl font-bold mb-2">Natural Language Query</h1>
          <p className="opacity-90">Ask questions about your sessions in plain English</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Show me sessions where users rage-clicked or seemed frustrated..."
              className="w-full px-6 py-4 pr-32 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={`absolute right-2 top-2 px-6 py-2 rounded-lg font-medium text-white transition-all flex items-center
                ${loading || !query.trim()
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'gradient-bg hover:opacity-90'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </button>
          </div>
          
          {/* Example Queries */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Try:</span>
            {[
              'Sessions with high friction points',
              'Users who seemed confused',
              'Videos longer than 30 seconds',
              'Recent uploads with errors'
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Summary */}
            <div className="bg-white rounded-lg card-shadow p-6">
              <div className="flex items-center mb-4">
                <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                <h2 className="text-xl font-semibold">AI Summary</h2>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{results.summary}</p>
              
              {results.filterExplanation && (
                <p className="mt-4 text-sm text-gray-500 italic">
                  Filter: {results.filterExplanation}
                </p>
              )}
            </div>

            {/* Recommendations */}
            {results.recommendations.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="font-semibold text-purple-900 mb-3">Recommendations</h3>
                <ul className="space-y-2">
                  {results.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span className="text-purple-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Matching Sessions */}
            {results.results.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">
                  Matching Sessions ({results.totalMatches})
                </h3>
                <div className="grid gap-4">
                  {results.results.map((session) => (
                    <Link
                      key={session.sessionId}
                      href={`/session/${session.sessionId}`}
                      className="block bg-white rounded-lg card-shadow p-6 hover-scale"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {session.filename}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                            <span>{format(new Date(session.uploadTime), 'PPp')}</span>
                            {typeof session.frictionPoints === 'number' && session.frictionPoints > 0 && (
                              <span className="flex items-center text-yellow-600">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                {session.frictionPoints} friction points
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {session.behaviorSummary}
                          </p>
                        </div>
                        <div className="ml-4">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {results.results.length === 0 && (
              <div className="text-center py-8 text-gray-600">
                No sessions match your query criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
