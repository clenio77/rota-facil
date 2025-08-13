// Configuração do cliente Supabase (instância sob demanda)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}
