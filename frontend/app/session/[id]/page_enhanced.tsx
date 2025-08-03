'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getSession, getVideoUrl, getHeatmapUrl, getUserJourney, type Session, type FrictionPoint } from '@/lib/api_enhanced';

interface MousePosition {
  x: number;
  y: number;
  timestamp: number;
  frameIndex: number;
}

interface UserJourneyPoint {
  timestamp: number;
  type: string;
  description: string;
  icon: string;
}

interface KeyMoment {
  type: string;
  timestamp: number;
  frameIndex: number;
  description: string;
  icon: string;
}

export default function EnhancedSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedFriction, setSelectedFriction] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showMouseTrail, setShowMouseTrail] = useState(true);
  const [mouseTrail, setMouseTrail] = useState<MousePosition[]>([]);
  const [userJourney, setUserJourney] = useState<UserJourneyPoint[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [journeyNarrative, setJourneyNarrative] = useState<string>('');
  const [showJourneyPanel, setShowJourneyPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'friction' | 'journey' | 'insights'>('friction');

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await getSession(sessionId);
      setSession(data);
      
      // Load mouse trail data if available
      if (data.mouseTrail) {
        setMouseTrail(data.mouseTrail);
      }
      
      // Get video URL
      if (data.gcsUri || data.playbackVideoUrl) {
        try {
          const urlData = await getVideoUrl(sessionId);
          setVideoUrl(urlData.videoUrl);
        } catch (err) {
          console.error('Failed to get video URL:', err);
        }
      }
      
      // Get heatmap URL
      if (data.heatmapUrl) {
        try {
          const heatmapData = await getHeatmapUrl(sessionId);
          setHeatmapUrl(heatmapData.heatmapUrl);
        } catch (err) {
          console.error('Failed to get heatmap URL:', err);
        }
      }
      
      // Get user journey
      if (data.enhanced) {
        try {
          const journeyData = await getUserJourney(sessionId);
          setUserJourney(journeyData.journey || []);
          setKeyMoments(journeyData.keyMoments || []);
          setJourneyNarrative(journeyData.narrative || '');
        } catch (err) {
          console.error('Failed to get user journey:', err);
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadSession();
      
      const interval = session && session.status === 'processing' 
        ? setInterval(loadSession, 5000) 
        : null;
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [sessionId, session?.status]);

  // Draw mouse trail on canvas
  const drawMouseTrail = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !showMouseTrail || mouseTrail.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get current video time
    const currentVideoTime = video.currentTime;
    
    // Filter positions within a time window (last 2 seconds)
    const timeWindow = 2;
    const relevantPositions = mouseTrail.filter(pos => 
      pos.timestamp >= currentVideoTime - timeWindow && 
      pos.timestamp <= currentVideoTime
    );
    
    if (relevantPositions.length < 2) return;
    
    // Draw trail
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    relevantPositions.forEach((pos, index) => {
      const x = (pos.x / 1920) * canvas.width; // Normalize to canvas size
      const y = (pos.y / 1080) * canvas.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw current position
    const currentPos = relevantPositions[relevantPositions.length - 1];
    if (currentPos) {
      const x = (currentPos.x / 1920) * canvas.width;
      const y = (currentPos.y / 1080) * canvas.height;
      
      // Outer glow
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner dot
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [mouseTrail, showMouseTrail]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      drawMouseTrail();
    };
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [drawMouseTrail]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekToTime = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    seekToTime(newTime);
  };

  const changeSpeed = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
    setPlaybackSpeed(nextSpeed);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Failed to load session</h2>
          <p className="text-gray-600 mb-6">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/sessions')} className="btn btn-primary">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const frictionPoints = session.frictionPoints || [];
  const stats = session.stats || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/sessions" className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {session.filename}
                </h1>
                <p className="text-sm text-gray-500">
                  Session ID: {session.sessionId.slice(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                session.status === 'completed' ? 'bg-green-100 text-green-700' : 
                session.status === 'processing' ? 'bg-yellow-100 text-yellow-700' : 
                'bg-gray-100 text-gray-700'
              }`}>
                {session.status}
              </span>
              <button 
                onClick={loadSession} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* User Journey Narrative Bar */}
      {journeyNarrative && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="container mx-auto px-6 py-3">
            <button
              onClick={() => setShowJourneyPanel(!showJourneyPanel)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-blue-600">📖</span>
                <p className="text-sm text-blue-900">
                  <span className="font-medium">User Journey: </span>
                  {journeyNarrative.split('\n')[0]}...
                </p>
              </div>
              <svg className={`w-5 h-5 text-blue-600 transform transition-transform ${showJourneyPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expanded Journey Panel */}
      {showJourneyPanel && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-6 py-6">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700">
                {journeyNarrative}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {session.status === 'processing' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-yellow-400 border-t-transparent"></div>
            <div>
              <h3 className="font-medium text-yellow-900">Processing Video</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Our AI is analyzing user behavior and detecting friction points. This usually takes 2-5 minutes.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Enhanced Video Column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Video Player with Advanced Controls */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Video Analysis</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMouseTrail(!showMouseTrail)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                        showMouseTrail 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Mouse Trail
                    </button>
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                        showHeatmap 
                          ? 'bg-red-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Heat Map
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="relative bg-black">
                <div className="relative aspect-video">
                  <video 
                    ref={videoRef}
                    src={videoUrl || ''}
                    className="w-full h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Dynamic Mouse Trail Canvas */}
                  {showMouseTrail && (
                    <canvas 
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none"
                      width={1920}
                      height={1080}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                  
                  {/* Heat Map Overlay */}
                  {showHeatmap && heatmapUrl && (
                    <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen">
                      <img 
                        src={heatmapUrl} 
                        alt="Heat map" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                
                {/* Enhanced Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6">
                  <div className="space-y-4">
                    {/* Enhanced Timeline with Multiple Layers */}
                    <div className="relative">
                      {/* Key Moments Layer */}
                      <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-2">
                        {keyMoments.map((moment, idx) => (
                          <div
                            key={idx}
                            className="absolute transform -translate-x-1/2 cursor-pointer group"
                            style={{ left: `${(moment.timestamp / duration) * 100}%` }}
                            onClick={() => seekToTime(moment.timestamp)}
                          >
                            <div className="text-lg hover:scale-125 transition-transform" title={moment.description}>
                              {moment.icon}
                            </div>
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                              {moment.description}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Main Timeline */}
                      <div 
                        ref={timelineRef}
                        className="h-2 bg-white/20 rounded-full cursor-pointer overflow-visible relative"
                        onClick={handleTimelineClick}
                      >
                        <div 
                          className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                          style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                        
                        {/* Friction Point Markers */}
                        {frictionPoints.map((point, idx) => (
                          <div
                            key={idx}
                            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-pointer transform hover:scale-150 transition-all ${
                              getSeverityColor(point.severity || 'low')
                            }`}
                            style={{ left: `${((point.timestamp || 0) / duration) * 100}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              seekToTime(point.timestamp || 0);
                              setSelectedFriction(idx);
                            }}
                            title={point.type}
                          >
                            <div className="absolute inset-0 rounded-full animate-ping opacity-75" />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Playback Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={togglePlayPause}
                          className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                        >
                          {isPlaying ? (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        
                        <div className="text-white">
                          <span className="font-mono text-sm">
                            {formatTime(currentTime)}
                          </span>
                          <span className="mx-2 text-white/50">/</span>
                          <span className="font-mono text-sm text-white/70">
                            {formatTime(duration)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button
                          onClick={changeSpeed}
                          className="text-white/70 hover:text-white text-sm font-medium px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                        >
                          {playbackSpeed}x
                        </button>
                        
                        <button
                          onClick={() => videoRef.current?.requestFullscreen()}
                          className="text-white/70 hover:text-white p-2 rounded hover:bg-white/20 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Friction Point Details */}
            {selectedFriction !== null && frictionPoints[selectedFriction] && (
              <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {frictionPoints[selectedFriction].type}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        frictionPoints[selectedFriction].severity === 'high' 
                          ? 'bg-red-100 text-red-700' 
                          : frictionPoints[selectedFriction].severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {frictionPoints[selectedFriction].severity} severity
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Detected at {formatTime(frictionPoints[selectedFriction].timestamp || 0)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedFriction(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-700 mb-4">
                  {frictionPoints[selectedFriction].description}
                </p>
                {frictionPoints[selectedFriction].recommendation && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Recommended Action:</p>
                    <p className="text-sm text-blue-700">
                      {frictionPoints[selectedFriction].recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Metrics Dashboard */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-6">Performance Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatTime(stats.videoDuration || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Session Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.totalMovements?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Mouse Movements</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.totalClicks || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Total Clicks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.rageClicks || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Rage Clicks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {Math.round(stats.averageSpeed || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Avg Speed (px/s)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {Math.round((stats.totalDistance || 0) / 1000)}k
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Distance (px)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.totalScrolls || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Scroll Events</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.directionChanges || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Direction Changes</div>
                </div>
              </div>
              
              {/* Funnel Metrics */}
              {session.funnelMetrics && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="font-medium mb-4">Funnel Performance</h4>
                  <div className="space-y-3">
                    {Object.entries(session.funnelMetrics.stages || {}).map(([stage, data]: [string, any]) => (
                      <div key={stage} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 capitalize">
                          {stage.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className={`w-32 h-2 bg-gray-200 rounded-full overflow-hidden`}>
                            <div 
                              className={`h-full ${data.completed ? 'bg-green-500' : 'bg-gray-300'}`}
                              style={{ width: data.completed ? '100%' : '0%' }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${data.completed ? 'text-green-600' : 'text-gray-400'}`}>
                            {data.completed ? 'Completed' : 'Not completed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm p-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('friction')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                    activeTab === 'friction' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Friction Points
                </button>
                <button
                  onClick={() => setActiveTab('journey')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                    activeTab === 'journey' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  User Journey
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                    activeTab === 'insights' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  AI Insights
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'friction' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Friction Timeline</h3>
                <div className="space-y-3">
                  {frictionPoints.length > 0 ? (
                    frictionPoints.map((point, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          seekToTime(point.timestamp || 0);
                          setSelectedFriction(index);
                        }}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          selectedFriction === index 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${getSeverityColor(point.severity || 'low')}`} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{point.type}</p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {point.description}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">
                            {formatTime(point.timestamp || 0)}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No friction points detected
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'journey' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">User Journey</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userJourney.length > 0 ? (
                    userJourney.map((point, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => seekToTime(point.timestamp)}
                      >
                        <span className="text-xl">{point.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">
                            {point.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(point.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      User journey analysis not available
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">AI Analysis</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">
                    {session.behaviorSummary || 
                      "AI analysis will appear here once processing is complete. Our advanced AI examines user behavior patterns, identifies friction points, and provides actionable recommendations to improve the user experience."}
                  </p>
                </div>
                {session.frictionSeverity && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium mb-3">Severity Distribution</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">High</span>
                        <span className="text-sm font-medium text-red-600">
                          {session.frictionSeverity.high || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Medium</span>
                        <span className="text-sm font-medium text-yellow-600">
                          {session.frictionSeverity.medium || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Low</span>
                        <span className="text-sm font-medium text-blue-600">
                          {session.frictionSeverity.low || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Session Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Filename</p>
                  <p className="font-medium">{session.filename}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Uploaded</p>
                  <p className="font-medium">{new Date(session.uploadTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">File Size</p>
                  <p className="font-medium">{(session.fileSize / 1048576).toFixed(1)} MB</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Session ID</p>
                  <p className="font-mono text-sm break-all">{session.sessionId}</p>
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Export & Share</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => window.open(`/api/export/session/${sessionId}?format=report`, '_blank')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Download Report (TXT)
                </button>
                <button 
                  onClick={() => window.open(`/api/export/session/${sessionId}?format=csv`, '_blank')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Export Data (CSV)
                </button>
                <button 
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                  Share to Slack
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
