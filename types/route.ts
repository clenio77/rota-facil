export type StopStatus = 'uploading' | 'processing' | 'confirmed' | 'error' | 'optimized' | 'delivered';

export interface Stop {
    id: number;
    photoUrl: string;
    status: StopStatus;
    address: string;
    lat?: number;
    lng?: number;
    sequence?: number;
}

export interface RouteSummary {
    distance?: number;
    duration?: number;
    geometry?: {
        type: string;
        coordinates: [number, number][];
    };
    provider?: string;
}

export interface UserLocation {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
    fullAddress?: string;
}
