'use client';

import React from 'react';
import { AlertTriangle, MousePointer, Navigation, ShoppingCart, Clock, Zap } from 'lucide-react';

interface KeyMoment {
  id: string;
  timestamp: number;
  type: 'friction' | 'rage_click' | 'form_error' | 'abandonment' | 'navigation' | 'interaction';
  title: string;
  description: string;
  severity?: 'high' | 'medium' | 'low';
}

interface KeyMomentsProps {
  moments: KeyMoment[];
  currentTime: number;
  onMomentClick: (timestamp: number) => void;
}

const momentIcons = {
  friction: AlertTriangle,
  rage_click: Zap,
  form_error: AlertTriangle,
  abandonment: ShoppingCart,
  navigation: Navigation,
  interaction: MousePointer,
};

const severityColors = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-neutral-600 bg-neutral-50 border-neutral-200',
};

export default function KeyMoments({ moments, currentTime, onMomentClick }: KeyMomentsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = (timestamp: number) => {
    return Math.abs(currentTime - timestamp) < 1;
  };

  return (
    <div className="bg-white rounded-xl beautiful-shadow-sm border border-neutral-200 p-6">
      <h3 className="text-lg font-semibold text-neutral-800 heading-font mb-4">
        Key Moments
      </h3>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {moments.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">
            No key moments detected yet
          </p>
        ) : (
          moments.map((moment) => {
            const Icon = momentIcons[moment.type] || MousePointer;
            const active = isActive(moment.timestamp);
            const severityClass = moment.severity ? severityColors[moment.severity] : severityColors.low;
            
            return (
              <div
                key={moment.id}
                onClick={() => onMomentClick(moment.timestamp)}
                className={`
                  key-moment-card
                  ${active ? 'active' : ''}
                `}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${severityClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-neutral-800 truncate">
                        {moment.title}
                      </h4>
                      <span className="text-xs text-neutral-500 ml-2 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(moment.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {moment.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary stats */}
      {moments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-800">
                {moments.filter(m => m.severity === 'high').length}
              </div>
              <div className="text-xs text-neutral-500">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-800">
                {moments.filter(m => m.severity === 'medium').length}
              </div>
              <div className="text-xs text-neutral-500">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-800">
                {moments.filter(m => m.severity === 'low').length}
              </div>
              <div className="text-xs text-neutral-500">Low</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}