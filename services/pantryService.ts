
const PANTRY_ID = "085e1276-c22a-4c58-9a2b-3b40d8fce6d9";
const BASKET_NAME = "glamping_data_v1";
const BASE_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;
const LOCAL_STORAGE_KEY = "glamping_app_data_v1_backup";

export interface GlampingData {
  rooms: any[];
  members: any[];
  inventory: any[];
  bookingRecords: any[];
  totalBlanketStock: number;
  lastUpdated: string;
}

export const fetchGlampingData = async (): Promise<GlampingData | null> => {
  let localData: GlampingData | null = null;
  let remoteData: GlampingData | null = null;

  // 1. Try Local Storage (Fastest & Offline Support)
  try {
    const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localStr) {
      localData = JSON.parse(localStr);
    }
  } catch (e) {
    console.warn("LocalStorage read error:", e);
  }

  // 2. Try Pantry API (Cloud Sync)
  try {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      remoteData = await response.json();
    } else {
      console.warn(`Pantry API Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn("Failed to fetch from Pantry (likely network issue or CORS), falling back to local data.", error);
  }

  // 3. Conflict Resolution: Use the most recent data
  if (remoteData && localData) {
    const remoteTime = new Date(remoteData.lastUpdated).getTime();
    const localTime = new Date(localData.lastUpdated).getTime();
    
    // If remote is newer, use it. Otherwise trust local (user might have worked offline).
    return remoteTime >= localTime ? remoteData : localData;
  }

  // 4. Return whatever we have
  return remoteData || localData;
};

export const saveGlampingData = async (data: GlampingData): Promise<boolean> => {
  // 1. Always save to Local Storage first (Safety Net)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("LocalStorage save failed:", e);
  }

  // 2. Try syncing to Pantry API
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Pantry Save Error: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.warn("Failed to sync to Pantry (running in offline mode):", error);
    // Return true so the UI shows "Saved" state based on local persistence
    return true;
  }
};
