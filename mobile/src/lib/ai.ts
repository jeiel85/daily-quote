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
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `당신은 세계 최고의 동기부여 전문가이자 작가입니다. 사용자가 선택한 테마에 맞춰 깊은 통찰력을 담은 명언과 그에 대한 따뜻한 해설을 제공하세요. 모든 응답은 반드시 '${language}' 언어로 작성해야 합니다.`
    });

    const prompt = `테마: ${theme}. 다음 JSON 형식으로 응답하세요: { "text": "명언 내용", "author": "저자 이름", "explanation": "해설 내용" }`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const response = await result.response;
    const data = JSON.parse(response.text());
    
    return {
      ...data,
      theme
    };
  } catch (error) {
    console.error('[AI Mobile Error] Failed to generate quote:', error);
    throw error;
  }
};

export const generateNativeImage = async (theme: string): Promise<string> => {
  try {
    const prompt = `A beautiful, high-quality, artistic and atmospheric background for a quote about "${theme}". Minimalist, poetic, inspiring, cinematic lighting, 4k background, no text.`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" }
      })
    });

    const data = await response.json();
    
    if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
      return data.predictions[0].bytesBase64Encoded;
    } else if (data.predictions && typeof data.predictions[0] === 'string') {
      return data.predictions[0];
    }
    
    throw new Error('No image generated');
  } catch (error) {
    console.error('[AI Mobile Error] Failed to generate image:', error);
    return ""; // Fallback to empty if AI fails
  }
};
