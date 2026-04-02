import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

export interface Quote {
  text: string;
  author: string;
  explanation: string;
  theme: string;
  imageUrl?: string;
}

export const generateNativeQuote = async (theme: string, language: string = 'ko'): Promise<Quote> => {
  if (!apiKey || apiKey === 'undefined') {
    throw new Error('API_KEY_MISSING: EXPO_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // Use the most stable and latest model names
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.0-pro"];
  let lastErrorMsg = "";

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI] Attempting ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `Theme: ${theme}. Write in Lang: ${language}. Respond ONLY with a JSON object: { "text": "...", "author": "...", "explanation": "..." }. Explanation should be elegant and inspiring.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Safety: Strip potential markdown code blocks (```json ... ```)
      text = text.replace(/```json|```/g, '').trim();
      
      if (!text) throw new Error(`${modelName} returned empty text`);
      
      const data = JSON.parse(text);
      if (!data.text) throw new Error(`${modelName} returned incomplete JSON`);

      console.log(`[AI] ${modelName} success.`);
      return { ...data, theme };
      
    } catch (error: any) {
      console.warn(`[AI] ${modelName} failed:`, error.message);
      lastErrorMsg += `[${modelName}]: ${error.message}\n`;
      continue; 
    }
  }

  throw new Error(`AI_MODELS_FAILED:\n${lastErrorMsg}`);
};

export const generateNativeImage = async (theme: string): Promise<string> => {
  // Keeping it as a safe fallback; focus is on fixing the quote error identified in the screenshot
  return ""; 
};
