
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Member, MembershipTier, AIAnalysisResult, DailyStats } from "../types";

// ============================================================================
// 👇👇👇 請將您的 API Key 直接貼在下方的雙引號中 👇👇👇
const HARDCODED_API_KEY = "AIzaSyAZqBjveTcYrefMo4dopnekpKjv1kWHgsE"; 
// ============================================================================

// Helper to safely initialize Gemini API only when needed
const getAI = () => {
  // 優先順序：
  // 1. 程式碼中直接填寫的 Key (方便快速測試/部署)
  // 2. 環境變數 process.env.API_KEY (Vercel 設定)
  const apiKey = HARDCODED_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: API_KEY is missing. Please check services/geminiService.ts or Environment Variables.");
    // 這裡不拋出錯誤，讓它回傳一個空的實例，雖然呼叫會失敗，但至少不會在初始化時 crash
  }
  
  return new GoogleGenAI({ apiKey: apiKey || "" });
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
      summary: "無法連接至 AI 服務，請確認 API Key 是否正確。",
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
          adults: { type: Type.INTEGER, description: "大人人數 (Adults). STRICTLY PARSE NUMBERS. '2大1小' -> 2." },
          children: { type: Type.INTEGER, description: "小孩人數 (Children). STRICTLY PARSE NUMBERS. '2大1小' -> 1." },
          notes: { type: Type.STRING, description: "備註 (e.g., '不吃牛', '加被子', '全素')" }
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
          text: `You are a professional data entry specialist. Analyze this Glamping Booking Sheet image.
          
          **CRITICAL TASK: NUMBER RECOGNITION (人數辨識)**
          You must correctly extract the number of Adults and Children from the columns (usually labeled '人數', '大人/小孩', or '備註').
          
          **Parsing Rules for Occupancy:**
          1. **"2大1小"** => adults: 2, children: 1
          2. **"2+1"** => adults: 2, children: 1
          3. **"2"** or **"2位"** or **"2人"** => adults: 2, children: 0
          4. **"4大"** => adults: 4, children: 0
          5. **"3+1(小)"** => adults: 3, children: 1
          6. **"1泊2食 2位"** => adults: 2, children: 0
          
          **Other Fields:**
          - **Room Code (房號)**: Look for '房號', '帳號', 'No.'. Convert chinese numerals if needed (e.g., '尊一' -> '尊1').
          - **Guest Name**: Extract the main contact name.
          - **Date**: Extract the check-in date (Format YYYY-MM-DD). If year is missing, assume current year.
          - **Notes**: Extract dietary restrictions (素食, 不吃牛) or special requests.

          Return a JSON Array.`
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
    // Throwing error allows the UI to catch it and show an alert
    throw new Error("圖片分析失敗。請確認：1. 是否已在 geminiService.ts 填寫 HARDCODED_API_KEY。 2. 圖片是否清晰。");
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
