// Configuração do cliente Supabase (instância sob demanda)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

export function getSupabase(): SupabaseClient {
  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env'
    );
  }
  return createClient(url, anonKey);
}
