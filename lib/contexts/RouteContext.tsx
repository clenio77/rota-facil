'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Stop, RouteSummary, UserLocation } from '../../types/route';

interface RouteContextType {
    stops: Stop[];
    routeSummary: RouteSummary;
    isOptimizing: boolean;
    addStop: (stop: Stop) => void;
    updateStop: (id: number, updates: Partial<Stop>) => void;
    removeStop: (id: number) => void;
    clearStops: () => void;
    optimizeRoute: (origin?: UserLocation, roundtrip?: boolean) => Promise<void>;
    setRouteSummary: (summary: RouteSummary) => void;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

const STORAGE_KEY = 'rotafacil:stops:v1';

export const RouteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stops, setStops] = useState<Stop[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.error('Failed to load stops from localStorage', e);
            }
        }
        return [];
    });
    const [routeSummary, setRouteSummaryState] = useState<RouteSummary>({});
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Persist stops to localStorage
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
        } catch (e) {
            console.error('Failed to save stops to localStorage', e);
        }
    }, [stops]);

    const addStop = useCallback((stop: Stop) => {
        setStops((prev) => [...prev, stop]);
    }, []);

    const updateStop = useCallback((id: number, updates: Partial<Stop>) => {
        setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }, []);

    const removeStop = useCallback((id: number) => {
        setStops((prev) => prev.filter((s) => s.id !== id));
    }, []);

    const clearStops = useCallback(() => {
        setStops([]);
        setRouteSummaryState({});
    }, []);

    const setRouteSummary = useCallback((summary: RouteSummary) => {
        setRouteSummaryState(summary);
    }, []);

    const optimizeRoute = useCallback(async (origin?: UserLocation, roundtrip: boolean = true) => {
        const validStops = stops.filter(s => s.status === 'confirmed' && s.lat && s.lng);
        if (validStops.length < 2) {
            throw new Error('Adicione pelo menos 2 paradas confirmadas para otimizar a rota');
        }

        setIsOptimizing(true);
        try {
            const endpoint = validStops.length > 25 ? '/api/large-route-optimize' : '/api/route-optimize';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stops: validStops.map(s => ({ id: s.id, lat: s.lat, lng: s.lng })),
                    origin,
                    roundtrip,
                    maxClusterSize: 15
                }),
            });

            const result = await response.json();

            if (result.success) {
                const optimizedStops = stops.map(stop => {
                    const optimizedData = result.optimizedStops.find((os: any) => String(os.id) === String(stop.id));
                    if (optimizedData) {
                        return {
                            ...stop,
                            sequence: optimizedData.sequence,
                            status: 'optimized' as const,
                        };
                    }
                    return stop;
                });

                setStops(optimizedStops);
                setRouteSummaryState({
                    distance: result.distance,
                    duration: result.duration,
                    geometry: result.geometry,
                    provider: result.provider
                });
            } else {
                throw new Error(result.error || 'Erro ao otimizar rota');
            }
        } finally {
            setIsOptimizing(false);
        }
    }, [stops]);

    return (
        <RouteContext.Provider value={{
            stops,
            routeSummary,
            isOptimizing,
            addStop,
            updateStop,
            removeStop,
            clearStops,
            optimizeRoute,
            setRouteSummary
        }}>
            {children}
        </RouteContext.Provider>
    );
};

export const useRoute = () => {
    const context = useContext(RouteContext);
    if (context === undefined) {
        throw new Error('useRoute must be used within a RouteProvider');
    }
    return context;
};
