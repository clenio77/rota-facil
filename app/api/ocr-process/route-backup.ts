import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { getSupabase } from '../../../lib/supabaseClient';

// Função para limpar e extrair endereço do texto
function extractAddress(text: string): string {
  // Remover quebras de linha extras e normalizar espaços
  const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Padrões comuns de endereço brasileiro
  const patterns = [
    // Rua/Avenida Nome, Número - Bairro, Cidade - Estado CEP
    /(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.)\s+[^,]+,?\s*\d+[^,]*(?:,\s*[^,]+)?/i,
    // Endereço com CEP
    /[^,]+,?\s*\d+[^,]*,?\s*\d{5}-?\d{3}/i,
    // Endereço genérico com número
    /[A-Za-zÀ-ÿ\s]+,?\s*\d+[^,]*,?\s*[A-Za-zÀ-ÿ\s]+/i,
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Se não encontrar padrão, tentar pegar uma linha que pareça endereço
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  for (const line of lines) {
    // Verificar se a linha tem características de endereço (contém número e letras)
    if (/\d+/.test(line) && /[A-Za-zÀ-ÿ]{3,}/.test(line)) {
      return line;
    }
  }

  return '';
}

// Função para geocodificar endereço usando Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address + ', Brasil'
      )}&limit=1`,
      {
        headers: {
          'User-Agent': 'RotaFacil/1.0',
        },
      }
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error('Erro ao geocodificar:', error);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'URL da imagem não fornecida' },
        { status: 400 }
      );
    }

    // Criar worker do Tesseract
    const worker = await createWorker('por');

    try {
      // Processar imagem
      const { data: { text } } = await worker.recognize(imageUrl);
      
      // Extrair endereço do texto
      const address = extractAddress(text);
      
      if (!address) {
        return NextResponse.json({
          success: false,
          error: 'Não foi possível extrair um endereço da imagem',
          extractedText: text,
        });
      }

      // Geocodificar endereço
      const coordinates = await geocodeAddress(address);

      // Salvar no banco de dados
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('stops')
        .insert({
          photo_url: imageUrl,
          address: address,
          latitude: coordinates?.lat,
          longitude: coordinates?.lng,
          extracted_text: text,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar no banco:', error);
        // Continuar mesmo se falhar ao salvar no banco
      }

      return NextResponse.json({
        success: true,
        address,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        extractedText: text,
        id: data?.id,
      });

    } finally {
      await worker.terminate();
    }

  } catch (error) {
    console.error('Erro no processamento OCR:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao processar imagem',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}