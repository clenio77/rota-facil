/**
 * RotaFácil Central Configuration and Environment Variables
 * Part of Phase 2: Saneamento IA - Centralization and Environment Validation
 */

const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
    if (value === undefined && !defaultValue) {
        // We don't throw here to allow build-time checks if needed, but we log the warning
        console.warn(`⚠️ Warning: Environment variable ${key} is not defined.`);
        return '';
    }
    return value || '';
};

export const CONFIG = {
    // Supabase
    supabase: {
        url: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
        anonKey: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },

    // Mapbox
    mapbox: {
        token: getEnv('MAPBOX_ACCESS_TOKEN'),
        optimizationUrl: 'https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic',
        geocodingUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
    },

    // OSRM
    osrm: {
        url: getEnv('OSRM_URL', 'http://router.project-osrm.org'),
    },

    // AI Providers (Gemini) - Part of the new "ML Real" phase
    ai: {
        geminiApiKey: getEnv('GEMINI_API_KEY'),
        // Prefer higher quality models for address parsing
        model: getEnv('AI_MODEL', 'gemini-1.5-flash'),
    },

    // Application Defaults
    app: {
        name: 'RotaFácil Moura PRO',
        version: '3.0.0',
        isProd: process.env.NODE_ENV === 'production',
        testMode: process.env.NEXT_PUBLIC_TEST_MODE === 'true',
    },

    // OCR Limits and Defaults
    ocr: {
        minConfidence: 0.3,
        maxImageSize: 5 * 1024 * 1024, // 5MB
    }
};

/**
 * Validation function to check if critical environment variables are present
 */
export function validateEnvironment() {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`🚨 Missing required environment variables: ${missing.join(', ')}`);
        return false;
    }

    return true;
}
