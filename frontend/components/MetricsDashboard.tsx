'use client';

import React from 'react';
import { Activity, MousePointer, TrendingUp, Clock, Zap, AlertTriangle } from 'lucide-react';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
}

interface MetricsDashboardProps {
  stats: {
    totalFrames?: number;
    videoDuration?: number;
    fps?: number;
    totalMovements?: number;
    totalDistance?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    highPriorityFrictionCount?: number;
  };
  frictionPoints: Array<any>;
}

function MetricCard({ icon, label, value, change, unit }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-neutral-100 rounded-lg">
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="metric-value">
        {value}{unit && <span className="text-base font-normal text-neutral-500 ml-1">{unit}</span>}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export default function MetricsDashboard({ stats, frictionPoints }: MetricsDashboardProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (pixels?: number) => {
    if (!pixels) return '0';
    if (pixels > 10000) {
      return `${(pixels / 1000).toFixed(1)}k`;
    }
    return Math.round(pixels).toString();
  };

  return (
    <div className="space-y-6">
      {/* Primary metrics */}
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 heading-font mb-4">
          Session Metrics
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Clock className="w-5 h-5 text-neutral-600" />}
            label="Duration"
            value={formatDuration(stats.videoDuration)}
          />
          <MetricCard
            icon={<MousePointer className="w-5 h-5 text-neutral-600" />}
            label="Mouse Movements"
            value={stats.totalMovements || 0}
          />
          <MetricCard
            icon={<Activity className="w-5 h-5 text-neutral-600" />}
            label="Avg Speed"
            value={stats.averageSpeed?.toFixed(1) || 0}
            unit="px/s"
          />
          <MetricCard
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            label="Friction Points"
            value={frictionPoints.length}
          />
        </div>
      </div>

      {/* Movement analysis */}
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 heading-font mb-4">
          Movement Analysis
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            icon={<TrendingUp className="w-5 h-5 text-neutral-600" />}
            label="Total Distance"
            value={formatDistance(stats.totalDistance)}
            unit="px"
          />
          <MetricCard
            icon={<Zap className="w-5 h-5 text-neutral-600" />}
            label="Max Speed"
            value={stats.maxSpeed?.toFixed(0) || 0}
            unit="px/s"
          />
          <MetricCard
            icon={<Activity className="w-5 h-5 text-neutral-600" />}
            label="Frame Rate"
            value={stats.fps?.toFixed(0) || 0}
            unit="fps"
          />
        </div>
      </div>

      {/* Friction analysis */}
      <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
        <h4 className="text-sm font-medium text-neutral-700 mb-3">
          Friction Point Distribution
        </h4>
        <div className="space-y-2">
          {['high', 'medium', 'low'].map((severity) => {
            const count = frictionPoints.filter(fp => 
              fp.severity === severity || (!fp.severity && severity === 'medium')
            ).length;
            const percentage = frictionPoints.length > 0 
              ? (count / frictionPoints.length) * 100 
              : 0;
            
            return (
              <div key={severity} className="flex items-center space-x-3">
                <span className="text-xs text-neutral-600 capitalize w-16">
                  {severity}
                </span>
                <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      severity === 'high' 
                        ? 'bg-red-500' 
                        : severity === 'medium' 
                        ? 'bg-amber-500' 
                        : 'bg-neutral-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-600 w-8 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}