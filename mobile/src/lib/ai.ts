import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure API Key is retrieved safely from the newly updated NEW .env
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

  // Use the SPECIFIC models verified by curling the user's new API key
  const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErrorMsg = "";

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI] Activating Master Model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `Theme: ${theme}. Format: JSON. Write in Language Code: ${language}. 
      Return ONLY: { "text": "wisdom", "author": "name", "explanation": "depth" }. 
      Be elegant and non-AI sounding.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Strict JSON extraction: Strip markdown code blocks
      text = text.replace(/```json|```/g, '').trim();
      
      if (!text) throw new Error(`${modelName} empty`);
      
      const data = JSON.parse(text);
      if (!data.text) throw new Error(`${modelName} corrupt`);

      console.log(`[AI] ${modelName} success.`);
      return { ...data, theme };
      
    } catch (error: any) {
      console.warn(`[AI] ${modelName} fail:`, error.message);
      lastErrorMsg += `[${modelName}]: ${error.message}\n`;
      continue; 
    }
  }

  throw new Error(`AI_MODELS_FAILED_FINAL:\n${lastErrorMsg}`);
};

export const generateNativeImage = async (theme: string): Promise<string> => {
  // Focus is on stabilizing the primary quote service first.
  return ""; 
};
