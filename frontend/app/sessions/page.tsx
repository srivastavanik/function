'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listSessions, type Session } from '@/lib/api';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await listSessions();
      setSessions(data.sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions
    .filter(session => {
      const matchesSearch = session.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           session.sessionId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'processing':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'uploaded':
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-[#666666]">Loading sessions...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    processing: sessions.filter(s => s.status === 'processing').length,
    failed: sessions.filter(s => s.status === 'failed').length,
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      {/* Header */}
      <header className="border-b border-[#EEEEEE] bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium flex items-center gap-3">
                Sessions
                <span className="text-sm font-normal text-[#666666] bg-[#F5F5F5] px-3 py-1 rounded-full">
                  {sessions.length} total
                </span>
              </h1>
              <p className="text-[#666666] text-sm mt-1">View and analyze your session recordings</p>
            </div>
            <Link href="/" className="btn btn-primary">
              Upload New Session
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 border border-[#EEEEEE]">
            <div className="text-3xl font-semibold">{stats.total}</div>
            <div className="text-sm text-[#666666] mt-1">Total Sessions</div>
          </div>
          <div className="bg-white rounded-lg p-6 border border-[#EEEEEE]">
            <div className="text-3xl font-semibold text-green-600">{stats.completed}</div>
            <div className="text-sm text-[#666666] mt-1">Completed</div>
          </div>
          <div className="bg-white rounded-lg p-6 border border-[#EEEEEE]">
            <div className="text-3xl font-semibold text-yellow-600">{stats.processing}</div>
            <div className="text-sm text-[#666666] mt-1">Processing</div>
          </div>
          <div className="bg-white rounded-lg p-6 border border-[#EEEEEE]">
            <div className="text-3xl font-semibold text-red-600">{stats.failed}</div>
            <div className="text-sm text-[#666666] mt-1">Failed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-6 mb-8 border border-[#EEEEEE]">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by filename or session ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Status</option>
                <option value="uploaded">Uploaded</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'status')}
                className="input"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-[#EEEEEE]">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 text-[#E0E0E0] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No matching sessions' : 'No sessions yet'}
              </h3>
              <p className="text-[#666666] mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search criteria' 
                  : 'Upload a video to start analyzing user sessions'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link href="/" className="btn btn-primary">
                  Upload Your First Video
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/session/${session.sessionId}`}
                className="block bg-white rounded-lg p-6 hover:shadow-md transition-all border border-[#EEEEEE] hover:border-[#CCCCCC] group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-lg truncate">{session.filename}</h3>
                      <span className={`text-xs px-3 py-1 rounded-full border font-medium ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-[#666666]">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(session.uploadTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {formatFileSize(session.fileSize)}
                      </span>
                      <span className="text-xs text-[#999999] font-mono">
                        {session.sessionId.slice(0, 8)}
                      </span>
                    </div>
                    
                    {/* Session preview data */}
                    {session.status === 'completed' && session.stats && (
                      <div className="mt-3 flex items-center gap-6 text-sm">
                        <span className="text-[#666666]">
                          <span className="font-medium text-[#111111]">{session.frictionPoints?.length || 0}</span> friction points
                        </span>
                        <span className="text-[#666666]">
                          <span className="font-medium text-[#111111]">{Math.round(session.stats.videoDuration || 0)}s</span> duration
                        </span>
                        <span className="text-[#666666]">
                          <span className="font-medium text-[#111111]">{session.stats.totalMovements || 0}</span> movements
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-[#CCCCCC] group-hover:text-[#666666] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                {session.status === 'processing' && (
                  <div className="mt-4">
                    <div className="bg-[#F5F5F5] rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                    <p className="text-xs text-[#666666] mt-2">Analyzing video content...</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination placeholder */}
        {filteredSessions.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-[#666666] hover:text-[#111111] disabled:opacity-50" disabled>
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-[#666666]">
              Page 1 of 1
            </span>
            <button className="px-4 py-2 text-sm font-medium text-[#666666] hover:text-[#111111] disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}