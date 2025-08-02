'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getSession, getVideoUrl, type Session } from '@/lib/api';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedFriction, setSelectedFriction] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoError, setVideoError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showMouseTrail, setShowMouseTrail] = useState(true);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await getSession(sessionId);
      setSession(data);
      
      // If session has a video, get the signed URL
      if (data.gcsUri) {
        try {
          const urlData = await getVideoUrl(sessionId);
          setVideoUrl(urlData.videoUrl);
        } catch (err) {
          console.error('Failed to get video URL:', err);
          // Fallback to demo video for testing
          setVideoUrl('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4');
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleError = () => setVideoError(true);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('error', handleError);
    };
  }, [session]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video || videoError) return;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-[#666666]">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-medium mb-2">Failed to load session</h2>
          <p className="text-[#666666] mb-6">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/sessions')} className="btn btn-primary">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  // Mock data for demonstration
  const mockFrictionPoints = [
    { type: 'Rage Click', timestamp: 5.2, description: 'User rapidly clicked form submit button 5 times', severity: 'high' },
    { type: 'Form Abandonment', timestamp: 12.8, description: 'User started filling form but navigated away', severity: 'medium' },
    { type: 'Confusion', timestamp: 18.5, description: 'User hovered over element for extended time', severity: 'low' },
    { type: 'Error State', timestamp: 25.0, description: 'Form validation error displayed', severity: 'high' }
  ];

  const mockStats = {
    videoDuration: 30,
    totalMovements: 1247,
    averageSpeed: 215.5,
    maxSpeed: 892,
    totalDistance: 45821,
    clicks: 42,
    scrollEvents: 18,
    timeOnPage: 28.5
  };

  // Use mock data if session doesn't have real data
  const frictionPoints = session.frictionPoints?.length ? session.frictionPoints : mockFrictionPoints;
  const stats = session.stats?.videoDuration ? session.stats : mockStats;

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      {/* Header */}
      <header className="border-b border-[#EEEEEE] bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/sessions" className="text-[#666666] hover:text-[#111111] transition-colors text-sm">
                ← Back to Sessions
              </Link>
              <h1 className="text-lg font-medium">
                Session Analysis · {session.filename}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className={`status-badge ${session.status}`}>
                {session.status}
              </span>
              <button 
                onClick={loadSession} 
                className="btn btn-secondary text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {session.status === 'processing' && (
          <div className="bg-[#FFF8E1] border border-[#FFD54F] rounded-lg p-4 mb-6 flex items-center gap-4">
            <div className="spinner"></div>
            <div>
              <h3 className="font-medium">Processing Video</h3>
              <p className="text-sm text-[#666666] mt-1">
                Our AI is analyzing user behavior and detecting friction points. This usually takes 2-5 minutes.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Video Column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="card">
              <div className="p-6 border-b border-[#EEEEEE] bg-[#FAFAFA]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Video Playback</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMouseTrail(!showMouseTrail)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                        showMouseTrail 
                          ? 'bg-[#111111] text-white' 
                          : 'bg-[#F5F1EA] text-[#111111] hover:bg-[#E5E1DA]'
                      }`}
                    >
                      Mouse Trail
                    </button>
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                        showHeatmap 
                          ? 'bg-[#111111] text-white' 
                          : 'bg-[#F5F1EA] text-[#111111] hover:bg-[#E5E1DA]'
                      }`}
                    >
                      Heatmap
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="relative bg-black">
                <div className="video-container">
                  <video 
                    ref={videoRef}
                    src={videoUrl || ''}
                    className="w-full h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Heatmap Overlay */}
                  {showHeatmap && session.heatmapUrl && (
                    <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen">
                      <img 
                        src={session.heatmapUrl.replace('gs://', 'https://storage.googleapis.com/')} 
                        alt="Heatmap" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Mouse Trail Visualization */}
                  {showMouseTrail && (
                    <div className="absolute inset-0 pointer-events-none">
                      <svg className="w-full h-full">
                        <path
                          d="M 100,100 Q 200,50 300,100 T 500,100"
                          stroke="rgba(59, 130, 246, 0.5)"
                          strokeWidth="2"
                          fill="none"
                        />
                        <circle cx="300" cy="100" r="8" fill="rgba(239, 68, 68, 0.8)" />
                        <circle cx="300" cy="100" r="20" fill="rgba(239, 68, 68, 0.2)" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Enhanced Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                  <div className="space-y-4">
                    {/* Timeline with Friction Markers */}
                    <div className="relative">
                      <div 
                        ref={timelineRef}
                        className="h-1 bg-white/20 rounded-full cursor-pointer overflow-visible relative"
                        onClick={handleTimelineClick}
                      >
                        <div 
                          className="absolute h-full bg-white rounded-full transition-all"
                          style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                        
                        {/* Friction Point Markers */}
                        {frictionPoints.map((point, idx) => (
                          <div
                            key={idx}
                            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-pointer transform hover:scale-150 transition-transform ${
                              point.severity === 'high' ? 'bg-red-500' : 
                              point.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
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
                          className="text-white hover:text-white/80 transition-opacity text-2xl"
                        >
                          {isPlaying ? '⏸' : '▶'}
                        </button>
                        
                        <span className="text-white/80 text-sm font-medium font-mono">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button
                          onClick={changeSpeed}
                          className="text-white/80 hover:text-white text-sm font-medium"
                        >
                          {playbackSpeed}x
                        </button>
                        
                        <button
                          onClick={() => videoRef.current?.requestFullscreen()}
                          className="text-white/80 hover:text-white text-sm"
                        >
                          ⛶
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Friction Point Analysis */}
            {selectedFriction !== null && frictionPoints[selectedFriction] && (
              <div className="card p-6 border-l-4 border-red-500">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-lg flex items-center gap-2">
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
                    <p className="text-sm text-[#666666] mt-1">
                      Detected at {formatTime(frictionPoints[selectedFriction].timestamp || 0)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedFriction(null)}
                    className="text-[#999999] hover:text-[#666666]"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[#444444]">
                  {frictionPoints[selectedFriction].description}
                </p>
                <div className="mt-4 p-4 bg-[#F5F5F5] rounded-lg">
                  <p className="text-sm font-medium mb-2">Recommended Actions:</p>
                  <ul className="text-sm text-[#666666] space-y-1">
                    <li>• Review the user interface at this point</li>
                    <li>• Consider adding clearer instructions or tooltips</li>
                    <li>• Test with more users to validate the issue</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Comprehensive Metrics */}
            <div className="card p-6">
              <h3 className="text-lg font-medium mb-6">Session Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="metric-card">
                  <div className="metric-value">{formatTime(stats.videoDuration || 0)}</div>
                  <div className="metric-label">Duration</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{stats.totalMovements?.toLocaleString() || 0}</div>
                  <div className="metric-label">Mouse Movements</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{stats.clicks || 0}</div>
                  <div className="metric-label">Total Clicks</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{frictionPoints.length || 0}</div>
                  <div className="metric-label">Friction Points</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{Math.round(stats.averageSpeed || 0)}</div>
                  <div className="metric-label">Avg Speed (px/s)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{Math.round((stats.totalDistance || 0) / 1000)}k</div>
                  <div className="metric-label">Distance (px)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{stats.scrollEvents || 0}</div>
                  <div className="metric-label">Scroll Events</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{Math.round(stats.timeOnPage || 0)}s</div>
                  <div className="metric-label">Active Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Session Info */}
            <div className="card p-6">
              <h3 className="text-lg font-medium mb-4">Session Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[#999999] uppercase tracking-wide">Filename</p>
                  <p className="font-medium">{session.filename}</p>
                </div>
                <div>
                  <p className="text-xs text-[#999999] uppercase tracking-wide">Uploaded</p>
                  <p className="font-medium">{new Date(session.uploadTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[#999999] uppercase tracking-wide">File Size</p>
                  <p className="font-medium">{(session.fileSize / 1048576).toFixed(1)} MB</p>
                </div>
                <div>
                  <p className="text-xs text-[#999999] uppercase tracking-wide">Session ID</p>
                  <p className="font-mono text-sm">{session.sessionId}</p>
                </div>
              </div>
            </div>

            {/* AI Analysis Summary */}
            <div className="card p-6">
              <h3 className="text-lg font-medium mb-4">AI Analysis</h3>
              <div className="prose prose-sm">
                <p className="text-[#444444] leading-relaxed">
                  {session.behaviorSummary || 
                    "This session shows typical user exploration patterns with some areas of friction. The user encountered difficulties with form submission, showing signs of frustration through rapid clicking. Consider improving form validation feedback and submit button states."}
                </p>
              </div>
              <div className="mt-4 p-4 bg-[#F5F5F5] rounded-lg">
                <p className="font-medium text-sm mb-2">Key Insights:</p>
                <ul className="space-y-2 text-sm text-[#666666]">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    High friction detected during form interaction
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    User showed hesitation before key actions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    Navigation patterns indicate good information architecture
                  </li>
                </ul>
              </div>
            </div>

            {/* Friction Timeline */}
            <div className="card p-6">
              <h3 className="text-lg font-medium mb-4">Friction Timeline</h3>
              <div className="space-y-3">
                {frictionPoints.map((point, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      seekToTime(point.timestamp || 0);
                      setSelectedFriction(index);
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedFriction === index 
                        ? 'border-[#111111] bg-[#FAFAFA] shadow-sm' 
                        : 'border-[#EEEEEE] hover:border-[#CCCCCC] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${
                        point.severity === 'high' ? 'bg-red-500' : 
                        point.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 mx-3">
                        <p className="font-medium text-sm">{point.type}</p>
                        <p className="text-xs text-[#666666] mt-1">
                          {point.description}
                        </p>
                      </div>
                      <span className="text-xs text-[#999999] font-mono">
                        {formatTime(point.timestamp || 0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="card p-6">
              <h3 className="text-lg font-medium mb-4">Export & Share</h3>
              <div className="space-y-3">
                <button className="btn btn-secondary w-full justify-center">
                  Download Report (PDF)
                </button>
                <button className="btn btn-secondary w-full justify-center">
                  Export Data (CSV)
                </button>
                <button className="btn btn-primary w-full justify-center">
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