'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Film, AlertTriangle, CheckCircle, Loader2, Download } from 'lucide-react';
import { getSession, formatFileSize, getStatusColor, Session } from '@/lib/api';
import { format } from 'date-fns';

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Error loading session</p>
          <p className="text-gray-600 mb-4">{error || 'Session not found'}</p>
          <Link href="/" className="text-purple-600 hover:text-purple-700">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-bg text-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/sessions" className="inline-flex items-center text-white/80 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sessions
          </Link>
          <h1 className="text-3xl font-bold mb-2">{session.filename}</h1>
          <div className="flex items-center space-x-4 text-sm">
            <span className={`inline-flex items-center px-3 py-1 rounded-full ${getStatusColor(session.status)}`}>
              {session.status}
            </span>
            <span className="opacity-80">
              {format(new Date(session.uploadTime), 'PPpp')}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Info Card */}
            <div className="bg-white rounded-lg card-shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Film className="h-5 w-5 mr-2 text-purple-600" />
                Video Information
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">File Size</dt>
                  <dd className="font-medium">{formatFileSize(session.fileSize)}</dd>
                </div>
                {session.stats?.videoDuration && (
                  <div>
                    <dt className="text-sm text-gray-500">Duration</dt>
                    <dd className="font-medium">{Math.round(session.stats.videoDuration)}s</dd>
                  </div>
                )}
                {session.stats?.totalFrames && (
                  <div>
                    <dt className="text-sm text-gray-500">Total Frames</dt>
                    <dd className="font-medium">{session.stats.totalFrames}</dd>
                  </div>
                )}
                {session.stats?.fps && (
                  <div>
                    <dt className="text-sm text-gray-500">Frame Rate</dt>
                    <dd className="font-medium">{Math.round(session.stats.fps)} fps</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Behavior Summary */}
            {session.behaviorSummary && (
              <div className="bg-white rounded-lg card-shadow p-6">
                <h2 className="text-xl font-semibold mb-4">AI Analysis Summary</h2>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700">{session.behaviorSummary}</p>
                </div>
              </div>
            )}

            {/* Friction Points */}
            {session.frictionPoints && session.frictionPoints.length > 0 && (
              <div className="bg-white rounded-lg card-shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                  Friction Points ({session.frictionPoints.length})
                </h2>
                <div className="space-y-3">
                  {session.frictionPoints.map((point, index) => (
                    <div key={index} className="border-l-4 border-yellow-400 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          Frame {point.frameIndex} • {point.timestamp}s
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {point.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{point.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg card-shadow p-6">
              <h3 className="font-semibold mb-4">Processing Status</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-sm">Video uploaded</span>
                </div>
                {session.status === 'processing' && (
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-yellow-500 mr-3 animate-pulse" />
                    <span className="text-sm">Analysis in progress...</span>
                  </div>
                )}
                {session.status === 'completed' && (
                  <>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-sm">Frames extracted</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-sm">AI analysis complete</span>
                    </div>
                  </>
                )}
                {session.status === 'failed' && (
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                    <span className="text-sm text-red-600">{session.error || 'Processing failed'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {session.status === 'completed' && session.resultsUri && (
              <div className="bg-white rounded-lg card-shadow p-6">
                <h3 className="font-semibold mb-4">Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </button>
                  <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    View Heat Map
                  </button>
                </div>
              </div>
            )}

            {/* Refresh for processing */}
            {session.status === 'processing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  This page will automatically refresh to show the latest status.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
