'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listSessions, getFrictionTrends, type Session, type FrictionTrendsResponse } from '@/lib/api_enhanced';

export default function EnhancedSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [filters, setFilters] = useState({
    status: '',
    minFriction: undefined as number | undefined,
    maxFriction: undefined as number | undefined,
    sortBy: 'uploadTime',
    order: 'desc' as 'asc' | 'desc'
  });
  const [frictionTrends, setFrictionTrends] = useState<FrictionTrendsResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await listSessions({
        limit: pagination.limit,
        offset: pagination.offset,
        status: filters.status || undefined,
        minFriction: filters.minFriction,
        maxFriction: filters.maxFriction,
        sortBy: filters.sortBy,
        order: filters.order
      });
      
      setSessions(response.sessions);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      const trends = await getFrictionTrends(7);
      setFrictionTrends(trends);
    } catch (err) {
      console.error('Failed to load friction trends:', err);
    }
  };

  useEffect(() => {
    loadSessions();
    loadTrends();
  }, [pagination.offset, filters]);

  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: Session['status']) => {
    const statusStyles = {
      uploaded: 'bg-blue-100 text-blue-700',
      processing: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    };
    
    return statusStyles[status] || 'bg-gray-100 text-gray-700';
  };

  const getSeverityIndicator = (frictionPoints: Session['frictionPoints']) => {
    if (!frictionPoints || frictionPoints.length === 0) return null;
    
    const highCount = frictionPoints.filter(fp => fp.severity === 'high').length;
    const mediumCount = frictionPoints.filter(fp => fp.severity === 'medium').length;
    
    if (highCount > 0) return 'border-red-500';
    if (mediumCount > 0) return 'border-yellow-500';
    return 'border-blue-500';
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
              <h1 className="text-2xl font-semibold text-gray-900">Sessions</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  showFilters 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>
              <Link
                href="/"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium text-sm"
              >
                Upload New Session
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Friction Trends Summary */}
      {frictionTrends && (
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Total Sessions (7d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {frictionTrends.summary.totalSessions}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Friction Points</p>
                <p className="text-2xl font-bold text-gray-900">
                  {frictionTrends.summary.totalFrictionPoints}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Most Common Issue</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {frictionTrends.summary.mostCommonType?.replace(/_/g, ' ') || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">High Severity Issues</p>
                <p className="text-2xl font-bold text-red-600">
                  {frictionTrends.severityDistribution.high}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Friction Points
                </label>
                <input
                  type="number"
                  min="0"
                  value={filters.minFriction || ''}
                  onChange={(e) => handleFilterChange({ 
                    ...filters, 
                    minFriction: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange({ ...filters, sortBy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="uploadTime">Upload Time</option>
                  <option value="status">Status</option>
                  <option value="filename">Filename</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order
                </label>
                <select
                  value={filters.order}
                  onChange={(e) => handleFilterChange({ ...filters, order: e.target.value as 'asc' | 'desc' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading sessions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={loadSessions} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No sessions found</h3>
            <p className="text-gray-600 mb-6">
              {filters.status || filters.minFriction 
                ? 'Try adjusting your filters' 
                : 'Upload your first session to get started'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
            >
              Upload Session
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
        ) : (
          <>
            {/* Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => {
                const frictionCount = session.frictionPoints?.length || 0;
                const highSeverityCount = session.frictionPoints?.filter(fp => fp.severity === 'high').length || 0;
                
                return (
                  <div
                    key={session.sessionId}
                    className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer border-l-4 ${
                      getSeverityIndicator(session.frictionPoints) || 'border-gray-300'
                    }`}
                    onClick={() => router.push(`/session/${session.sessionId}`)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-semibold text-lg truncate flex-1 pr-2">
                          {session.filename}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Uploaded</span>
                          <span className="text-gray-900">{formatTime(session.uploadTime)}</span>
                        </div>
                        
                        {session.stats?.videoDuration && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Duration</span>
                            <span className="text-gray-900">{formatDuration(session.stats.videoDuration)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="text-gray-500">Friction Points</span>
                          <span className={`font-medium ${
                            highSeverityCount > 0 ? 'text-red-600' : 
                            frictionCount > 0 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {frictionCount}
                            {highSeverityCount > 0 && (
                              <span className="text-xs ml-1">({highSeverityCount} high)</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {session.behaviorSummary && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {session.behaviorSummary}
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex -space-x-1">
                          {session.frictionPoints?.slice(0, 3).map((fp, idx) => (
                            <div
                              key={idx}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                fp.severity === 'high' ? 'bg-red-100 text-red-700' :
                                fp.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}
                              title={fp.type}
                            >
                              {fp.type.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {frictionCount > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-medium">
                              +{frictionCount - 3}
                            </div>
                          )}
                        </div>
                        
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                          View Analysis →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                  disabled={pagination.offset === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                    pagination.offset === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {Math.floor(pagination.offset / pagination.limit) + 1} of{' '}
                  {Math.ceil(pagination.total / pagination.limit)}
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                  disabled={!pagination.hasMore}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                    !pagination.hasMore
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
