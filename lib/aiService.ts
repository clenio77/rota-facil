/**
 * RotaFácil AI Service - Part of "ML Real" Strategy (Semana 7+)
 * Uses Google Gemini to extract and structure addresses from messy OCR text.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONFIG } from './config';

// Interface for structured address components
export interface StructuredAddress {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    fullAddress: string;
    confidence: number;
}

export class AIService {
    private static genAI: GoogleGenerativeAI | null = null;

    private static getClient() {
        if (!this.genAI && CONFIG.ai.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(CONFIG.ai.geminiApiKey);
        }
        return this.genAI;
    }

    /**
     * Processes raw OCR text into a structured Brazilian address using AI.
     * This handles typos, missing abbreviations, and messy label logic.
     */
    static async extractAddress(ocrText: string): Promise<StructuredAddress | null> {
        const client = this.getClient();
        if (!client) {
            console.warn('AI Service: GEMINI_API_KEY not configured. Falling back to traditional regex.');
            return null;
        }

        try {
            const model = client.getGenerativeModel({
                model: CONFIG.ai.model,
                generationConfig: { responseMimeType: 'application/json' }
            });

            const prompt = `
        Aja como um especialista em endereços brasileiros. 
        Extraia o endereço do seguinte texto bruto obtido via OCR de uma etiqueta de entrega:
        
        "${ocrText}"
        
        Retorne um JSON com exatamente estes campos:
        - street: Nome do logradouro (Rua, Av, etc)
        - number: Número (apenas o número ou "S/N")
        - neighborhood: Bairro
        - city: Cidade
        - state: Estado (UF de 2 letras)
        - cep: CEP formatado (00000-000)
        - fullAddress: O endereço completo formatado para GPX/Google Maps
        - confidence: Nível de confiança de 0 a 1 em relação à precisão do que foi encontrado
        
        Se não encontrar um endereço, retorne campos vazios ou nulos.
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            try {
                const parsed: StructuredAddress = JSON.parse(text);

                // Basic validation: must have at least a street or a city
                if (!parsed.street && !parsed.city && !parsed.cep) {
                    return null;
                }

                return parsed;
            } catch (e) {
                console.error('AI Service: Failed to parse JSON response from Gemini', e);
                return null;
            }
        } catch (error) {
            console.error('AI Service: Error during AI extraction', error);
            return null;
        }
    }

    /**
     * Identifies multiple addresses in a single block of text (e.g. from a list).
     */
    static async extractMultipleAddresses(text: string): Promise<StructuredAddress[]> {
        const client = this.getClient();
        if (!client) return [];

        try {
            const model = client.getGenerativeModel({
                model: CONFIG.ai.model,
                generationConfig: { responseMimeType: 'application/json' }
            });

            const prompt = `
        Analise o seguinte documento e extraia TODOS os endereços únicos que encontrar.
        Pode ser uma lista de entregas ou uma planilha.
        
        "${text}"
        
        Retorne um array JSON de objetos com { street, number, neighborhood, city, state, cep, fullAddress, confidence }.
      `;

            const result = await model.generateContent(prompt);
            const data = await result.response.text();
            const parsed = JSON.parse(data);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('AI Service: Error extracting multiple addresses', error);
            return [];
        }
    }
}
