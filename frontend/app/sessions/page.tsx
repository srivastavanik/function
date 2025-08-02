'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Film, AlertTriangle, Loader2, Search } from 'lucide-react';
import { listSessions, formatFileSize, getStatusColor, Session } from '@/lib/api';
import { format } from 'date-fns';

export default function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await listSessions();
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-bg text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Sessions</h1>
              <p className="opacity-90">View and analyze all uploaded session recordings</p>
            </div>
            <div className="space-x-4">
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                Upload New
              </Link>
              <Link
                href="/query"
                className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Search className="h-4 w-4 mr-2" />
                Query Sessions
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No sessions uploaded yet</p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Upload First Video
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/session/${session.sessionId}`}
                className="block bg-white rounded-lg card-shadow p-6 hover-scale"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {session.filename}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(new Date(session.uploadTime), 'PPp')}
                      </span>
                      <span>{formatFileSize(session.fileSize)}</span>
                      {session.stats?.videoDuration && (
                        <span>{Math.round(session.stats.videoDuration)}s</span>
                      )}
                      {session.frictionPoints && session.frictionPoints.length > 0 && (
                        <span className="flex items-center text-yellow-600">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          {session.frictionPoints.length} friction points
                        </span>
                      )}
                    </div>
                    {session.behaviorSummary && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {session.behaviorSummary}
                      </p>
                    )}
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
        )}
      </div>
    </main>
  );
}
