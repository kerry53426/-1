
export enum MembershipTier {
  CLASSIC = '經典會員',
  GOLD = '黃金會員',
  PLATINUM = '白金會員',
  DIAMOND = '黑鑽尊榮',
}

export interface MemberHistory {
  date: string;
  stayDuration: number; // nights
  accommodationType: string; // e.g., "神殿帳", "皇宮帳"
  notes: string;
}

export interface Member {
  id: string;
  name: string;
  location: string; // New: Region/City
  phone: string;
  email: string;
  birthday?: string;
  tier: MembershipTier;
  joinDate: string;
  totalVisits: number;
  totalSpend: number;
  tags: string[]; // e.g., "素食", "喜愛紅酒", "親子"
  dietaryRestrictions: string[];
  specialRequests?: string[]; // New: Specific service needs e.g. "Late Checkout"
  preferences: string; // AI summarized preferences
  history: MemberHistory[];
  notes: string; // Raw staff notes
}

export interface AIAnalysisResult {
  dietaryRestrictions: string[];
  specialRequests: string[]; // New field for extraction
  tags: string[];
  summary: string;
  suggestedActions: string[];
}

// Operational Dashboard
export interface DailyStats {
  date: string;
  visitors: number; // Total people
  checkIns: number; // Number of bookings/tents
  occupancyRate: number; // Percentage
  weather: string;
}

// Room Management
export enum RoomStatus {
  VACANT = '空房',       // Clean and ready
  OCCUPIED = '入住中',   // Guest inside
  DIRTY = '待清潔',      // Guest left, needs cleaning
  MAINTENANCE = '維護中' // Broken/Renovation
}

export enum RoomType {
  DOUBLE_TENT = '雙人帳篷',
  PALACE_TENT = '皇宮四人帳',
  VIP_TENT = '尊爵四人帳',
  WATER_HOUSE = '水屋',
  CYPRESS_ROOM = '檜木房'
}

export interface Room {
  id: string;
  code: string; // e.g. "1", "尊1", "201"
  type: RoomType;
  status: RoomStatus;
  currentGuestId?: string; // Link to Member ID
  currentGuestName?: string; // Display name for quick access
  checkInDate?: string; // ISO Date string YYYY-MM-DD
  checkOutDate?: string; // ISO Date string YYYY-MM-DD (Expected checkout)
  
  // Occupancy Data
  extraGuests: number; // Deprecated logic, kept for backward compatibility mostly
  actualAdults?: number; // New: Exact number of adults
  actualChildren?: number; // New: Exact number of children

  electricBlankets: {
    total: number;   // Standard quantity (1 or 2)
    current: number; // Working quantity available
    broken: number;  // Damaged quantity (needs repair)
  };
  notes?: string;
}

// Booking History Log
export interface BookingRecord {
  id: string;
  roomCode: string;
  roomType: string;
  guestName: string;
  checkInDate: string;
  extraGuests: number;
  notes?: string;
}

// Kitchen & Inventory
export interface InventoryLog {
  id: string;
  date: string;
  type: 'USAGE' | 'RESTOCK' | 'ADJUSTMENT' | 'SPOILED' | 'STAFF_MEAL';
  reason: string;
  amount: number; // Positive or negative
  balanceAfter: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: '肉品' | '海鮮' | '蔬果' | '乾貨' | '酒水' | '消耗品';
  quantity: number;
  unit: string;
  safetyStock: number;
  weeklyUsage: number;
  consumptionPerGuest: number;
  logs: InventoryLog[];
}
