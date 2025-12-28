import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Member, MembershipTier, AIAnalysisResult, DailyStats } from "../types";

// Helper to safely initialize Gemini API only when needed
// This prevents "ReferenceError: process is not defined" from crashing the app on load
const getAI = () => {
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    console.warn("Failed to read process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Analyzes unstructured staff notes to extract structured preferences,
 * dietary restrictions, and suggested tags.
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

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      dietaryRestrictions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of dietary restrictions or allergies found in the text (e.g., 'No Peanuts', 'Vegetarian')."
      },
      specialRequests: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Specific logistical or service requests mentioned (e.g., 'Late checkout', 'Extra pillows', 'Baby cot', 'Airport pickup')."
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Categorization tags for the member (e.g., 'Family', 'Anniversary', 'Wine Lover', 'High Spender')."
      },
      summary: {
        type: Type.STRING,
        description: "A concise, professional summary of the member's preferences and style."
      },
      suggestedActions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 suggested actions for staff to prepare for the next visit (e.g., 'Prepare vegan menu', 'Arrange birthday cake')."
      }
    },
    required: ["dietaryRestrictions", "specialRequests", "tags", "summary", "suggestedActions"]
  };

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following customer notes for a luxury glamping site. Extract key information into JSON format.
      
      Notes: "${notes}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an expert concierge at a luxury glamping resort in Taiwan. Analyze customer notes to help staff provide perfect service. Return Chinese (Traditional) text for values."
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as AIAnalysisResult;
    }
    throw new Error("No text returned from Gemini");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      dietaryRestrictions: [],
      specialRequests: [],
      tags: ["AI分析失敗"],
      summary: "無法連接至 AI 服務，請稍後再試。",
      suggestedActions: []
    };
  }
};

/**
 * Generates a personalized welcome email/message for a member.
 */
export const generateWelcomeMessage = async (member: Member): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write a warm, luxurious, and personalized welcome back message (or new member welcome) for: ${JSON.stringify({
        name: member.name,
        tier: member.tier,
        visits: member.totalVisits,
        preferences: member.preferences,
        lastVisit: member.history.length > 0 ? member.history[0].date : "N/A"
      })}`,
      config: {
        systemInstruction: "You are the General Manager of 'Ai Shang Xi Weng' (愛上喜翁), a top-tier luxury glamping site in Taiwan. Write in Traditional Chinese. The tone should be elegant, poetic (referencing nature, mountains, clouds), and very polite. Keep it under 150 words."
      }
    });
    return response.text || "歡迎回到愛上喜翁。";
  } catch (error) {
    console.error("Gemini Message Gen Failed:", error);
    return `親愛的 ${member.name} 您好，歡迎回到愛上喜翁。我們期待為您提供最尊榮的服務。`;
  }
};

/**
 * Generates a daily operational briefing for the owner.
 */
export const generateDailyBriefing = async (stats: DailyStats | null, upcomingVIPs: string[]): Promise<string> => {
  if (!stats) {
    return "今日數據尚未生成，請稍後。";
  }
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a morning briefing for the owner based on today's stats: ${JSON.stringify(stats)} and upcoming VIPs: ${upcomingVIPs.join(', ')}.`,
      config: {
        systemInstruction: "You are the AI Operations Director for a luxury glamping site. Provide a concise, 3-bullet point morning briefing in Traditional Chinese. 1. Highlight occupancy/revenue status. 2. Mention VIPs arriving. 3. Give one operational advice (e.g. weather related or service focus). Tone: Professional, Concise, Executive."
      }
    });
    return response.text || "系統連線中，請稍後查看簡報。";
  } catch (error) {
    return "今日營運數據正常，請注意山區午後雷陣雨。";
  }
};

/**
 * Analyzes an image of a booking sheet/table and extracts structured booking data.
 */
export const analyzeOccupancyImage = async (base64Image: string): Promise<any[]> => {
  try {
    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roomCode: { type: Type.STRING, description: "房號 (e.g., '12', '尊2', '201')" },
          guestName: { type: Type.STRING, description: "入住人姓名" },
          checkInDate: { type: Type.STRING, description: "入住日期 (Format: YYYY-MM-DD)" },
          adults: { type: Type.INTEGER, description: "大人人數 (Adults). If text is '2大1小', value is 2." },
          children: { type: Type.INTEGER, description: "小孩人數 (Children). If text is '2大1小', value is 1." },
          notes: { type: Type.STRING, description: "備註/特殊需求 (e.g., '不吃牛', '加被子', '全素')" }
        },
        required: ["roomCode", "guestName", "checkInDate", "adults", "children"]
      }
    };

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        },
        {
          text: `擔任專業的訂房報表數據輸入員。分析這張台灣豪華露營的訂房報表圖片。
          
          重點規則：
          1. **房號配對**：請辨識 '房號' 欄位。
          2. **人數拆解**：
             - 欄位可能分開為 '大人'/'小孩'。
             - 也可能合併在 '人數' 或 '備註'，例如 "2大1小" (2 Adults, 1 Child), "3+1" (3 Adults, 1 Child), "4位" (4 Adults, 0 Children).
             - 請務必精確拆解數字。
          3. **備註提取**：將飲食禁忌(不吃牛、素食)、壽星、加床等需求放入 notes。
          
          請回傳純 JSON 陣列。`
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
  } catch (error) {
    console.error("Image Analysis Failed:", error);
    throw new Error("圖片分析失敗，請確認圖片清晰度");
  }
};

/**
 * Generates kitchen advice based on meal stats and dining list.
 */
export const generateKitchenAdvice = async (date: string, mealStats: any, diningList: any[]): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `擔任豪華露營區的行政主廚。請根據以下數據生成今日廚房備料建議與注意事項。
      
      日期: ${date}
      
      餐點統計 (Meal Stats):
      ${JSON.stringify(mealStats, null, 2)}
      
      用餐名單 (Guest List):
      ${JSON.stringify(diningList, null, 2)}
      
      請提供給內場人員的簡報，包含：
      1. 總餐量摘要 (早餐/晚餐)
      2. 特殊飲食需求總整理 (過敏、素食細節)
      3. 菜盤備料重點 (葷食/海鮮/素食 的 雙人/三人盤數量)
      4. 針對個別客人的注意事項 (如：某房不吃蔥、某房慶生需蛋糕等)
      
      語氣專業、精簡、條列式。請用繁體中文。`,
      config: {
        systemInstruction: "You are an expert Executive Chef at a luxury glamping resort in Taiwan. Provide concise, operational kitchen advice."
      }
    });

    return response.text || "目前無法產生建議。";
  } catch (error) {
    console.error("Gemini Kitchen Advice Failed:", error);
    return "連線問題，無法產生 AI 建議，請直接參考統計數據。";
  }
};
