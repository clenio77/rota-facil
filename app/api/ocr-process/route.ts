import { NextRequest, NextResponse } from 'next/server';
import { executeOCRWithFallback } from '../../../lib/ocrFallbackSystem';
import { extractAddressIntelligently, validateExtractedAddress } from '../../../lib/smartAddressExtractor';
import { validateBrazilianAddress, correctCommonOCRErrors } from '../../../lib/brazilianAddressValidator';
import { getSupabase } from '../../../lib/supabaseClient';
import { enhanceImageForOCR } from '../../../lib/imagePreprocessing';
import { AIService } from '../../../lib/aiService';
import { geocodeAddressImproved } from '../../../lib/geocodingService';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imageData, userLocation } = await request.json();

    // Aceitar tanto imageUrl quanto imageData (base64)
    let processImageUrl = imageUrl;

    if (!imageUrl && !imageData) {
      return NextResponse.json(
        { success: false, error: 'URL da imagem ou dados da imagem não fornecidos' },
        { status: 400 }
      );
    }

    // REJEITAR URLs blob completamente
    if (imageUrl && imageUrl.startsWith('blob:')) {
      return NextResponse.json({
        success: false,
        error: '❌ URL blob detectada. Isso indica um problema no upload da imagem. Por favor, tire uma nova foto.',
        details: 'URLs blob não podem ser processadas no servidor. A imagem deve ser enviada via Supabase Storage.'
      }, { status: 400 });
    }

    // Se recebemos dados base64, usar diretamente
    if (imageData && imageData.startsWith('data:image/')) {
      processImageUrl = imageData;
      console.log('Processando imagem a partir de dados base64');
    } else {
      console.log('Processando imagem a partir de URL:', imageUrl);
    }

    // 1. Pular pré-processamento se for URL blob (não funciona no servidor)
    let imageEnhancement;
    if (processImageUrl.startsWith('blob:')) {
      console.log('URL blob detectada, pulando pré-processamento...');
      imageEnhancement = {
        enhancedImageUrl: processImageUrl,
        confidence: 0.5
      };
    } else {
      // 1. Melhorar imagem para OCR
      imageEnhancement = await enhanceImageForOCR(processImageUrl);
      console.log('Imagem processada com confiança:', (imageEnhancement.confidence * 100).toFixed(1) + '%');
    }

    // 2. Executar OCR com sistema de fallback robusto
    const ocrResult = await executeOCRWithFallback(imageEnhancement.enhancedImageUrl, 0.3);

    console.log('Resultado do OCR:', {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider
    });

    // 3. Corrigir erros comuns de OCR
    const correctedText = correctCommonOCRErrors(ocrResult.text);
    console.log('Texto corrigido:', correctedText);

    // 4. Extrair endereço usando IA (Primário) ou Sistema Inteligente (Fallback)
    console.log('Extraindo endereço com IA...');
    let address: string | undefined;
    let extractionConfidence = 0;
    let extractionMethod = 'ai';

    const aiResult = await AIService.extractAddress(correctedText);

    if (aiResult && aiResult.confidence > 0.6) {
      console.log('IA detectou endereço com alta confiança:', aiResult.fullAddress);
      address = aiResult.fullAddress;
      extractionConfidence = aiResult.confidence;
      extractionMethod = `gemini-ai (${aiResult.confidence.toFixed(2)})`;
    } else {
      console.log('IA falhou ou baixa confiança, usando sistema inteligente local...');
      const extractionResult = await extractAddressIntelligently(correctedText);
      address = extractionResult.address;
      extractionConfidence = extractionResult.confidence;
      extractionMethod = extractionResult.method;

      // Validar e melhorar endereço brasileiro
      if (address) {
        const brazilianValidation = validateBrazilianAddress(address);
        if (brazilianValidation.confidence > extractionConfidence) {
          address = brazilianValidation.correctedAddress;
          extractionConfidence = brazilianValidation.confidence;
        }
      }
    }

    console.log('Endereço extraído:', address);
    console.log('Confiança final da extração:', extractionConfidence);

    if (!address || !validateExtractedAddress(address).isValid) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair um endereço válido da imagem',
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        extractionConfidence: extractionConfidence,
        extractionMethod: extractionMethod,
        debug: {
          originalText: ocrResult.text,
          cleanedText: correctedText,
          extractedAddress: address
        }
      });
    }

    // Validar endereço extraído
    const validation = validateExtractedAddress(address);
    if (validation.isValid) {
      console.log('Endereço validado com sucesso');

      // Geocodificar endereço usando o serviço centralizado
      const coordinates = await geocodeAddressImproved(address, userLocation);

      if (coordinates) {
        console.log('Geocodificação bem-sucedida:', coordinates);

        // Salvar no banco de dados
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('stops')
          .insert({
            photo_url: imageUrl,
            address: coordinates.formatted_address || address,
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            extracted_text: ocrResult.text,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao salvar no banco:', error);
          // Continuar mesmo se falhar ao salvar no banco
        }

        console.log('Processamento OCR concluído com sucesso');

        return NextResponse.json({
          success: true,
          address: coordinates.formatted_address || address,
          lat: coordinates.lat,
          lng: coordinates.lng,
          extractedText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractionConfidence,
          extractionMethod: extractionMethod,
          id: data?.id,
          debug: {
            originalExtracted: address,
            finalAddress: coordinates.formatted_address || address
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Endereço extraído mas não foi possível geocodificar',
          extractedAddress: address,
          extractedText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractionConfidence,
          extractionMethod: extractionMethod
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Endereço extraído mas não foi possível validar',
        extractedAddress: address,
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        extractionConfidence: extractionConfidence,
        extractionMethod: extractionMethod
      });
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