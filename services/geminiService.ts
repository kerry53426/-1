
import { GoogleGenAI, Type } from "@google/genai";
import { Member, AIAnalysisResult, DailyStats } from "../types";

// 老闆，這是您提供的專屬金鑰，直接寫入確保 Vercel 部署後一定讀得到
const API_KEY = "AIzaSyAZqBjveTcYrefMo4dopnekpKjv1kWHgsE";

/**
 * 分析會員筆記，提取結構化資訊
 */
export const analyzeMemberNotes = async (notes: string): Promise<AIAnalysisResult> => {
  if (!notes.trim()) {
    return {
      dietaryRestrictions: [],
      specialRequests: [],
      tags: [],
      summary: "無足夠資料進行分析。",
      suggestedActions: []
    };
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      dietaryRestrictions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "飲食禁忌清單"
      },
      specialRequests: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "特殊服務需求"
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "分類標籤"
      },
      summary: {
        type: Type.STRING,
        description: "專業摘要"
      },
      suggestedActions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "建議行動"
      }
    },
    required: ["dietaryRestrictions", "specialRequests", "tags", "summary", "suggestedActions"]
  };

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `分析以下豪華露營客戶筆記： "${notes}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "你是一位頂級管家，負責整理客戶資料。請使用繁體中文。"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as AIAnalysisResult;
    }
    throw new Error("AI 未回傳內容");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      dietaryRestrictions: [],
      specialRequests: [],
      tags: ["分析失敗"],
      summary: "無法連接至 AI 服務，請確認網路連線。",
      suggestedActions: []
    };
  }
};

/**
 * 產生迎賓訊息
 */
export const generateWelcomeMessage = async (member: Member): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `為會員 ${member.name} 寫一段溫暖的迎賓詞。`,
      config: {
        systemInstruction: "你是愛上喜翁的總管。語氣要優雅且富有詩意。請使用繁體中文。"
      }
    });
    return response.text || "歡迎回到愛上喜翁。";
  } catch (error) {
    return `親愛的 ${member.name} 您好，歡迎回到愛上喜翁。`;
  }
};

/**
 * 產生每日營運簡報
 */
export const generateDailyBriefing = async (stats: DailyStats | null, upcomingVIPs: string[]): Promise<string> => {
  if (!stats) return "數據不足。";
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `根據數據生成營運簡報： ${JSON.stringify(stats)}`,
      config: {
        systemInstruction: "你是營運總監，提供 3 個精簡的觀察重點。請使用繁體中文。"
      }
    });
    return response.text || "今日營運正常。";
  } catch (error) {
    return "今日營運數據正常，請注意山區天氣。";
  }
};

/**
 * 核心功能：分析訂房報表圖片
 * Updated to accept mimeType dynamiclly
 */
export const analyzeOccupancyImage = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<any[]> => {
  try {
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roomCode: { type: Type.STRING, description: "房號" },
          guestName: { type: Type.STRING, description: "房客姓名" },
          checkInDate: { type: Type.STRING, description: "入住日期 (YYYY-MM-DD)" },
          adults: { type: Type.INTEGER, description: "大人人數" },
          children: { type: Type.INTEGER, description: "小孩人數" },
          stayDurationInfo: { type: Type.STRING, description: "天數資訊，如 '2泊', '續住'。若無則留空。" }
        },
        required: ["roomCode", "guestName", "checkInDate", "adults", "children"]
      }
    };

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Use 3-flash for best multimodal performance
      contents: [
        {
          inlineData: {
            mimeType: mimeType, // Use correct mime type passed from file input
            data: base64Image
          }
        },
        {
          text: `你是一位專業的資料錄入員。請分析這張訂房報表：
          
          1. **精準辨識房號**：如 201, 尊1 等。
          2. **入住天數（重要）**：特別留意備註欄或天數欄。若看到 '2泊', '3天2夜', '續住'，請務必填入 stayDurationInfo。
          3. **忽略飲食禁忌**：不要提取任何關於食物的要求。
          4. **格式規範**：嚴格遵守 JSON Array 格式。`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return [];
  } catch (error: any) {
    console.error("Gemini Image Analysis Error:", error);
    let errorMsg = "分析失敗，請重試。";
    
    // Provide more specific error messages
    if (error.message?.includes("API_KEY") || error.status === 400 || error.status === 403) {
        errorMsg = "API Key 權限不足或無效，請確認 Google AI Studio 設定。";
    } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
        errorMsg = "網路連線異常，無法連接至 Google AI。";
    } else if (error.status === 503) {
        errorMsg = "AI 服務暫時繁忙，請稍後再試。";
    } else {
        errorMsg = `分析錯誤: ${error.message}`;
    }
    
    throw new Error(errorMsg);
  }
};

/**
 * 廚房備料建議
 */
export const generateKitchenAdvice = async (date: string, mealStats: any, diningList: any[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `今日日期: ${date}, 統計: ${JSON.stringify(mealStats)}`,
      config: {
        systemInstruction: "你是行政主廚，提供專業的備料建議。請使用繁體中文。"
      }
    });
    return response.text || "請參考統計數據進行備料。";
  } catch (error) {
    return "連線問題，請直接參考統計數據。";
  }
};
