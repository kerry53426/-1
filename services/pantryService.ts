
const PANTRY_ID = "085e1276-c22a-4c58-9a2b-3b40d8fce6d9";
const BASKET_NAME = "glamping_data_v1";
const BASE_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

export interface GlampingData {
  rooms: any[];
  members: any[];
  inventory: any[];
  bookingRecords: any[];
  totalBlanketStock: number;
  lastUpdated: string;
}

export const fetchGlampingData = async (): Promise<GlampingData | null> => {
  try {
    // 移除逾時限制，持續等待直到資料庫回應
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure we get fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn("Pantry basket not found, initializing new data.");
        return null;
      }
      throw new Error(`Pantry API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as GlampingData;
  } catch (error: any) {
    console.error("Failed to fetch data from Pantry:", error);
    // Return null to trigger default data generation instead of crashing
    return null;
  }
};

export const saveGlampingData = async (data: GlampingData): Promise<boolean> => {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Pantry Save Error: ${response.status} ${response.statusText}`);
    }
    return true;
  } catch (error) {
    console.error("Failed to save data to Pantry:", error);
    return false;
  }
};
