'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  heatmapUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onSeek?: (time: number) => void;
}

export default function VideoPlayer({ videoUrl, heatmapUrl, onTimeUpdate, onSeek }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onTimeUpdate]);

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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="relative bg-neutral-900 rounded-xl overflow-hidden">
      <div className="video-container">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlayPause}
        />
        
        {/* Heat map overlay */}
        {showHeatmap && heatmapUrl && (
          <div className="heatmap-overlay">
            <img 
              src={heatmapUrl.replace('gs://', 'https://storage.googleapis.com/')} 
              alt="Mouse activity heatmap"
              className="w-full h-full object-contain mix-blend-screen"
            />
          </div>
        )}

        {/* Video controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div 
            className="timeline-track mb-4 cursor-pointer"
            onClick={handleSeek}
          >
            <div 
              className="timeline-progress"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="text-white hover:text-neutral-300 transition"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8" />
                )}
              </button>

              {/* Skip buttons */}
              <button
                onClick={() => skipTime(-10)}
                className="text-white hover:text-neutral-300 transition"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={() => skipTime(10)}
                className="text-white hover:text-neutral-300 transition"
              >
                <SkipForward className="w-6 h-6" />
              </button>

              {/* Time display */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Volume control */}
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-white" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              {/* Heatmap toggle */}
              {heatmapUrl && (
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    showHeatmap 
                      ? 'bg-white/20 text-white' 
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  Heatmap
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-neutral-300 transition"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}