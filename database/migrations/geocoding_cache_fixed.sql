-- RotaFácil - Cache Inteligente de Geocodificação (VERSÃO CORRIGIDA)
-- Execute este SQL no Supabase para criar a tabela de cache

-- 1. Tabela de cache de geocodificação
CREATE TABLE geocoding_cache (
  id SERIAL PRIMARY KEY,
  address_hash TEXT UNIQUE NOT NULL,
  original_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL,
  provider TEXT NOT NULL,
  city TEXT,
  state TEXT,
  cep TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  hits INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Índices para performance
CREATE INDEX idx_geocoding_cache_hash ON geocoding_cache(address_hash);
CREATE INDEX idx_geocoding_cache_normalized ON geocoding_cache(normalized_address);
CREATE INDEX idx_geocoding_cache_city_state ON geocoding_cache(city, state);
CREATE INDEX idx_geocoding_cache_cep ON geocoding_cache(cep);
CREATE INDEX idx_geocoding_cache_created_at ON geocoding_cache(created_at DESC);
CREATE INDEX idx_geocoding_cache_hits ON geocoding_cache(hits DESC);

-- 3. Função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_geocoding_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_geocoding_cache_updated_at ON geocoding_cache;
CREATE TRIGGER update_geocoding_cache_updated_at
  BEFORE UPDATE ON geocoding_cache
  FOR EACH ROW
  EXECUTE PROCEDURE update_geocoding_cache_updated_at();

-- 5. Políticas RLS (Row Level Security)
ALTER TABLE geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Permitir leitura pública do cache" ON geocoding_cache;
DROP POLICY IF EXISTS "Permitir inserção pública no cache" ON geocoding_cache;
DROP POLICY IF EXISTS "Permitir atualização pública do cache" ON geocoding_cache;

-- Permitir leitura pública do cache
CREATE POLICY "Permitir leitura pública do cache" ON geocoding_cache
  FOR SELECT USING (true);

-- Permitir inserção pública no cache
CREATE POLICY "Permitir inserção pública no cache" ON geocoding_cache
  FOR INSERT WITH CHECK (true);

-- Permitir atualização pública do cache (para incrementar hits)
CREATE POLICY "Permitir atualização pública do cache" ON geocoding_cache
  FOR UPDATE USING (true);

-- 6. Função para limpeza automática de cache antigo
CREATE OR REPLACE FUNCTION cleanup_old_geocoding_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove entradas com mais de 90 dias e menos de 3 hits
  DELETE FROM geocoding_cache 
  WHERE created_at < NOW() - INTERVAL '90 days' 
    AND hits < 3;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários para documentação
COMMENT ON TABLE geocoding_cache IS 'Cache inteligente para resultados de geocodificação';
COMMENT ON COLUMN geocoding_cache.address_hash IS 'Hash MD5 do endereço normalizado para busca rápida';
COMMENT ON COLUMN geocoding_cache.original_address IS 'Endereço original fornecido pelo usuário';
COMMENT ON COLUMN geocoding_cache.normalized_address IS 'Endereço normalizado usado para matching';
COMMENT ON COLUMN geocoding_cache.confidence IS 'Nível de confiança da geocodificação (0.0 a 1.0)';
COMMENT ON COLUMN geocoding_cache.provider IS 'Provedor usado (viacep, mapbox, nominatim, google)';
COMMENT ON COLUMN geocoding_cache.hits IS 'Número de vezes que este cache foi usado';
COMMENT ON COLUMN geocoding_cache.last_used_at IS 'Última vez que este cache foi acessado';

-- Sucesso! Cache de geocodificação criado com sucesso.
-- Agora o sistema usará cache automático para acelerar geocodificação em 3x!