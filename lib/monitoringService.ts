/**
 * RotaFácil Real-time Monitoring Service
 * Handles live telemetry and driver tracking.
 */

import { getSupabase } from './supabaseClient';
import { CONFIG } from './config';

export interface TelemetryUpdate {
    route_id: string;
    lat: number;
    lng: number;
    speed?: number | null;
    accuracy?: number;
    heading?: number | null;
    battery_level?: number;
    last_stop_id?: number;
    next_stop_id?: number;
    status: 'active' | 'paused' | 'completed';
}

class MonitoringService {
    private watchId: number | null = null;
    private lastUpdate: number = 0;
    private currentRouteId: string | null = null;
    private updateInterval = 15000; // 15 seconds
    private minDistance = 20; // 20 meters

    /**
     * Starts live tracking for a specific route
     */
    async startTracking(routeId: string) {
        if (this.watchId !== null) return;

        this.currentRouteId = routeId;
        console.log(`🚀 Iniciando monitoramento em tempo real para a rota: ${routeId}`);

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            console.error('GPS não disponível para monitoramento.');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => console.error('Erro no GPS (Monitoramento):', error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    /**
     * Stops live tracking
     */
    async stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.currentRouteId) {
            await this.sendTelemetryUpdate({
                route_id: this.currentRouteId,
                lat: 0,
                lng: 0,
                status: 'completed'
            });
        }

        this.currentRouteId = null;
        console.log('🏁 Monitoramento em tempo real finalizado.');
    }

    private async handleLocationUpdate(position: GeolocationPosition) {
        const now = Date.now();

        // Throttling: Check if enough time has passed
        if (now - this.lastUpdate < this.updateInterval) return;

        const { latitude, longitude, speed, heading, accuracy } = position.coords;

        const update: TelemetryUpdate = {
            route_id: this.currentRouteId!,
            lat: latitude,
            lng: longitude,
            speed,
            heading,
            accuracy,
            status: 'active',
            // Get battery level if available in modern browsers
            battery_level: await this.getBatteryLevel()
        };

        await this.sendTelemetryUpdate(update);
        this.lastUpdate = now;
    }

    private async sendTelemetryUpdate(update: TelemetryUpdate) {
        try {
            const supabase = getSupabase();

            // Upsert current position for the route
            // This table should be created in Supabase with Realtime enabled
            const { error } = await supabase
                .from('route_monitoring')
                .upsert({
                    route_id: update.route_id,
                    latitude: update.lat,
                    longitude: update.lng,
                    speed: update.speed,
                    heading: update.heading,
                    status: update.status,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'route_id' });

            if (error) throw error;

            // Also log trail in a separate table for historical path
            await supabase.from('route_trail').insert({
                route_id: update.route_id,
                latitude: update.lat,
                longitude: update.lng,
                timestamp: new Date().toISOString()
            });

        } catch (err) {
            console.error('Falha ao enviar telemetria:', err);
            // Fallback: Store locally if needed (OfflineManager handles this)
        }
    }

    private async getBatteryLevel(): Promise<number | undefined> {
        try {
            if ('getBattery' in navigator) {
                const battery: any = await (navigator as any).getBattery();
                return Math.round(battery.level * 100);
            }
        } catch (e) { }
        return undefined;
    }

    /**
     * Subscribe to a specific route monitoring (for supervisor view)
     */
    subscribeToRoute(routeId: string, callback: (data: TelemetryUpdate) => void) {
        const supabase = getSupabase();

        return supabase
            .channel(`monitoring:${routeId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'route_monitoring',
                filter: `route_id=eq.${routeId}`
            }, (payload) => {
                const data = payload.new;
                callback({
                    route_id: data.route_id,
                    lat: data.latitude,
                    lng: data.longitude,
                    status: data.status,
                    speed: data.speed,
                    heading: data.heading
                });
            })
            .subscribe();
    }
}

export const monitoringService = new MonitoringService();
