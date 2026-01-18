'use client';

import React, { useState, useEffect } from 'react';
import { useRoute } from '../lib/contexts/RouteContext';
import { monitoringService } from '../lib/monitoringService';

export const MonitoringIndicator: React.FC = () => {
    const { stops } = useRoute();
    const [isTracking, setIsTracking] = useState(false);
    const [pulse, setPulse] = useState(false);

    // Effect to toggle tracking based on route status
    useEffect(() => {
        const hasOptimizedRoute = stops.some(s => s.status === 'optimized');

        if (hasOptimizedRoute && !isTracking) {
            // In a real app, we'd generate a unique ID for this specific run
            const runId = `route_${new Date().toISOString().split('T')[0]}_${stops.length}`;
            monitoringService.startTracking(runId);
            setIsTracking(true);
        } else if (!hasOptimizedRoute && isTracking) {
            monitoringService.stopTracking();
            setIsTracking(false);
        }
    }, [stops, isTracking]);

    // Animation effect
    useEffect(() => {
        if (isTracking) {
            const interval = setInterval(() => setPulse(p => !p), 1500);
            return () => clearInterval(interval);
        }
    }, [isTracking]);

    if (!isTracking) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[1000] flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-700 ${pulse ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-110' : 'bg-emerald-600'}`} />
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Live Tracking</span>
        </div>
    );
};
