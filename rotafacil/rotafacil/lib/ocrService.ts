import Tesseract from 'tesseract.js';

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const result = await Tesseract.recognize(imageUrl, 'por');
  return result.data.text;
}
