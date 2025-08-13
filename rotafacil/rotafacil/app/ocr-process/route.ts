import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(req: NextRequest) {
  const { imageUrl } = await req.json();
  if (!imageUrl) {
    return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
  }
  try {
    const result = await Tesseract.recognize(imageUrl, 'por');
    const text = result.data.text;
    // Regex para extrair endereço (exemplo simplificado)
    const addressMatch = text.match(/\d+\s+\w+\s+\w+/);
    const address = addressMatch ? addressMatch[0] : '';
    return NextResponse.json({ text, address });
  } catch (error) {
    return NextResponse.json({ error: 'OCR failed', details: error }, { status: 500 });
  }
}
