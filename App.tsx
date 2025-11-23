
import React, { useState, useEffect } from 'react';
import { Member, MembershipTier, DailyStats, Room, RoomStatus, RoomType, BookingRecord, InventoryItem } from './types';
import Dashboard from './components/Dashboard';
import MemberList from './components/MemberList';
import MemberDetail from './components/MemberDetail';
import AddMemberForm from './components/AddMemberForm';
import RoomManagement from './components/RoomManagement';
import KitchenManagement from './components/KitchenManagement';
import BookingHistory from './components/BookingHistory';
import VoiceAssistant from './components/VoiceAssistant';
import { LayoutDashboard, Users, TentTree, Plus, BedDouble, Menu, X, Utensils, CalendarClock, Download, Upload } from 'lucide-react';
import { GoogleGenAI, FunctionDeclaration } from "@google/genai";

// Mock Initial Member Data
const INITIAL_MEMBERS: Member[] = [
  {
    id: '1',
    name: '林志豪',
    phone: '0912-345-678',
    email: 'lin.c@example.com',
    location: '台北市',
    tier: MembershipTier.PLATINUM,
    joinDate: '2022-05-12',
    totalVisits: 5,
    totalSpend: 85000,
    tags: ['紅酒愛好者', '家庭客', '需要嬰兒床'],
    dietaryRestrictions: ['海鮮過敏'],
    preferences: '喜歡高樓層視野，習慣下午喝手沖咖啡。',
    history: [
      { date: '2023-12-24', stayDuration: 2, accommodationType: '神殿帳', notes: '聖誕節入住，安排了驚喜蛋糕' },
      { date: '2023-08-10', stayDuration: 1, accommodationType: '皇宮帳', notes: '' }
    ],
    notes: '林先生喜歡安靜，不喜歡太靠近公共區域的帳篷。對海鮮非常過敏，請廚房特別注意。'
  },
  {
    id: '2',
    name: '陳怡君',
    phone: '0987-654-321',
    email: 'yichun.chen@example.com',
    location: '新竹市',
    tier: MembershipTier.DIAMOND,
    joinDate: '2021-11-03',
    totalVisits: 12,
    totalSpend: 240000,
    tags: ['VIP', '高消費', '素食'],
    dietaryRestrictions: ['全素'],
    preferences: '每次都需要安排瑜珈墊，喜歡早晨的冥想活動。',
    history: [
      { date: '2024-01-15', stayDuration: 3, accommodationType: '尊爵套房帳', notes: '與朋友慶生' }
    ],
    notes: '陳小姐是我們的VVIP，請務必提前準備好有機花茶。'
  },
  {
    id: '3',
    name: '張建國',
    phone: '0922-111-222',
    email: 'chang.jk@example.com',
    location: '台中市',
    tier: MembershipTier.GOLD,
    joinDate: '2023-01-20',
    totalVisits: 2,
    totalSpend: 32000,
    tags: ['攝影愛好者', '獨旅'],
    dietaryRestrictions: [],
    preferences: '喜歡日出時段攝影，請協助安排面東的帳篷。',
    history: [],
    notes: '張先生有許多昂貴攝影器材，請房務整理時特別小心。'
  }
];

const INITIAL_INVENTORY: InventoryItem[] = [
  // Removed Wagyu Beef as requested
  { id: '2', name: '波士頓龍蝦', category: '海鮮', quantity: 8, unit: '隻', safetyStock: 10, weeklyUsage: 20, consumptionPerGuest: 0.5, logs: [] },
  { id: '3', name: '有機雞蛋', category: '蔬果', quantity: 45, unit: '顆', safetyStock: 30, weeklyUsage: 100, consumptionPerGuest: 1, logs: [] },
  { id: '4', name: '季節時蔬', category: '蔬果', quantity: 12, unit: 'kg', safetyStock: 8, weeklyUsage: 25, consumptionPerGuest: 0.3, logs: [] },
  { id: '5', name: '精選紅酒', category: '酒水', quantity: 24, unit: '瓶', safetyStock: 12, weeklyUsage: 15, consumptionPerGuest: 0.1, logs: [] },
  { id: '6', name: '早餐吐司', category: '乾貨', quantity: 5, unit: '條', safetyStock: 3, weeklyUsage: 10, consumptionPerGuest: 0.1, logs: [] },
];

// Generate Initial Rooms based on user request
const generateRooms = (): Room[] => {
  const rooms: Room[] = [];
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const getBlanketCount = (type: RoomType): number => {
    if (type === RoomType.PALACE_TENT || type === RoomType.VIP_TENT) return 2;
    return 1;
  };

  const createRoom = (id: string, code: string, type: RoomType): Room => {
    const blanketCount = getBlanketCount(type);
    return {
      id, code, type, 
      status: RoomStatus.VACANT, 
      extraGuests: 0,
      actualAdults: 0,
      actualChildren: 0,
      electricBlankets: {
        total: blanketCount,
        current: blanketCount,
        broken: 0 // Default 0 broken
      }
    };
  };

  // 1-11 Double Tents
  for (let i = 1; i <= 11; i++) {
    rooms.push(createRoom(`d-${i}`, `${i}`, RoomType.DOUBLE_TENT));
  }
  
  // 12-16 Palace Tents (5 units)
  for (let i = 12; i <= 16; i++) {
    rooms.push(createRoom(`p-${i}`, `${i}`, RoomType.PALACE_TENT));
  }

  // VIP 1-3
  for (let i = 1; i <= 3; i++) {
    rooms.push(createRoom(`v-${i}`, `尊${i}`, RoomType.VIP_TENT));
  }

  // Water House 1-4
  for (let i = 1; i <= 4; i++) {
    rooms.push(createRoom(`w-${i}`, `水${i}`, RoomType.WATER_HOUSE));
  }

  // Cypress 201-204
  for (let i = 201; i <= 204; i++) {
    rooms.push(createRoom(`c-${i}`, `${i}`, RoomType.CYPRESS_ROOM));
  }

  // Set mock statuses for demo
  rooms[1].status = RoomStatus.OCCUPIED; 
  rooms[1].currentGuestName = '林志豪';
  rooms[1].checkInDate = today;
  rooms[1].checkOutDate = tomorrow; // Mock upcoming checkout
  rooms[1].extraGuests = 1;
  rooms[1].actualAdults = 2;
  rooms[1].actualChildren = 1;

  rooms[12].status = RoomStatus.DIRTY; 

  rooms[13].status = RoomStatus.OCCUPIED; 
  rooms[13].currentGuestName = '陳怡君';
  rooms[13].checkInDate = yesterday; 
  rooms[13].electricBlankets.current = 1; 

  rooms[0].status = RoomStatus.DIRTY; 

  return rooms;
};

// Generate 30 days of mock data for the chart
const generateDailyStats = (): DailyStats[] => {
  const stats: DailyStats[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Simulate weekend peaks
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseVisitors = isWeekend ? 40 : 15;
    const randomVariation = Math.floor(Math.random() * 10);
    const visitors = baseVisitors + randomVariation;
    const checkIns = Math.ceil(visitors / 2.5); 

    stats.push({
      date: dateStr,
      visitors: visitors,
      checkIns: checkIns,
      occupancyRate: Math.min(100, Math.round((checkIns / 27) * 100)),
      weather: isWeekend ? '晴朗' : '多雲'
    });
  }
  return stats;
};

// Generate Mock Booking History
const generateMockHistory = (initialRooms: Room[]): BookingRecord[] => {
  const records: BookingRecord[] = [];
  const today = new Date();
  const guests = ["王小明", "李大華", "張美玲", "陳志強", "林雅婷", "劉德華", "蔡依林"];
  
  for (let i = 90; i > 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6 || d.getDay() === 5;
    const occupancyCount = isWeekend ? 15 : 5; 
    
    const shuffledRooms = [...initialRooms].sort(() => 0.5 - Math.random()).slice(0, occupancyCount);
    
    shuffledRooms.forEach(room => {
      records.push({
        id: `hist-${dateStr}-${room.code}`,
        roomCode: room.code,
        roomType: room.type,
        guestName: guests[Math.floor(Math.random() * guests.length)],
        checkInDate: dateStr,
        extraGuests: Math.floor(Math.random() * 3), 
        notes: Math.random() > 0.8 ? "慶生, 需要蛋糕" : undefined
      });
    });
  }
  return records;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'members' | 'rooms' | 'kitchen' | 'history'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());

  // Helper to load state safely WITHOUT strict version check
  // This ensures that if data exists, it is loaded, preventing resets.
  const loadState = <T,>(key: string, defaultVal: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
         return JSON.parse(saved);
      }
      return defaultVal;
    } catch (e) { return defaultVal; }
  };

  // --- Lazy Initialization for State Persistence ---
  const [members, setMembers] = useState<Member[]>(() => loadState('glamping_members', INITIAL_MEMBERS));
  const [rooms, setRooms] = useState<Room[]>(() => loadState('glamping_rooms', generateRooms()));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadState('glamping_inventory', INITIAL_INVENTORY));
  const [bookingRecords, setBookingRecords] = useState<BookingRecord[]>(() => loadState('glamping_history', generateMockHistory(generateRooms())));
  const [dailyStats, setDailyStats] = useState<DailyStats[]>(() => loadState('glamping_stats', generateDailyStats()));
  const [totalBlanketStock, setTotalBlanketStock] = useState<number>(() => {
     try {
       const saved = localStorage.getItem('glamping_blanket_stock');
       return saved ? parseInt(saved, 10) : 35;
     } catch (e) { return 35; }
  });
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // --- Auto-Save Effects ---
  useEffect(() => {
      localStorage.setItem('glamping_rooms', JSON.stringify(rooms));
      setLastSaved(new Date());
  }, [rooms]);

  useEffect(() => {
      localStorage.setItem('glamping_history', JSON.stringify(bookingRecords));
      setLastSaved(new Date());
  }, [bookingRecords]);

  useEffect(() => {
      localStorage.setItem('glamping_inventory', JSON.stringify(inventory));
      setLastSaved(new Date());
  }, [inventory]);

  useEffect(() => {
      localStorage.setItem('glamping_blanket_stock', totalBlanketStock.toString());
      setLastSaved(new Date());
  }, [totalBlanketStock]);

  useEffect(() => {
      localStorage.setItem('glamping_members', JSON.stringify(members));
      setLastSaved(new Date());
  }, [members]);

  useEffect(() => {
      localStorage.setItem('glamping_stats', JSON.stringify(dailyStats));
      setLastSaved(new Date());
  }, [dailyStats]);


  // Automatic Check-out Logic
  useEffect(() => {
    const checkAutoClean = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = now.toISOString().split('T')[0];

      // Auto checkout after 11:00 AM for guests from previous days
      if (currentHour >= 11) {
        setRooms(prevRooms => prevRooms.map(room => {
          if (room.status === RoomStatus.OCCUPIED && room.checkInDate && room.checkInDate !== todayStr) {
            return {
              ...room,
              status: RoomStatus.DIRTY,
              checkInDate: undefined,
              checkOutDate: undefined,
              currentGuestName: undefined,
              currentGuestId: undefined,
              extraGuests: 0,
              actualAdults: 0,
              actualChildren: 0,
              notes: (room.notes ? room.notes + '\n' : '') + '系統自動退房'
            };
          }
          return room;
        }));
      }
    };

    const interval = setInterval(checkAutoClean, 60000); // Check every minute
    checkAutoClean(); // Run immediately

    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---

  const handleUpdateRoomStatus = (roomId: string, newStatus: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number, checkOutDate?: string) => {
    setRooms(prev => {
      const roomIndex = prev.findIndex(r => r.id === roomId);
      if (roomIndex === -1) return prev;
      
      const room = prev[roomIndex];
      const updatedRoom = { ...room, status: newStatus };

      if (newStatus === RoomStatus.OCCUPIED) {
         updatedRoom.currentGuestName = guestName || '貴賓';
         updatedRoom.extraGuests = extraGuests !== undefined ? extraGuests : room.extraGuests;
         updatedRoom.actualAdults = actualAdults !== undefined ? actualAdults : 0;
         updatedRoom.actualChildren = actualChildren !== undefined ? actualChildren : 0;
         updatedRoom.checkInDate = new Date().toISOString().split('T')[0];
         
         // Default to tomorrow if not specified
         if (checkOutDate) {
            updatedRoom.checkOutDate = checkOutDate;
         } else {
            const nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + 1);
            updatedRoom.checkOutDate = nextDay.toISOString().split('T')[0];
         }
         
         // Add History Record
         const newRecord: BookingRecord = {
           id: `hist-${Date.now()}`,
           roomCode: room.code,
           roomType: room.type,
           guestName: updatedRoom.currentGuestName,
           checkInDate: updatedRoom.checkInDate,
           extraGuests: updatedRoom.extraGuests,
           notes: room.notes
         };
         setBookingRecords(curr => [newRecord, ...curr]);

      } else if (newStatus === RoomStatus.VACANT || newStatus === RoomStatus.DIRTY) {
         // Clear data when vacating
         updatedRoom.currentGuestName = undefined;
         updatedRoom.currentGuestId = undefined;
         updatedRoom.checkInDate = undefined;
         updatedRoom.checkOutDate = undefined;
         updatedRoom.extraGuests = 0;
         updatedRoom.actualAdults = 0;
         updatedRoom.actualChildren = 0;
      }

      const newRooms = [...prev];
      newRooms[roomIndex] = updatedRoom;
      return newRooms;
    });
  };

  const handleBatchUpdateStatus = (updates: { roomId: string, status: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number, checkOutDate?: string }[]) => {
      setRooms(prev => {
        const newRooms = [...prev];
        const newHistory: BookingRecord[] = [];

        updates.forEach(u => {
            const idx = newRooms.findIndex(r => r.id === u.roomId);
            if (idx !== -1) {
                const room = newRooms[idx];
                const updatedRoom = { ...room, status: u.status };

                if (u.status === RoomStatus.OCCUPIED) {
                    updatedRoom.currentGuestName = u.guestName || '貴賓';
                    updatedRoom.extraGuests = u.extraGuests !== undefined ? u.extraGuests : room.extraGuests;
                    updatedRoom.actualAdults = u.actualAdults !== undefined ? u.actualAdults : 0;
                    updatedRoom.actualChildren = u.actualChildren !== undefined ? u.actualChildren : 0;
                    updatedRoom.checkInDate = new Date().toISOString().split('T')[0];
                    
                     // Default to tomorrow if not specified
                    if (u.checkOutDate) {
                        updatedRoom.checkOutDate = u.checkOutDate;
                    } else {
                        const nextDay = new Date();
                        nextDay.setDate(nextDay.getDate() + 1);
                        updatedRoom.checkOutDate = nextDay.toISOString().split('T')[0];
                    }

                    // Prepare history
                    newHistory.push({
                       id: `hist-${Date.now()}-${room.code}`,
                       roomCode: room.code,
                       roomType: room.type,
                       guestName: updatedRoom.currentGuestName,
                       checkInDate: updatedRoom.checkInDate,
                       extraGuests: updatedRoom.extraGuests,
                       notes: room.notes
                    });
                } else if (u.status === RoomStatus.VACANT || u.status === RoomStatus.DIRTY) {
                    updatedRoom.currentGuestName = undefined;
                    updatedRoom.currentGuestId = undefined;
                    updatedRoom.checkInDate = undefined;
                    updatedRoom.checkOutDate = undefined;
                    updatedRoom.extraGuests = 0;
                    updatedRoom.actualAdults = 0;
                    updatedRoom.actualChildren = 0;
                }
                
                newRooms[idx] = updatedRoom;
            }
        });
        
        // Batch update history
        if (newHistory.length > 0) {
           setBookingRecords(curr => [...newHistory, ...curr]);
        }

        return newRooms;
      });
  };

  const handleDeleteHistoryRecord = (id: string) => {
    if (window.confirm("確定要刪除此筆歷史紀錄嗎？刪除後無法復原。")) {
      setBookingRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleDeleteInventoryItem = (id: string) => {
    setInventory(prev => {
        const targetId = String(id);
        const next = prev.filter(item => String(item.id) !== targetId);
        
        // Direct write to ensure persistence immediately
        try {
            localStorage.setItem('glamping_inventory', JSON.stringify(next));
        } catch(e) { console.error("Storage write failed", e); }
        
        return next;
    });
  };

  const handleResetInventory = () => {
      if (window.confirm("⚠️ 確定要重置食材庫存嗎？\n這將刪除所有目前的庫存資料並恢復為系統預設值。此動作無法復原。")) {
          setInventory(INITIAL_INVENTORY);
          localStorage.setItem('glamping_inventory', JSON.stringify(INITIAL_INVENTORY));
          alert("✅ 已恢復預設庫存");
      }
  };

  const handleUpdateBlankets = (roomId: string, count: number) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId ? { ...room, electricBlankets: { ...room.electricBlankets, current: count } } : room
    ));
  };

  const handleTransferBlanket = (fromId: string, toId: string) => {
    let success = false;
    setRooms(prev => {
      const fromRoom = prev.find(r => r.id === fromId);
      if (!fromRoom || fromRoom.electricBlankets.current <= 0) return prev;

      success = true;
      return prev.map(r => {
        if (r.id === fromId) return { ...r, electricBlankets: { ...r.electricBlankets, current: r.electricBlankets.current - 1 } };
        if (r.id === toId) return { ...r, electricBlankets: { ...r.electricBlankets, current: r.electricBlankets.current + 1 } };
        return r;
      });
    });
    return success;
  };

  const handleSwapRoom = (oldRoomId: string, newRoomId: string) => {
      setRooms(prev => {
          const oldRoom = prev.find(r => r.id === oldRoomId);
          const newRoom = prev.find(r => r.id === newRoomId);
          
          if (!oldRoom || !newRoom) return prev;

          // Swap logic: Transfer Guest Info
          const guestName = oldRoom.currentGuestName;
          const checkInDate = oldRoom.checkInDate;
          const checkOutDate = oldRoom.checkOutDate;
          const extraGuests = oldRoom.extraGuests;
          const actualAdults = oldRoom.actualAdults;
          const actualChildren = oldRoom.actualChildren;

          return prev.map(r => {
              if (r.id === oldRoomId) {
                  return { 
                      ...r, 
                      status: RoomStatus.DIRTY, 
                      currentGuestName: undefined, 
                      checkInDate: undefined, 
                      checkOutDate: undefined,
                      extraGuests: 0,
                      actualAdults: 0,
                      actualChildren: 0,
                      notes: (r.notes || '') + `\n[系統] 房客 ${guestName} 換房至 ${newRoom.code}` 
                  };
              }
              if (r.id === newRoomId) {
                  return { 
                      ...r, 
                      status: RoomStatus.OCCUPIED, 
                      currentGuestName: guestName,
                      checkInDate: checkInDate,
                      checkOutDate: checkOutDate,
                      extraGuests: extraGuests,
                      actualAdults: actualAdults,
                      actualChildren: actualChildren,
                  };
              }
              return r;
          });
      });
  };

  const handleBlanketCondition = (roomId: string, action: 'BREAK' | 'FIX') => {
    setRooms(prev => prev.map(room => {
       if (room.id !== roomId) return room;
       
       const { current, broken } = room.electricBlankets;
       if (action === 'BREAK' && current > 0) {
          return { ...room, electricBlankets: { ...room.electricBlankets, current: current - 1, broken: broken + 1 } };
       }
       if (action === 'FIX' && broken > 0) {
          return { ...room, electricBlankets: { ...room.electricBlankets, current: current + 1, broken: broken - 1 } };
       }
       return room;
    }));
  };

  // --- Data Export & Import ---
  const handleExportData = () => {
    const data = {
      version: 'Persistent', // Hardcoded version string
      timestamp: new Date().toISOString(),
      rooms,
      inventory,
      bookingRecords,
      members,
      dailyStats,
      totalBlanketStock
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `glamping-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const data = JSON.parse(content);
          
          if (data.rooms && data.inventory) {
            if (window.confirm(`確定要還原 ${data.timestamp} 的備份嗎？目前的資料將被覆蓋。`)) {
              setRooms(data.rooms);
              setInventory(data.inventory);
              setBookingRecords(data.bookingRecords || []);
              setMembers(data.members || []);
              setDailyStats(data.dailyStats || generateDailyStats());
              setTotalBlanketStock(data.totalBlanketStock || 35);
              alert("✅ 資料還原成功！");
            }
          } else {
            alert("❌ 檔案格式錯誤");
          }
        } catch (err) {
          alert("❌ 讀取備份檔失敗");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  // --- Voice Handlers ---
  const handleVoiceNavigation = (view: 'dashboard' | 'members' | 'rooms' | 'kitchen') => {
     setCurrentView(view);
     setIsMobileMenuOpen(false); // Close menu if open
  };

  const handleVoiceRoomAction = (code: string, action: 'CHECKIN' | 'CHECKOUT' | 'CLEAN') => {
     const room = rooms.find(r => r.code === code);
     if (!room) return `找不到房號 ${code}`;

     if (action === 'CLEAN') {
        if (room.status !== RoomStatus.DIRTY) return `${code} 目前不是待清潔狀態`;
        handleUpdateRoomStatus(room.id, RoomStatus.VACANT);
        return `${code} 已設為空房`;
     }
     if (action === 'CHECKOUT') {
        if (room.status !== RoomStatus.OCCUPIED) return `${code} 目前無人入住`;
        handleUpdateRoomStatus(room.id, RoomStatus.DIRTY);
        return `${code} 已退房`;
     }
     if (action === 'CHECKIN') {
        if (room.status !== RoomStatus.VACANT) return `${code} 目前無法入住`;
        handleUpdateRoomStatus(room.id, RoomStatus.OCCUPIED);
        return `${code} 已入住`;
     }
     return "未知指令";
  };

  const handleVoiceQuery = () => {
    // Generate detailed stats for AI context
    const stats: any = {
      total: rooms.length,
      occupied: rooms.filter(r => r.status === RoomStatus.OCCUPIED).length,
      dirty: rooms.filter(r => r.status === RoomStatus.DIRTY).length,
      vacant: rooms.filter(r => r.status === RoomStatus.VACANT).length,
      inventory: { blankets: totalBlanketStock },
      roomTypes: {}
    };

    // Granular breakdown by room type
    Object.values(RoomType).forEach(type => {
       const typeRooms = rooms.filter(r => r.type === type);
       stats.roomTypes[type] = {
         total: typeRooms.length,
         vacant: typeRooms.filter(r => r.status === RoomStatus.VACANT).length,
         occupied: typeRooms.filter(r => r.status === RoomStatus.OCCUPIED).length,
         dirty: typeRooms.filter(r => r.status === RoomStatus.DIRTY).length
       };
    });
    
    // Return structured JSON string for LLM parsing
    return JSON.stringify(stats);
  };

  return (
    <div className="flex h-screen bg-glamping-50 overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-glamping-900 text-white z-50 flex items-center justify-between px-4 shadow-md">
         <div className="flex items-center gap-2 font-serif font-bold text-lg text-luxury-gold">
            <TentTree size={24} /> 愛上喜翁
         </div>
         <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
         </button>
      </div>

      {/* Sidebar Navigation */}
      <div className={`
        fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0 transition duration-200 ease-in-out z-50
        w-64 bg-glamping-900 text-white flex flex-col shadow-2xl md:shadow-none
      `}>
        <div className="p-6 border-b border-glamping-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-luxury-gold p-2 rounded-lg">
              <TentTree size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-wider text-luxury-gold">愛上喜翁</h1>
              <p className="text-xs text-glamping-400">尊榮會員管家</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-glamping-400">
             <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === 'dashboard' ? 'bg-luxury-gold text-white shadow-lg' : 'text-glamping-300 hover:bg-glamping-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} className={currentView === 'dashboard' ? 'animate-pulse' : ''} />
            <span className="font-medium tracking-wide">營運戰情室</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('rooms'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'rooms' ? 'bg-luxury-gold text-white shadow-lg' : 'text-glamping-300 hover:bg-glamping-800 hover:text-white'}`}
          >
            <BedDouble size={20} />
            <span className="font-medium tracking-wide">客房管理</span>
          </button>

          <button 
            onClick={() => { setCurrentView('kitchen'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'kitchen' ? 'bg-luxury-gold text-white shadow-lg' : 'text-glamping-300 hover:bg-glamping-800 hover:text-white'}`}
          >
            <Utensils size={20} />
            <span className="font-medium tracking-wide">廚房與庫存</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('members'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'members' ? 'bg-luxury-gold text-white shadow-lg' : 'text-glamping-300 hover:bg-glamping-800 hover:text-white'}`}
          >
            <Users size={20} />
            <span className="font-medium tracking-wide">會員名錄</span>
          </button>

          <button 
            onClick={() => { setCurrentView('history'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'history' ? 'bg-luxury-gold text-white shadow-lg' : 'text-glamping-300 hover:bg-glamping-800 hover:text-white'}`}
          >
            <CalendarClock size={20} />
            <span className="font-medium tracking-wide">歷史紀錄</span>
          </button>
        </nav>

        <div className="p-4 border-t border-glamping-700 space-y-3">
          <div className="flex gap-2">
             <button 
              onClick={handleExportData}
              className="flex-1 flex items-center justify-center gap-1 bg-glamping-800 text-glamping-300 py-2 rounded-lg text-xs hover:bg-glamping-700 hover:text-white transition"
             >
                <Download size={14} /> 備份
             </button>
             <button 
              onClick={handleImportData}
              className="flex-1 flex items-center justify-center gap-1 bg-glamping-800 text-glamping-300 py-2 rounded-lg text-xs hover:bg-glamping-700 hover:text-white transition"
             >
                <Upload size={14} /> 還原
             </button>
          </div>
          
          <div className="bg-glamping-800 rounded-xl p-4 border border-glamping-700">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-glamping-400 font-bold uppercase">系統狀態</p>
                <div className="flex items-center gap-1.5 bg-glamping-900 px-2 py-0.5 rounded-full border border-glamping-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] text-emerald-400 font-bold tracking-wider">雲端同步</span>
                </div>
            </div>
            
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-glamping-300">
                   <span>最後存檔</span>
                   <span className="font-mono">{lastSaved.toLocaleTimeString()}</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
          {currentView === 'dashboard' && <Dashboard members={members} dailyStats={dailyStats} rooms={rooms} />}
          
          {currentView === 'members' && !selectedMember && (
            <div className="h-full flex flex-col">
              <div className="flex justify-end mb-4">
                 <button 
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 bg-glamping-800 text-white px-4 py-2 rounded-lg hover:bg-glamping-900 transition shadow-md font-bold text-sm"
                >
                  <Plus size={18} /> 新增會員
                </button>
              </div>
              <MemberList 
                members={members} 
                onSelectMember={setSelectedMember} 
              />
            </div>
          )}

          {currentView === 'members' && selectedMember && (
            <MemberDetail 
              member={selectedMember} 
              onBack={() => setSelectedMember(null)}
              onUpdateMember={(updated) => {
                setMembers(members.map(m => m.id === updated.id ? updated : m));
                setSelectedMember(updated);
              }}
            />
          )}

          {currentView === 'rooms' && (
            <RoomManagement 
              rooms={rooms}
              totalBlanketStock={totalBlanketStock}
              onUpdateStatus={handleUpdateRoomStatus}
              onBatchUpdateStatus={handleBatchUpdateStatus}
              onUpdateBlankets={handleUpdateBlankets}
              onTransferBlanket={handleTransferBlanket}
              onSwapRoom={handleSwapRoom}
              onBlanketCondition={handleBlanketCondition}
              onUpdateTotalBlanketStock={setTotalBlanketStock}
            />
          )}

          {currentView === 'kitchen' && (
             <KitchenManagement 
                rooms={rooms} 
                members={members}
                inventory={inventory}
                onUpdateInventory={setInventory}
                onDeleteInventoryItem={handleDeleteInventoryItem}
                onResetInventory={handleResetInventory}
             />
          )}

          {currentView === 'history' && (
             <BookingHistory 
               records={bookingRecords} 
               onDeleteRecord={handleDeleteHistoryRecord}
             />
          )}
        </div>
      </main>

      {/* Voice Assistant Overlay */}
      <VoiceAssistant 
         onNavigate={handleVoiceNavigation} 
         onRoomAction={handleVoiceRoomAction}
         onGetStats={handleVoiceQuery}
      />

      {/* Add Member Modal */}
      {showAddForm && (
        <AddMemberForm 
          onSave={(newMember) => {
            setMembers([newMember, ...members]);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};

export default App;
