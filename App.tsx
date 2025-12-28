
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomStatus, RoomType, BookingRecord } from './types';
import { fetchGlampingData, saveGlampingData, GlampingData } from './services/pantryService';

// Components
import RoomManagement from './components/RoomManagement';
import VoiceAssistant from './components/VoiceAssistant';

// Icons
import { TentTree, Save, CheckCircle, Loader } from 'lucide-react';

// --- Default Data Generators ---

const generateRooms = (): Room[] => {
  const rooms: Room[] = [];
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
      electricBlankets: { total: blanketCount, current: blanketCount, broken: 0 }
    };
  };

  // 1-11 Double Tents
  for (let i = 1; i <= 11; i++) rooms.push(createRoom(`d-${i}`, `${i}`, RoomType.DOUBLE_TENT));
  // 12-16 Palace Tents
  for (let i = 12; i <= 16; i++) rooms.push(createRoom(`p-${i}`, `${i}`, RoomType.PALACE_TENT));
  // VIP 1-3
  for (let i = 1; i <= 3; i++) rooms.push(createRoom(`v-${i}`, `尊${i}`, RoomType.VIP_TENT));
  // Water House 1-4
  for (let i = 1; i <= 4; i++) rooms.push(createRoom(`w-${i}`, `水${i}`, RoomType.WATER_HOUSE));
  // Cypress 201-204
  for (let i = 201; i <= 204; i++) rooms.push(createRoom(`c-${i}`, `${i}`, RoomType.CYPRESS_ROOM));

  return rooms;
};

const App: React.FC = () => {
  // --- Global State ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookingRecords, setBookingRecords] = useState<BookingRecord[]>([]);
  const [totalBlanketStock, setTotalBlanketStock] = useState<number>(35);
  
  // --- Persistence State ---
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'SAVING' | 'SAVED'>('SAVED');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // --- Load Data ---
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const data = await fetchGlampingData();
      
      if (data) {
        setRooms(data.rooms || generateRooms());
        setBookingRecords(data.bookingRecords || []);
        setTotalBlanketStock(data.totalBlanketStock || 35);
        setLastSynced(new Date(data.lastUpdated));
      } else {
        // Fallback / New Setup
        setRooms(generateRooms());
        setBookingRecords([]);
        setTotalBlanketStock(35);
      }
      setIsLoading(false);
      isInitialLoad.current = false;
    };
    initData();
  }, []);

  // --- Auto Save (Debounced) ---
  const triggerSave = useCallback(() => {
    if (isInitialLoad.current || isLoading) return;

    setSyncStatus('SAVING');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      // Note: We pass empty arrays for members/inventory to keep the structure valid
      const dataToSave: GlampingData = {
        rooms,
        members: [], 
        inventory: [],
        bookingRecords,
        totalBlanketStock,
        lastUpdated: new Date().toISOString()
      };

      const success = await saveGlampingData(dataToSave);
      if (success) {
        setSyncStatus('SAVED');
        setLastSynced(new Date());
      }
    }, 1000); // 1 second debounce
  }, [rooms, bookingRecords, totalBlanketStock, isLoading]);

  // Monitor changes
  useEffect(() => { triggerSave(); }, [rooms, bookingRecords, totalBlanketStock, triggerSave]);

  // --- Automatic Check-out Logic (11:00 AM) ---
  useEffect(() => {
    const checkAutoCheckout = () => {
      const now = new Date();
      // Check if current time is past 11:00 AM
      if (now.getHours() >= 11) {
        const todayStr = now.toISOString().split('T')[0];
        
        setRooms(prevRooms => {
          let hasChanges = false;
          const nextRooms = prevRooms.map(room => {
            // Logic: 
            // 1. Room is Occupied
            // 2. Checkout Date is Today (or in the past, implying overdue)
            if (room.status === RoomStatus.OCCUPIED && room.checkOutDate && room.checkOutDate <= todayStr) {
              hasChanges = true;
              return {
                ...room,
                status: RoomStatus.AWAITING_STRIP,
                // Clear guest info as they have checked out
                currentGuestName: undefined,
                currentGuestId: undefined,
                checkInDate: undefined,
                checkOutDate: undefined,
                extraGuests: 0,
                actualAdults: 0,
                actualChildren: 0,
                // Add system note
                notes: (room.notes ? room.notes + '\n' : '') + '[系統] 11:00 自動退房'
              };
            }
            return room;
          });

          if (hasChanges) {
            console.log("Auto-checkout executed at 11:00 AM");
            return nextRooms;
          }
          return prevRooms;
        });
      }
    };

    // Run check immediately on load, then every minute
    checkAutoCheckout();
    const interval = setInterval(checkAutoCheckout, 60000); 

    return () => clearInterval(interval);
  }, []); // Empty dependency array means this timer setup runs once on mount, but setRooms uses functional update so it's safe.

  // --- Room Handlers ---
  const handleUpdateRoomStatus = (roomId: string, newStatus: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number, checkOutDate?: string) => {
    setRooms(prev => prev.map(room => {
       if (room.id !== roomId) return room;
       const updated = { ...room, status: newStatus };
       
       if (newStatus === RoomStatus.OCCUPIED) {
          updated.currentGuestName = guestName || '貴賓';
          updated.extraGuests = extraGuests ?? room.extraGuests;
          updated.actualAdults = actualAdults ?? 0;
          updated.actualChildren = actualChildren ?? 0;
          updated.checkInDate = new Date().toISOString().split('T')[0];
          
          if (checkOutDate) {
              updated.checkOutDate = checkOutDate;
          } else {
              const nextDay = new Date();
              nextDay.setDate(nextDay.getDate() + 1);
              updated.checkOutDate = nextDay.toISOString().split('T')[0];
          }

          // Add History Record
          const newRecord: BookingRecord = {
             id: `hist-${Date.now()}`,
             roomCode: room.code,
             roomType: room.type,
             guestName: updated.currentGuestName,
             checkInDate: updated.checkInDate,
             checkOutDate: updated.checkOutDate,
             extraGuests: updated.extraGuests,
             actualAdults: updated.actualAdults,
             actualChildren: updated.actualChildren,
             notes: room.notes
          };
          setBookingRecords(curr => [newRecord, ...curr]);
       } else if (newStatus === RoomStatus.VACANT || newStatus === RoomStatus.AWAITING_STRIP) {
          updated.currentGuestName = undefined;
          updated.currentGuestId = undefined;
          updated.checkInDate = undefined;
          updated.checkOutDate = undefined;
          updated.extraGuests = 0;
          updated.actualAdults = 0;
          updated.actualChildren = 0;
       }
       return updated;
    }));
  };

  const handleUpdateRoomNotes = (roomId: string, notes: string) => {
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, notes } : r));
  };

  const handleBatchUpdateStatus = (updates: any[]) => {
      setRooms(prev => {
         const newRooms = [...prev];
         const newHistory: BookingRecord[] = [];
         
         updates.forEach(u => {
             const idx = newRooms.findIndex(r => r.id === u.roomId);
             if (idx !== -1) {
                 const room = newRooms[idx];
                 const updated = { ...room, status: u.status };
                 
                 if (u.status === RoomStatus.OCCUPIED) {
                     updated.currentGuestName = u.guestName || '貴賓';
                     updated.extraGuests = u.extraGuests ?? room.extraGuests;
                     updated.actualAdults = u.actualAdults ?? 0;
                     updated.actualChildren = u.actualChildren ?? 0;
                     updated.checkInDate = new Date().toISOString().split('T')[0];
                     updated.checkOutDate = u.checkOutDate;
                     
                     newHistory.push({
                        id: `hist-${Date.now()}-${room.code}`,
                        roomCode: room.code,
                        roomType: room.type,
                        guestName: updated.currentGuestName!,
                        checkInDate: updated.checkInDate!,
                        checkOutDate: updated.checkOutDate,
                        extraGuests: updated.extraGuests,
                        actualAdults: updated.actualAdults,
                        actualChildren: updated.actualChildren,
                        notes: room.notes
                     });
                 } else if (u.status === RoomStatus.VACANT || u.status === RoomStatus.AWAITING_STRIP) {
                    updated.currentGuestName = undefined; updated.checkInDate = undefined; updated.checkOutDate = undefined;
                    updated.extraGuests = 0; updated.actualAdults = 0; updated.actualChildren = 0;
                 }
                 newRooms[idx] = updated;
             }
         });
         
         if (newHistory.length > 0) setBookingRecords(prev => [...newHistory, ...prev]);
         return newRooms;
      });
  };

  const handleSwapRoom = (oldId: string, newId: string) => {
      setRooms(prev => {
          const oldRoom = prev.find(r => r.id === oldId);
          const newRoom = prev.find(r => r.id === newId);
          if (!oldRoom || !newRoom) return prev;
          
          return prev.map(r => {
              if (r.id === oldId) {
                  return { ...r, status: RoomStatus.AWAITING_STRIP, currentGuestName: undefined, checkInDate: undefined, checkOutDate: undefined, extraGuests: 0, actualAdults: 0, actualChildren: 0, notes: (r.notes||'') + `\n[系統] 換房至 ${newRoom.code}` };
              }
              if (r.id === newId) {
                  return { ...r, status: RoomStatus.OCCUPIED, currentGuestName: oldRoom.currentGuestName, checkInDate: oldRoom.checkInDate, checkOutDate: oldRoom.checkOutDate, extraGuests: oldRoom.extraGuests, actualAdults: oldRoom.actualAdults, actualChildren: oldRoom.actualChildren };
              }
              return r;
          });
      });
  };

  // --- Voice Handlers ---
  const handleVoiceAction = (code: string, action: 'CHECKIN' | 'CHECKOUT' | 'CLEAN') => {
      const room = rooms.find(r => r.code === code);
      if (!room) return `找不到房號 ${code}`;
      if (action === 'CHECKIN') {
          handleUpdateRoomStatus(room.id, RoomStatus.OCCUPIED);
          return `${code} 已辦理入住`;
      }
      if (action === 'CHECKOUT') {
          handleUpdateRoomStatus(room.id, RoomStatus.AWAITING_STRIP);
          return `${code} 已退房`;
      }
      if (action === 'CLEAN') {
          handleUpdateRoomStatus(room.id, RoomStatus.VACANT);
          return `${code} 已設為空房`;
      }
      return "未知指令";
  };
  
  const handleVoiceStats = () => {
      const occ = rooms.filter(r => r.status === RoomStatus.OCCUPIED).length;
      const dirty = rooms.filter(r => r.status === RoomStatus.DIRTY).length;
      return `目前入住 ${occ} 間，待清潔 ${dirty} 間。`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-warm-50 text-glamping-800">
         <Loader size={48} className="animate-spin text-luxury-gold mb-4" />
         <h2 className="text-xl font-serif font-bold">正在讀取房況資料...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 font-sans text-glamping-900">
      
      {/* Header */}
      <header className="bg-forest-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-40">
         <div className="flex items-center gap-3">
            <div className="bg-luxury-gold p-2 rounded-lg shadow-lg shrink-0">
               <TentTree size={24} className="text-white" />
            </div>
            <div>
               <h1 className="text-xl font-serif font-bold tracking-wider text-luxury-gold">愛上喜翁</h1>
               <p className="text-[10px] text-glamping-300 tracking-widest opacity-80 uppercase">客房管理系統</p>
            </div>
         </div>

         {/* Sync Status */}
         <div className="flex items-center gap-3 bg-forest-800/50 px-4 py-2 rounded-lg border border-forest-700">
             {syncStatus === 'SAVING' ? (
                 <Loader size={18} className="animate-spin text-luxury-gold" />
             ) : (
                 <CheckCircle size={18} className="text-emerald-400" />
             )}
             <div className="hidden sm:block overflow-hidden">
                 <p className={`text-xs font-bold ${syncStatus === 'SAVING' ? 'text-white' : 'text-emerald-400'}`}>
                     {syncStatus === 'SAVING' ? '儲存中...' : '資料已同步'}
                 </p>
                 {lastSynced && <p className="text-[10px] text-glamping-400 truncate">{lastSynced.toLocaleTimeString()} 更新</p>}
             </div>
         </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-[1600px] mx-auto">
          <RoomManagement 
             rooms={rooms} 
             totalBlanketStock={totalBlanketStock}
             onUpdateStatus={handleUpdateRoomStatus}
             onBatchUpdateStatus={handleBatchUpdateStatus}
             onUpdateRoomNotes={handleUpdateRoomNotes}
             onAddBookingRecords={(recs) => setBookingRecords(prev => [...recs, ...prev])}
             onUpdateBlankets={(id, count) => setRooms(prev => prev.map(r => r.id === id ? { ...r, electricBlankets: { ...r.electricBlankets, current: count } } : r))}
             onTransferBlanket={(from, to) => {
                 let success = false;
                 setRooms(prev => {
                    const f = prev.find(r => r.id === from);
                    if (!f || f.electricBlankets.current <= 0) return prev;
                    success = true;
                    return prev.map(r => {
                        if (r.id === from) return { ...r, electricBlankets: { ...r.electricBlankets, current: r.electricBlankets.current - 1 } };
                        if (r.id === to) return { ...r, electricBlankets: { ...r.electricBlankets, current: r.electricBlankets.current + 1 } };
                        return r;
                    });
                 });
                 return success;
             }}
             onSwapRoom={handleSwapRoom}
             onBlanketCondition={(id, action) => setRooms(prev => prev.map(r => {
                 if (r.id !== id) return r;
                 const { current, broken } = r.electricBlankets;
                 if (action === 'BREAK' && current > 0) return { ...r, electricBlankets: { ...r.electricBlankets, current: current - 1, broken: broken + 1 } };
                 if (action === 'FIX' && broken > 0) return { ...r, electricBlankets: { ...r.electricBlankets, current: current + 1, broken: broken - 1 } };
                 return r;
             }))}
             onUpdateTotalBlanketStock={setTotalBlanketStock}
          />
      </main>
      
      <VoiceAssistant onRoomAction={handleVoiceAction} onGetStats={handleVoiceStats} onNavigate={() => {}} />
    </div>
  );
};

export default App;
