import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure API Key is retrieved safely
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

  // Stable sequence of models
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI] Attempting ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `테마: ${theme}. 사용자가 선택한 언어('${language}')로 작성하세요. 다음 JSON 형식으로만 응답하세요: { "text": "명언 내용", "author": "저자 이름", "explanation": "해설 내용" }. 해설은 AI임을 밝히지 말고 '지혜의 깊이'라는 관점에서 우아하게 작성하세요.`;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });

      const response = await result.response;
      const text = response.text();
      
      if (!text) throw new Error('EMPTY_RESPONSE');
      
      const data = JSON.parse(text);
      if (!data.text || !data.author) throw new Error('INVALID_JSON_STRUCTURE');

      console.log(`[AI] ${modelName} success.`);
      return { ...data, theme };
      
    } catch (error: any) {
      console.warn(`[AI] ${modelName} failed:`, error.message);
      lastError = error;
      continue; 
    }
  }

  throw new Error(`AI_CALL_FAILED: 모든 모델 호출에 실패했습니다. (마지막 에러: ${lastError?.message})`);
};

export const generateNativeImage = async (theme: string): Promise<string> => {
  try {
    if (!apiKey || apiKey === 'undefined') return "";
    
    // We attempt a lightweight fetch for image metadata/prompt
    // In many free-tier Gemini API keys, direct image generation might be limited.
    // We'll keep it as a fallback but focus on quote stability.
    return ""; 
  } catch (error) {
    console.error('[AI Image Error]', error);
    return ""; 
  }
};
