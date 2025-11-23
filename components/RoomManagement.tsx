
import React, { useState, useMemo, useEffect } from 'react';
import { Room, RoomStatus, RoomType } from '../types';
import { BedDouble, Droplets, Home, Tent, TreePine, Brush, CheckCircle, User, AlertCircle, ArrowRightLeft, LogOut, X, ArrowRight, ThermometerSnowflake, Wrench, Zap, Package, Search, Warehouse, Crown, ChevronDown, ChevronUp, Settings2, Layers, CheckSquare, Save, AlertTriangle, FileInput, Camera, Calendar } from 'lucide-react';
import OccupancyImportModal, { ParsedBooking } from './OccupancyImportModal';

interface RoomManagementProps {
  rooms: Room[];
  onUpdateStatus: (roomId: string, newStatus: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number, checkOutDate?: string) => void;
  onBatchUpdateStatus: (updates: { roomId: string, status: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number, checkOutDate?: string }[]) => void;
  onUpdateBlankets: (roomId: string, count: number) => void;
  onTransferBlanket: (fromId: string, toId: string) => boolean;
  onSwapRoom: (oldRoomId: string, newRoomId: string) => void;
  onBlanketCondition: (roomId: string, action: 'BREAK' | 'FIX') => void;
  totalBlanketStock: number;
  onUpdateTotalBlanketStock: (count: number) => void;
}

// Helper to normalize Chinese numbers to Arabic for room codes (e.g., 尊一 -> 尊1)
const normalizeRoomCode = (code: string): string => {
  return code
    .replace(/一/g, '1')
    .replace(/二/g, '2')
    .replace(/三/g, '3')
    .replace(/四/g, '4')
    .replace(/五/g, '5')
    .replace(/六/g, '6')
    .replace(/七/g, '7')
    .replace(/八/g, '8')
    .replace(/九/g, '9')
    .replace(/十/g, '10');
};

const RoomManagement: React.FC<RoomManagementProps> = ({ 
  rooms, 
  onUpdateStatus,
  onBatchUpdateStatus,
  onUpdateBlankets, 
  onTransferBlanket, 
  onSwapRoom,
  onBlanketCondition,
  totalBlanketStock,
  onUpdateTotalBlanketStock
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refactor: Use ID to track selection so updates propagate immediately
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId) || null, [rooms, selectedRoomId]);
  
  // Mobile Control Toggle
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  
  // Section Collapse States
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showStatusBoard, setShowStatusBoard] = useState(true);
  const [showInventory, setShowInventory] = useState(true);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showReminder, setShowReminder] = useState(true);

  // Quick Action States
  const [actionType, setActionType] = useState<'CHECKIN' | 'CHECKOUT'>('CHECKIN');
  const [quickCode, setQuickCode] = useState(''); // Renamed from quickCheckInCode to reflect dual purpose
  
  const [quickSwapFrom, setQuickSwapFrom] = useState('');
  const [quickSwapTo, setQuickSwapTo] = useState('');
  const [equipCommand, setEquipCommand] = useState('');

  // Batch Selection State for Dirty Rooms
  const [selectedDirtyIds, setSelectedDirtyIds] = useState<Set<string>>(new Set());

  // Stock Input State
  const [localStockInput, setLocalStockInput] = useState<string>(totalBlanketStock.toString());

  // Sync local input with prop
  useEffect(() => {
    setLocalStockInput(totalBlanketStock.toString());
  }, [totalBlanketStock]);

  const handleStockUpdate = () => {
    const val = parseInt(localStockInput, 10);
    if (!isNaN(val) && val >= 0) {
        onUpdateTotalBlanketStock(val);
    } else {
        setLocalStockInput(totalBlanketStock.toString()); // Revert on invalid
    }
  };

  // Modal Inputs
  const [swapTargetId, setSwapTargetId] = useState('');
  const [modalExtraGuests, setModalExtraGuests] = useState<number>(0);
  const [modalGuestName, setModalGuestName] = useState('');
  const [modalCheckOutDate, setModalCheckOutDate] = useState('');

  // Stats
  const stats = useMemo(() => {
    const totalInRooms = rooms.reduce((sum, r) => sum + r.electricBlankets.current, 0);
    const totalBroken = rooms.reduce((sum, r) => sum + r.electricBlankets.broken, 0);
    const missingInRooms = rooms.reduce((acc, r) => acc + (Math.max(0, r.electricBlankets.total - r.electricBlankets.current)), 0);
    const inWarehouse = totalBlanketStock - totalInRooms - totalBroken;

    return {
      total: rooms.length,
      occupied: rooms.filter(r => r.status === RoomStatus.OCCUPIED).length,
      dirty: rooms.filter(r => r.status === RoomStatus.DIRTY).length,
      vacant: rooms.filter(r => r.status === RoomStatus.VACANT).length,
      blankets: {
        totalStock: totalBlanketStock,
        inRooms: totalInRooms,
        broken: totalBroken,
        inWarehouse: inWarehouse,
        missingFromRooms: missingInRooms
      }
    };
  }, [rooms, totalBlanketStock]);

  // Quick Lists for Status Board
  const occupiedRoomsList = useMemo(() => rooms.filter(r => r.status === RoomStatus.OCCUPIED), [rooms]);
  const dirtyRoomsList = useMemo(() => rooms.filter(r => r.status === RoomStatus.DIRTY), [rooms]);

  // Upcoming Check-out Reminder Logic
  const upcomingCheckouts = useMemo(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      return rooms.filter(r => 
          r.status === RoomStatus.OCCUPIED && 
          r.checkOutDate === tomorrowStr
      );
  }, [rooms]);

  // Filter and Search Logic
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // 1. Type Filter
      const matchesType = filterType === 'ALL' || room.type === filterType;
      
      // 2. Search Filter
      const lowerTerm = searchTerm.toLowerCase().trim();
      if (!lowerTerm) return matchesType;

      const matchesCode = room.code.toLowerCase().includes(lowerTerm);
      const matchesStatus = room.status.includes(lowerTerm); // e.g., "待清潔"
      const matchesGuest = room.currentGuestName?.toLowerCase().includes(lowerTerm);
      
      return matchesType && (matchesCode || matchesStatus || matchesGuest);
    });
  }, [rooms, filterType, searchTerm]);

  const groupedRooms = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    filteredRooms.forEach(room => {
      if (!groups[room.type]) groups[room.type] = [];
      groups[room.type].push(room);
    });
    return groups;
  }, [filteredRooms]);

  // For swap dropdown: Allow swapping to any non-occupied room (VACANT, DIRTY, MAINTENANCE)
  const availableSwapTargets = useMemo(() => rooms.filter(r => r.status !== RoomStatus.OCCUPIED), [rooms]);

  // --- Logic Helpers ---

  const findRoomByCode = (code: string) => rooms.find(r => r.code === code.trim());

  const handleRoomClick = (room: Room) => {
    setSelectedRoomId(room.id);
    setSwapTargetId('');
    setModalExtraGuests(room.extraGuests || 0);
    setModalGuestName(room.currentGuestName || '');
    
    if (room.status === RoomStatus.VACANT) {
        // Default checkout date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setModalCheckOutDate(tomorrow.toISOString().split('T')[0]);
    } else {
        setModalCheckOutDate(room.checkOutDate || '');
    }
  };

  const closeModal = () => {
    setSelectedRoomId(null);
    setSwapTargetId('');
    setModalExtraGuests(0);
    setModalGuestName('');
    setModalCheckOutDate('');
  };

  const handleToggleDirtySelect = (id: string) => {
    const next = new Set(selectedDirtyIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDirtyIds(next);
  };

  // --- Action Handlers ---

  const handleImportConfirm = (bookings: ParsedBooking[]) => {
      const updates: { roomId: string, status: RoomStatus, guestName?: string, extraGuests?: number, actualAdults?: number, actualChildren?: number }[] = [];
      
      bookings.forEach(b => {
          if (b.targetRoomId) {
              updates.push({
                  roomId: b.targetRoomId,
                  status: RoomStatus.OCCUPIED,
                  guestName: b.guestName,
                  extraGuests: b.extraGuests,
                  actualAdults: b.adults,
                  actualChildren: b.children
              });
          }
      });

      if (updates.length > 0) {
          onBatchUpdateStatus(updates);
          setShowImportModal(false);
          alert(`✅ 成功匯入 ${updates.length} 筆訂房資料！`);
      }
  };

  const handleQuickAction = (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!quickCode.trim()) {
        alert("⚠️ 請輸入房號指令 (例如: 201 202)");
        return;
    }

    // Split input by space or comma
    const tokens = quickCode.split(/[,\s]+/).filter(t => t.trim() !== '');
    
    const successList: string[] = [];
    const failList: string[] = [];
    const updates: { roomId: string, status: RoomStatus, guestName?: string, extraGuests?: number }[] = [];
    const processedIds = new Set<string>();

    tokens.forEach(token => {
        // Improved Regex: Non-greedy capture for room code + optional operator/digit
        const match = token.match(/^(.+?)(?:([+-])(\d))?$/);
        
        if (!match) {
            failList.push(`${token} (格式錯誤)`);
            return;
        }

        const rawCode = match[1];
        const roomCode = normalizeRoomCode(rawCode); // Normalize Chinese numbers
        const operator = match[2]; // '+' or '-' or undefined
        const num = match[3] ? parseInt(match[3], 10) : 0;

        const room = findRoomByCode(roomCode);
        
        if (!room) {
            failList.push(`${rawCode} (無此房號)`);
            return;
        }

        if (processedIds.has(room.id)) {
            return; 
        }

        if (actionType === 'CHECKIN') {
          // Check In Logic: 
          // Allow if VACANT (New Checkin) OR OCCUPIED (Update Info)
          if (room.status !== RoomStatus.VACANT && room.status !== RoomStatus.OCCUPIED) {
              failList.push(`${roomCode} (狀態: ${room.status}，無法入住)`);
              return;
          }

          // Calculate new extra guests count using relative math
          let currentExtra = room.status === RoomStatus.OCCUPIED ? room.extraGuests : 0;
          
          if (operator === '+') {
            currentExtra += num;
          } else if (operator === '-') {
            currentExtra -= num;
          }
          else {
             if (room.status === RoomStatus.VACANT) currentExtra = 0;
             // If occupied and no operator provided, preserve existing (don't force to 0)
          }

          // Clamp 0-2
          const finalExtra = Math.max(0, Math.min(2, currentExtra));
          
          // Use existing name if it exists (for occupied updates or dirty data), otherwise default to "貴賓"
          const guestName = room.currentGuestName ? room.currentGuestName : "貴賓";

          processedIds.add(room.id);
          updates.push({ roomId: room.id, status: RoomStatus.OCCUPIED, guestName: guestName, extraGuests: finalExtra });
          
          const opStr = operator ? operator + num : '';
          successList.push(`${roomCode}${opStr} (加人:${finalExtra})`);

        } else if (actionType === 'CHECKOUT') {
           // Check Out Logic
           if (room.status !== RoomStatus.OCCUPIED) {
             failList.push(`${roomCode} (非入住中，無法退房)`);
             return;
           }

           processedIds.add(room.id);
           updates.push({ roomId: room.id, status: RoomStatus.DIRTY });
           successList.push(`${roomCode}`);
        }
    });

    if (updates.length > 0) {
        if (actionType === 'CHECKOUT') {
            // Use setTimeout to unblock browser UI/event loop for the confirm dialog
            setTimeout(() => {
                const confirmed = window.confirm(`確定要為以下房間退房嗎？\n${successList.join(', ')}`);
                if (confirmed) {
                    onBatchUpdateStatus(updates);
                    setQuickCode(''); // Only clear on success
                    setTimeout(() => {
                        let msg = `✅ 成功退房: ${successList.join(', ')}`;
                        if (failList.length > 0) msg += `\n⚠️ 部分失敗:\n${failList.join('\n')}`;
                        alert(msg);
                    }, 50);
                }
            }, 10);
        } else {
            onBatchUpdateStatus(updates);
            setQuickCode('');
            
            setTimeout(() => {
                let msg = `✅ 成功: ${successList.join(', ')}`;
                if (failList.length > 0) msg += `\n❌ 失敗:\n${failList.join('\n')}`;
                alert(msg);
            }, 50);
        }
    } else {
        // Guaranteed Feedback for complete failure
        if (failList.length > 0) {
            alert(`❌ 操作失敗 (無有效指令):\n${failList.join('\n')}`);
        } else {
            alert("⚠️ 未執行任何操作，請檢查輸入。");
        }
    }
  };

  const handleQuickSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSwapFrom.trim() || !quickSwapTo.trim()) {
        alert("⚠️ 請輸入原房號與新房號");
        return;
    }
    
    const fromCode = normalizeRoomCode(quickSwapFrom);
    const toCode = normalizeRoomCode(quickSwapTo);
    
    const fromRoom = findRoomByCode(fromCode);
    const toRoom = findRoomByCode(toCode);

    if (!fromRoom) {
      alert(`❌ 找不到原房間: ${quickSwapFrom}`);
      return;
    }
    if (!toRoom) {
      alert(`❌ 找不到目標房間: ${quickSwapTo}`);
      return;
    }

    if (fromRoom.status !== RoomStatus.OCCUPIED) {
      alert(`⚠️ ${fromRoom.code} 目前狀態為「${fromRoom.status}」，非入住中無法換房。`);
      return;
    }

    if (toRoom.status === RoomStatus.OCCUPIED) {
        alert(`❌ 無法換房：目標房間 ${toRoom.code} 已有房客 (${toRoom.currentGuestName})`);
        return;
    }

    if (toRoom.status === RoomStatus.DIRTY || toRoom.status === RoomStatus.MAINTENANCE) {
        const confirmDirty = window.confirm(`⚠️ 警告：目標房間 ${toRoom.code} 目前狀態為「${toRoom.status}」。\n確定要強制換入嗎？(請確保已緊急清潔)`);
        if (!confirmDirty) return;
    }

    onSwapRoom(fromRoom.id, toRoom.id);
    setQuickSwapFrom('');
    setQuickSwapTo('');
    alert(`✅ 已將 ${fromRoom.code} 換至 ${toRoom.code}`);
  };

  const handleEquipCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipCommand.trim()) {
        alert("⚠️ 請輸入設備指令 (例如: 尊1=2)");
        return;
    }

    // Syntax: Code=Num (Set) OR Code>Code (Transfer) OR 庫存=Num
    if (equipCommand.startsWith("庫存=")) {
        const num = parseInt(equipCommand.split('=')[1], 10);
        if(!isNaN(num) && num >= 0) {
            onUpdateTotalBlanketStock(num);
            setEquipCommand('');
            alert(`✅ 總庫存已更新為: ${num}`);
        } else {
            alert("❌ 庫存格式錯誤，請輸入 庫存=35");
        }
        return;
    }

    if (equipCommand.includes('=')) {
      const [rawCode, countStr] = equipCommand.split('=');
      const code = normalizeRoomCode(rawCode);
      const room = findRoomByCode(code);
      const count = parseInt(countStr, 10);
      
      if (room && !isNaN(count)) {
        onUpdateBlankets(room.id, count);
        setEquipCommand('');
        alert(`✅ ${room.code} 電熱毯數量已設為 ${count}`);
      } else {
        alert(`❌ 指令錯誤或找不到房間: ${rawCode}`);
      }
    } else if (equipCommand.includes('>')) {
      const [rawFrom, rawTo] = equipCommand.split('>');
      const fromCode = normalizeRoomCode(rawFrom);
      const toCode = normalizeRoomCode(rawTo);

      const fromRoom = findRoomByCode(fromCode);
      const toRoom = findRoomByCode(toCode);

      if (fromRoom && toRoom) {
        if (fromRoom.electricBlankets.current > 0) {
            onTransferBlanket(fromRoom.id, toRoom.id);
            setEquipCommand('');
            alert(`✅ 已從 ${fromRoom.code} 移動一件電熱毯至 ${toRoom.code}`);
        } else {
            alert(`❌ ${fromRoom.code} 沒庫存了，無法移動`);
        }
      } else {
        alert(`❌ 房號錯誤: ${!fromRoom ? rawFrom : rawTo} 不存在`);
      }
    } else {
        alert("⚠️ 格式不正確，請使用:\n1. 房號=數量 (設定)\n2. 房號>房號 (移動)\n3. 庫存=數量 (總庫存)");
    }
  };

  const handleBatchCleanAll = () => {
    const dirtyRooms = rooms.filter(r => r.status === RoomStatus.DIRTY);
    if (dirtyRooms.length === 0) return;
    
    // Create batch updates
    const updates = dirtyRooms.map(r => ({ roomId: r.id, status: RoomStatus.VACANT }));
    onBatchUpdateStatus(updates);
    setSelectedDirtyIds(new Set()); // Clear selection
    
    // Delay alert slightly to allow UI update
    setTimeout(() => alert(`✅ 已成功將 ${dirtyRooms.length} 間房間設為已清潔 (可入住)`), 100);
  };

  const handleCleanSelected = () => {
    const updates = Array.from(selectedDirtyIds).map(id => ({
        roomId: id,
        status: RoomStatus.VACANT
    }));
    onBatchUpdateStatus(updates);
    setSelectedDirtyIds(new Set());
    setTimeout(() => alert(`✅ 已成功將 ${updates.length} 間選取房間設為已清潔`), 100);
  };

  const handleBatchCheckOutAll = () => {
    const occupied = rooms.filter(r => r.status === RoomStatus.OCCUPIED);
    if (occupied.length === 0) {
      if (actionType === 'CHECKOUT') alert("目前沒有入住中的房間。");
      return;
    }

    const confirmed = window.confirm(`確定要為所有入住中房間 (${occupied.length}間) 辦理退房嗎？\n這將把所有房間設為「待清潔」。`);
    if (confirmed) {
        const updates = occupied.map(r => ({ roomId: r.id, status: RoomStatus.DIRTY }));
        onBatchUpdateStatus(updates);
        setTimeout(() => alert(`✅ 已成功將 ${occupied.length} 間房間退房`), 100);
    }
  };

  const handleBlanketUpdate = (roomId: string, delta: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    const newCount = room.electricBlankets.current + delta;
    
    if (newCount < 0) return; // Prevent negative in room

    if (delta > 0) {
        // Check warehouse stock
        if (stats.blankets.inWarehouse <= 0) {
            alert("❌ 倉庫備品不足！請先檢查庫存或從其他房間調度。");
            return;
        }
    }

    onUpdateBlankets(roomId, newCount);
  };

  const handleManualStatusUpdate = () => {
     if (!selectedRoomId || !selectedRoom) return;
     
     // Special Logic for VACANT/DIRTY -> OCCUPIED
     if (selectedRoom.status !== RoomStatus.OCCUPIED) {
         onUpdateStatus(selectedRoomId, RoomStatus.OCCUPIED, modalGuestName || '貴賓', modalExtraGuests, undefined, undefined, modalCheckOutDate);
     } else {
         // Updating existing info
         onUpdateStatus(selectedRoomId, RoomStatus.OCCUPIED, modalGuestName, modalExtraGuests, undefined, undefined, modalCheckOutDate);
     }
     closeModal();
  };

  const handleManualCheckOut = () => {
      if (!selectedRoomId) return;
      onBatchUpdateStatus([{ roomId: selectedRoomId, status: RoomStatus.DIRTY }]);
      closeModal();
      setTimeout(() => alert(`✅ 已完成退房`), 100);
  };

  const handleModalSwap = () => {
      if (!selectedRoomId || !swapTargetId) return;
      
      const toRoom = rooms.find(r => r.id === swapTargetId);
      if (toRoom && (toRoom.status === RoomStatus.DIRTY || toRoom.status === RoomStatus.MAINTENANCE)) {
           const confirm = window.confirm(`目標房間 ${toRoom.code} 狀態為 ${toRoom.status}，確定要換入嗎？`);
           if (!confirm) return;
      }

      onSwapRoom(selectedRoomId, swapTargetId);
      closeModal();
      alert("✅ 換房成功");
  };

  const getRoomIcon = (type: RoomType) => {
    switch (type) {
      case RoomType.DOUBLE_TENT: return <Tent size={16} />;
      case RoomType.PALACE_TENT: return <Crown size={16} />;
      case RoomType.VIP_TENT: return <div className="flex"><Tent size={16}/><Crown size={10} className="-ml-1 -mt-1 text-luxury-gold"/></div>;
      case RoomType.WATER_HOUSE: return <Droplets size={16} />;
      case RoomType.CYPRESS_ROOM: return <TreePine size={16} />;
      default: return <Home size={16} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif text-glamping-900 font-bold tracking-wide">客房管理</h2>
          <p className="text-glamping-500 mt-1 text-sm md:text-base">即時掌握房態、房務清潔與設備調度</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
             <button 
                onClick={() => setShowImportModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-glamping-800 py-2 px-4 rounded-lg font-bold border border-glamping-300 shadow-sm hover:bg-glamping-50 hover:border-luxury-gold hover:text-luxury-gold transition-colors"
             >
                <Camera size={18} />
                匯入訂房表
             </button>
             {/* Mobile Control Toggle */}
             <button 
                onClick={() => setIsMobileControlsOpen(!isMobileControlsOpen)}
                className="md:hidden flex-1 flex items-center justify-center gap-2 bg-glamping-800 text-white py-2 rounded-lg font-bold border border-luxury-gold shadow-sm active:scale-95 transition-transform"
             >
                <Settings2 size={18} />
                {isMobileControlsOpen ? '收起管理工具' : '管理'}
                {isMobileControlsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
             </button>
        </div>
      </div>

      {/* --- REMINDER BANNER FOR UPCOMING CHECKOUTS --- */}
      {showReminder && upcomingCheckouts.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm animate-fade-in gap-3">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full mt-0.5 md:mt-0">
                    <Calendar size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                        明日退房提醒
                        <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">{upcomingCheckouts.length} 間</span>
                    </h4>
                    <p className="text-sm text-indigo-700 mt-1">
                         {upcomingCheckouts.map(r => r.code).join(', ')} 預計明天退房，請確認離場時間。
                    </p>
                </div>
            </div>
            <button onClick={() => setShowReminder(false)} className="self-end md:self-center text-xs text-indigo-500 hover:text-indigo-800 underline">
                我知道了
            </button>
        </div>
      )}

      {/* --- COLLAPSIBLE CONTROL PANEL (Mobile: Hidden by default, Desktop: Always visible) --- */}
      <div className={`space-y-6 ${isMobileControlsOpen ? 'block' : 'hidden md:block'}`}>
        
        {/* Command Center & Status Board */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left: Quick Actions */}
            <div className="xl:col-span-2 bg-glamping-900 rounded-xl text-white shadow-xl relative overflow-hidden border border-glamping-700 flex flex-col transition-all">
                {/* Header */}
                <div 
                    className="p-4 md:p-6 flex justify-between items-center cursor-pointer hover:bg-glamping-800/50 transition-colors"
                    onClick={() => setShowQuickActions(!showQuickActions)}
                >
                    <h3 className="font-serif font-bold text-lg flex items-center gap-2 relative z-10 text-luxury-gold">
                        <Zap size={20} className="fill-current" /> 快速指令中心
                    </h3>
                    <div className="text-glamping-400">
                        {showQuickActions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>

                {/* Collapsible Content */}
                {showQuickActions && (
                    <div className="px-4 pb-4 md:px-6 md:pb-6 relative z-10 animate-fade-in space-y-4">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <Zap size={100} />
                        </div>
                        
                        {/* 1. Check-in / Check-out Toggle Bar */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 bg-glamping-800/50 p-3 rounded-lg border border-glamping-700">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-glamping-300 uppercase tracking-wider">房務操作模式</label>
                                <div className="flex bg-glamping-900 rounded-lg p-1 border border-glamping-700">
                                    <button 
                                        onClick={() => setActionType('CHECKIN')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${actionType === 'CHECKIN' ? 'bg-amber-400 text-glamping-900' : 'text-glamping-400 hover:text-white'}`}
                                    >
                                        入住 / 加人
                                    </button>
                                    <button 
                                        onClick={() => setActionType('CHECKOUT')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${actionType === 'CHECKOUT' ? 'bg-rose-500 text-white' : 'text-glamping-400 hover:text-white'}`}
                                    >
                                        退房
                                    </button>
                                </div>
                            </div>
                            <form onSubmit={handleQuickAction} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder={actionType === 'CHECKIN' ? "輸入 201 202+1 203..." : "輸入 201 202 (批次退房)..."}
                                        className="flex-1 bg-white text-glamping-900 px-4 py-2 rounded-lg border-2 border-transparent focus:border-luxury-gold outline-none shadow-inner placeholder-glamping-400 font-bold"
                                        value={quickCode}
                                        onChange={e => setQuickCode(e.target.value)}
                                    />
                                    <button 
                                    type="submit" 
                                    className={`px-6 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95 whitespace-nowrap ${
                                        actionType === 'CHECKIN' 
                                        ? 'bg-amber-400 text-glamping-900 hover:bg-amber-300' 
                                        : 'bg-rose-500 text-white hover:bg-rose-600'
                                    }`}
                                    >
                                        {actionType === 'CHECKIN' ? '執行入住' : '執行退房'}
                                    </button>
                                    {actionType === 'CHECKOUT' && (
                                    <button 
                                        type="button"
                                        onClick={handleBatchCheckOutAll}
                                        className="px-4 py-2 rounded-lg font-bold border-2 border-rose-500 text-rose-500 hover:bg-rose-50 transition-colors whitespace-nowrap hidden sm:block"
                                    >
                                        全部退房
                                    </button>
                                    )}
                            </form>
                            <p className="text-[10px] text-glamping-400 mt-2 ml-1">
                                {actionType === 'CHECKIN' 
                                    ? '提示: 輸入 "201" 一般入住，"201+1" 加一人，"201-1" 減一人。支援空格分隔多房。'
                                    : '提示: 輸入房號 "201 202"，系統將其設為待清潔並清除客資。'}
                            </p>
                            </div>
                        </div>

                        {/* 2. Swap & Equip Row */}
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Swap */}
                            <form onSubmit={handleQuickSwap} className="flex-1 bg-glamping-800/50 p-3 rounded-lg border border-glamping-700 flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-xs font-bold text-sky-400 whitespace-nowrap">換房</span>
                                    <input type="text" placeholder="原房號" className="w-full bg-white text-glamping-900 px-2 py-1.5 rounded text-sm font-bold placeholder-glamping-400 outline-none" value={quickSwapFrom} onChange={e => setQuickSwapFrom(e.target.value)} />
                                    <ArrowRight size={14} className="text-glamping-500"/>
                                    <input type="text" placeholder="新房號" className="w-full bg-white text-glamping-900 px-2 py-1.5 rounded text-sm font-bold placeholder-glamping-400 outline-none" value={quickSwapTo} onChange={e => setQuickSwapTo(e.target.value)} />
                                </div>
                                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-white p-2 rounded-lg shadow-md transition-colors">
                                    <ArrowRightLeft size={18} />
                                </button>
                            </form>

                            {/* Equip */}
                            <form onSubmit={handleEquipCommand} className="flex-1 bg-glamping-800/50 p-3 rounded-lg border border-glamping-700 flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-xs font-bold text-indigo-400 whitespace-nowrap">設備</span>
                                    <input type="text" placeholder="指令 (如: 尊1=2 或 尊1>尊2)" className="w-full bg-white text-glamping-900 px-3 py-1.5 rounded text-sm font-bold placeholder-glamping-400 outline-none" value={equipCommand} onChange={e => setEquipCommand(e.target.value)} />
                                </div>
                                <button type="submit" className="bg-indigo-500 hover:bg-indigo-400 text-white p-2 rounded-lg shadow-md transition-colors">
                                    <Wrench size={18} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Quick Status Board */}
            <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden flex flex-col">
                <div 
                    className="bg-glamping-50 px-4 py-3 border-b border-glamping-100 flex justify-between items-center cursor-pointer hover:bg-glamping-100 transition-colors"
                    onClick={() => setShowStatusBoard(!showStatusBoard)}
                >
                    <h3 className="font-serif font-bold text-glamping-800 flex items-center gap-2">
                        <Layers size={18} /> 即時房態看板
                    </h3>
                    <div className="text-glamping-400">
                        {showStatusBoard ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>

                {showStatusBoard && (
                    <div className="flex-1 overflow-y-auto p-0 flex flex-col h-64 md:h-auto animate-fade-in">
                        {/* Priority: Dirty Rooms */}
                        <div className="flex-1 p-3 border-b border-glamping-100 bg-red-50/30">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase tracking-wider">
                                    <Brush size={12} /> 待清潔 ({dirtyRoomsList.length})
                                </span>
                                <div className="flex gap-1">
                                    {selectedDirtyIds.size > 0 && (
                                        <button 
                                        type="button"
                                        onClick={handleCleanSelected}
                                        className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded border border-emerald-200 transition-colors font-bold"
                                        >
                                            清潔選取 ({selectedDirtyIds.size})
                                        </button>
                                    )}
                                    {dirtyRoomsList.length > 0 && (
                                        <button 
                                        type="button"
                                        onClick={handleBatchCleanAll}
                                        className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded border border-red-200 transition-colors font-bold"
                                        >
                                            全部清潔
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {dirtyRoomsList.length > 0 ? dirtyRoomsList.map(r => (
                                    <div key={r.id} className={`flex items-center gap-1 px-2 py-1 bg-white border rounded shadow-sm transition ${selectedDirtyIds.has(r.id) ? 'border-red-400 bg-red-50' : 'border-red-200'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="rounded text-red-600 focus:ring-red-500 cursor-pointer w-3 h-3"
                                            checked={selectedDirtyIds.has(r.id)}
                                            onChange={() => handleToggleDirtySelect(r.id)}
                                        />
                                        <button 
                                            onClick={() => handleRoomClick(r)}
                                            className="text-red-700 text-xs hover:underline font-medium"
                                        >
                                            {r.code}
                                        </button>
                                    </div>
                                )) : <span className="text-xs text-glamping-400 italic">目前沒有待清潔房間</span>}
                            </div>
                        </div>

                        {/* Active: Occupied Rooms */}
                        <div className="flex-1 p-3 bg-amber-50/30">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-amber-600 flex items-center gap-1 uppercase tracking-wider">
                                    <User size={12} /> 入住中 ({occupiedRoomsList.length})
                                </span>
                                {occupiedRoomsList.length > 0 && (
                                    <button 
                                    type="button"
                                    onClick={handleBatchCheckOutAll}
                                    className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded border border-amber-200 transition-colors font-bold"
                                    >
                                        全部退房
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                                {occupiedRoomsList.length > 0 ? occupiedRoomsList.map(r => (
                                    <button 
                                        key={r.id}
                                        onClick={() => handleRoomClick(r)} 
                                        className="px-2 py-1 bg-white border border-amber-200 text-amber-800 text-xs rounded shadow-sm hover:bg-amber-50 transition flex items-center gap-1"
                                    >
                                        <span className="font-bold">{r.code}</span>
                                        <span className="opacity-70 truncate max-w-[40px]">{r.currentGuestName}</span>
                                    </button>
                                )) : <span className="text-xs text-glamping-400 italic">目前無人入住</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Inventory Dashboard (Collapsible) */}
        <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
            <div 
                className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-glamping-50 transition-colors"
                onClick={() => setShowInventory(!showInventory)}
            >
                <h3 className="text-lg font-serif font-bold text-glamping-900 flex items-center gap-2">
                    <Warehouse size={20} className="text-glamping-500" />
                    倉儲與備品監控
                </h3>
                
                <div className="flex items-center gap-4">
                     {/* Visual Indicators Legend */}
                     {showInventory && (
                        <div className="hidden md:flex gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>庫存充足</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div>庫存告急</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>房內使用</div>
                        </div>
                     )}
                     <div className="text-glamping-400">
                        {showInventory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {showInventory && (
                <div className="p-4 md:p-6 pt-0 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                        {/* Total Stock (Editable) */}
                        <div className={`p-4 rounded-xl border-2 transition-all group relative ${stats.blankets.inWarehouse < 5 ? 'bg-red-50 border-red-200' : 'bg-glamping-50 border-glamping-100'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-glamping-400 uppercase tracking-wider">電熱毯總資產</span>
                                <Settings2 size={14} className="text-glamping-300 group-hover:text-glamping-500" />
                            </div>
                            <div className="flex items-baseline gap-1">
                                <input 
                                    type="number" 
                                    className={`text-3xl font-serif font-bold bg-transparent outline-none w-24 ${stats.blankets.inWarehouse < 5 ? 'text-red-700' : 'text-glamping-800'}`}
                                    value={localStockInput}
                                    onChange={(e) => setLocalStockInput(e.target.value)}
                                    onBlur={handleStockUpdate}
                                />
                                <span className="text-sm text-glamping-500">件</span>
                            </div>
                            <p className="text-[10px] text-glamping-400 mt-1">點擊數字可修正盤點結果</p>
                        </div>

                        {/* In Rooms */}
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">房內配置中</span>
                                <Zap size={14} className="text-indigo-300" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-serif font-bold text-indigo-800">{stats.blankets.inRooms}</span>
                                <span className="text-sm text-indigo-500">件</span>
                            </div>
                            <div className="text-[10px] text-indigo-400 mt-1 flex items-center gap-1">
                                {stats.blankets.broken > 0 && <span className="text-orange-600 font-bold bg-orange-100 px-1 rounded flex items-center"><Wrench size={10} className="mr-0.5"/> {stats.blankets.broken} 待修</span>}
                                {stats.blankets.missingFromRooms > 0 && <span className="text-red-600 font-bold bg-red-100 px-1 rounded">缺 {stats.blankets.missingFromRooms}</span>}
                            </div>
                        </div>

                        {/* Warehouse */}
                        <div className={`p-4 rounded-xl border flex flex-col justify-between ${stats.blankets.inWarehouse < 5 ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-white border-glamping-200'}`}>
                            <div className="flex justify-between items-start">
                                <span className={`text-xs font-bold uppercase tracking-wider ${stats.blankets.inWarehouse < 5 ? 'text-red-100' : 'text-glamping-400'}`}>倉庫備品剩餘</span>
                                <Package size={14} className={stats.blankets.inWarehouse < 5 ? 'text-red-200' : 'text-glamping-300'} />
                            </div>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className={`text-3xl font-serif font-bold ${stats.blankets.inWarehouse < 5 ? 'text-white' : 'text-emerald-600'}`}>
                                    {stats.blankets.inWarehouse}
                                </span>
                                <span className={`text-sm ${stats.blankets.inWarehouse < 5 ? 'text-red-100' : 'text-glamping-500'}`}>件可用</span>
                            </div>
                            {stats.blankets.inWarehouse < 5 && (
                                <div className="mt-2 text-[10px] font-bold bg-white/20 px-2 py-1 rounded w-fit flex items-center gap-1">
                                    <AlertCircle size={10} /> 庫存告急，請叫貨
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

      </div> 
      {/* End Collapsible Panel */}

      {/* Main Room Grid */}
      <div className="space-y-6">
         {/* Filter Bar */}
         <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end">
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-2 sm:pb-0">
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === 'ALL' ? 'bg-glamping-800 text-white shadow-md' : 'bg-white text-glamping-600 border border-glamping-200 hover:bg-glamping-50'}`}>全部房型</button>
                {Object.values(RoomType).map(type => (
                    <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === type ? 'bg-glamping-800 text-white shadow-md' : 'bg-white text-glamping-600 border border-glamping-200 hover:bg-glamping-50'}`}>
                        {type}
                    </button>
                ))}
            </div>
            
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜尋房號、住客..." 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white text-sm shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
         </div>

         {/* Room Groups */}
         {Object.keys(groupedRooms).length === 0 ? (
             <div className="text-center py-12 text-glamping-400">沒有符合條件的房間</div>
         ) : (
             Object.entries(groupedRooms).map(([type, items]) => {
                const groupRooms = items as Room[];
                return (
                <div key={type} className="animate-slide-up">
                    <h3 className="font-serif font-bold text-glamping-800 mb-4 flex items-center gap-2 border-l-4 border-luxury-gold pl-3">
                        {getRoomIcon(groupRooms[0].type)}
                        {type} 
                        <span className="text-sm font-sans font-normal text-glamping-500 bg-glamping-100 px-2 py-0.5 rounded-full ml-2">{groupRooms.length} 間</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {groupRooms.map(room => (
                            <div 
                                key={room.id}
                                onClick={() => handleRoomClick(room)}
                                className={`
                                    relative p-4 rounded-xl border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md group flex flex-col justify-between min-h-[140px]
                                    ${room.status === RoomStatus.OCCUPIED ? 'bg-white border-luxury-gold ring-1 ring-luxury-gold/20' : 
                                      room.status === RoomStatus.DIRTY ? 'bg-red-50 border-red-200' : 
                                      room.status === RoomStatus.MAINTENANCE ? 'bg-gray-100 border-gray-300' : 
                                      'bg-white border-glamping-200 hover:border-glamping-400'}
                                `}
                            >
                                {/* Top Row: Code & Icon */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1.5 rounded-md ${
                                            room.status === RoomStatus.OCCUPIED ? 'bg-luxury-gold text-white' : 
                                            room.status === RoomStatus.DIRTY ? 'bg-red-100 text-red-600' : 'bg-glamping-100 text-glamping-500'
                                        }`}>
                                            {getRoomIcon(room.type)}
                                        </div>
                                        <span className={`font-serif font-bold text-lg ${room.status === RoomStatus.OCCUPIED ? 'text-luxury-gold' : 'text-glamping-800'}`}>
                                            {room.code}
                                        </span>
                                    </div>
                                    
                                    {/* Status Badge */}
                                    {room.status === RoomStatus.OCCUPIED ? (
                                        <div className="flex flex-col items-end">
                                            {room.extraGuests > 0 && (
                                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded-full font-bold mb-1">
                                                    +{room.extraGuests}人
                                                </span>
                                            )}
                                        </div>
                                    ) : room.status === RoomStatus.DIRTY ? (
                                        <Brush size={16} className="text-red-400 animate-pulse" />
                                    ) : null}
                                </div>

                                {/* Middle: Guest Info or Status */}
                                <div className="flex-1 flex items-center">
                                    {room.status === RoomStatus.OCCUPIED ? (
                                        <div className="w-full">
                                            <div className="text-sm font-bold text-glamping-900 truncate">{room.currentGuestName}</div>
                                            <div className="text-[10px] text-glamping-500 mt-0.5 flex items-center gap-1">
                                                <CheckCircle size={10} className="text-green-500"/>
                                                {room.checkInDate === new Date().toISOString().split('T')[0] ? '今日入住' : '續住中'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`text-xs font-medium px-2 py-1 rounded w-fit ${
                                            room.status === RoomStatus.VACANT ? 'bg-emerald-50 text-emerald-700' : 
                                            room.status === RoomStatus.DIRTY ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {room.status}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom: Electric Blanket Status */}
                                <div className="mt-3 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <Zap size={12} className={room.electricBlankets.current < room.electricBlankets.total ? 'text-red-400' : 'text-glamping-300'} />
                                        <span className={`text-xs font-mono font-bold ${
                                            room.electricBlankets.current < room.electricBlankets.total ? 'text-red-600' : 'text-glamping-500'
                                        }`}>
                                            {room.electricBlankets.current}/{room.electricBlankets.total}
                                        </span>
                                    </div>
                                    
                                    {room.electricBlankets.broken > 0 && (
                                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                            <Wrench size={10} /> {room.electricBlankets.broken}
                                        </span>
                                    )}
                                </div>

                            </div>
                        ))}
                    </div>
                </div>
             );
            })
         )}
      </div>

      {/* --- DETAIL MODAL --- */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                {/* Modal Header */}
                <div className={`p-6 text-white flex justify-between items-start ${
                    selectedRoom.status === RoomStatus.OCCUPIED ? 'bg-luxury-gold' : 
                    selectedRoom.status === RoomStatus.DIRTY ? 'bg-red-500' : 'bg-glamping-800'
                }`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1 opacity-90 text-sm font-medium">
                            {getRoomIcon(selectedRoom.type)}
                            {selectedRoom.type}
                        </div>
                        <h2 className="text-3xl font-serif font-bold flex items-center gap-3">
                            {selectedRoom.code} 
                            <span className="text-base font-sans font-normal bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm border border-white/30">
                                {selectedRoom.status}
                            </span>
                        </h2>
                    </div>
                    <button onClick={closeModal} className="text-white/70 hover:text-white transition-colors bg-white/10 p-1 rounded-full hover:bg-white/20">
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6">
                    
                    {/* 1. OCCUPIED STATE UI */}
                    {selectedRoom.status === RoomStatus.OCCUPIED && (
                         <div className="space-y-4">
                            {/* Checkout Button - Prominent at Top */}
                            <button 
                                onClick={handleManualCheckOut}
                                type="button"
                                className="w-full bg-rose-500 text-white py-3 rounded-lg font-bold shadow-md hover:bg-rose-600 transition flex items-center justify-center gap-2"
                            >
                                <LogOut size={20} /> 辦理退房
                            </button>

                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                                <label className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 block">房客資訊 (可編輯)</label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <User size={18} className="text-amber-600"/>
                                        <input 
                                            type="text" 
                                            value={modalGuestName}
                                            onChange={(e) => setModalGuestName(e.target.value)}
                                            className="bg-white border border-amber-200 rounded px-3 py-2 w-full text-sm font-bold text-glamping-900 focus:outline-none focus:border-amber-400"
                                            placeholder="輸入房客姓名"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={18} className="text-amber-600"/>
                                        <input 
                                            type="date" 
                                            value={modalCheckOutDate}
                                            onChange={(e) => setModalCheckOutDate(e.target.value)}
                                            className="bg-white border border-amber-200 rounded px-3 py-2 w-full text-sm font-bold text-glamping-900 focus:outline-none focus:border-amber-400"
                                        />
                                        <span className="text-xs text-amber-600 font-bold">退房日</span>
                                    </div>

                                    <div className="flex items-center justify-between bg-white p-2 rounded border border-amber-100">
                                        <span className="text-sm font-bold text-amber-800">加人 ({modalExtraGuests}位)</span>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map(n => (
                                                <button 
                                                    key={n}
                                                    onClick={() => setModalExtraGuests(n)}
                                                    className={`w-8 h-8 rounded font-bold text-sm transition-colors ${modalExtraGuests === n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleManualStatusUpdate}
                                    className="w-full mt-3 bg-amber-200 hover:bg-amber-300 text-amber-900 py-2 rounded-lg text-sm font-bold transition-colors"
                                >
                                    更新入住資訊
                                </button>
                            </div>
                            
                            {/* Swap Room Section */}
                             <div className="pt-4 border-t border-dashed border-gray-200">
                                <label className="text-xs font-bold text-glamping-400 uppercase tracking-wider mb-2 block">更換房間</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="flex-1 bg-glamping-50 border border-glamping-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-luxury-gold"
                                        value={swapTargetId}
                                        onChange={e => setSwapTargetId(e.target.value)}
                                    >
                                        <option value="">選擇新房間...</option>
                                        {availableSwapTargets.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.code} ({r.type} - {r.status})
                                            </option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleModalSwap}
                                        disabled={!swapTargetId}
                                        className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        換房
                                    </button>
                                </div>
                            </div>
                         </div>
                    )}

                    {/* 2. VACANT STATE UI */}
                    {selectedRoom.status === RoomStatus.VACANT && (
                        <div className="space-y-4">
                            <div className="bg-glamping-50 rounded-lg p-4 border border-glamping-100">
                                <label className="text-xs font-bold text-glamping-500 uppercase tracking-wider mb-2 block">辦理入住</label>
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        value={modalGuestName}
                                        onChange={(e) => setModalGuestName(e.target.value)}
                                        className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-luxury-gold"
                                        placeholder="輸入房客姓名"
                                    />
                                     <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-glamping-600 whitespace-nowrap">退房日期</span>
                                        <input 
                                            type="date" 
                                            value={modalCheckOutDate}
                                            onChange={(e) => setModalCheckOutDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-luxury-gold"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-glamping-600">加人數量</span>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map(n => (
                                                <button 
                                                    key={n}
                                                    onClick={() => setModalExtraGuests(n)}
                                                    className={`w-8 h-8 rounded font-bold text-sm transition-colors ${modalExtraGuests === n ? 'bg-luxury-gold text-white' : 'bg-white border border-glamping-200 text-gray-500'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleManualStatusUpdate}
                                        className="w-full bg-glamping-800 text-white py-3 rounded-lg font-bold hover:bg-glamping-900 transition flex items-center justify-center gap-2"
                                    >
                                        <CheckSquare size={18}/> 確認入住
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={() => onUpdateStatus(selectedRoomId!, RoomStatus.MAINTENANCE)}
                                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                設為維護中
                            </button>
                        </div>
                    )}

                    {/* 3. DIRTY STATE UI */}
                    {selectedRoom.status === RoomStatus.DIRTY && (
                        <div className="space-y-4">
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-800 text-sm">
                                <p className="font-bold mb-1 flex items-center gap-2">
                                    <AlertCircle size={16}/> 待清潔房間
                                </p>
                                <p>房客已退房，請確認房務人員已完成清潔與備品補充。</p>
                            </div>
                            <button 
                                onClick={() => {
                                    onUpdateStatus(selectedRoomId!, RoomStatus.VACANT);
                                    closeModal();
                                    alert(`✅ ${selectedRoom.code} 已設為空房`);
                                }}
                                className="w-full bg-emerald-500 text-white py-3 rounded-lg font-bold hover:bg-emerald-600 transition flex items-center justify-center gap-2 shadow-md"
                            >
                                <CheckCircle size={20}/> 完成清潔 (設為空房)
                            </button>
                            <button 
                                onClick={() => onUpdateStatus(selectedRoomId!, RoomStatus.MAINTENANCE)}
                                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
                            >
                                發現設施損壞 (設為維護中)
                            </button>
                        </div>
                    )}

                    {/* 4. MAINTENANCE STATE UI */}
                    {selectedRoom.status === RoomStatus.MAINTENANCE && (
                        <div className="space-y-4">
                             <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 text-gray-600 text-sm">
                                <p className="font-bold mb-1 flex items-center gap-2">
                                    <Wrench size={16}/> 維護工程進行中
                                </p>
                                <p>此房間暫停開放預訂。</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => {
                                        onUpdateStatus(selectedRoomId!, RoomStatus.VACANT);
                                        closeModal();
                                    }}
                                    className="bg-emerald-500 text-white py-3 rounded-lg font-bold hover:bg-emerald-600 transition"
                                >
                                    恢復空房
                                </button>
                                <button 
                                    onClick={() => {
                                        onUpdateStatus(selectedRoomId!, RoomStatus.DIRTY);
                                        closeModal();
                                    }}
                                    className="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition"
                                >
                                    設為待清潔
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- Electric Blanket Control (Common) --- */}
                    <div className="pt-6 border-t border-glamping-100">
                        <h4 className="font-bold text-glamping-800 mb-3 flex items-center gap-2">
                            <Zap size={16} className="text-luxury-gold"/> 電熱毯管理
                        </h4>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleBlanketUpdate(selectedRoom.id, -1)}
                                    className="w-8 h-8 rounded-full border border-glamping-300 flex items-center justify-center text-glamping-500 hover:bg-glamping-100"
                                >
                                    -
                                </button>
                                <span className={`text-xl font-mono font-bold ${selectedRoom.electricBlankets.current < selectedRoom.electricBlankets.total ? 'text-red-500' : 'text-glamping-800'}`}>
                                    {selectedRoom.electricBlankets.current}
                                </span>
                                <button 
                                    onClick={() => handleBlanketUpdate(selectedRoom.id, 1)}
                                    className="w-8 h-8 rounded-full border border-glamping-300 flex items-center justify-center text-glamping-500 hover:bg-glamping-100"
                                >
                                    +
                                </button>
                                <span className="text-sm text-glamping-400">/ 標準 {selectedRoom.electricBlankets.total}</span>
                            </div>

                            {/* Broken Toggle */}
                            <div className="flex items-center gap-2">
                                {selectedRoom.electricBlankets.broken > 0 ? (
                                    <button 
                                        onClick={() => onBlanketCondition(selectedRoom.id, 'FIX')}
                                        className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full hover:bg-emerald-200 transition"
                                    >
                                        修復 1 件
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => onBlanketCondition(selectedRoom.id, 'BREAK')}
                                        disabled={selectedRoom.electricBlankets.current <= 0}
                                        className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full hover:bg-orange-200 transition disabled:opacity-50"
                                    >
                                        回報故障
                                    </button>
                                )}
                            </div>
                        </div>
                        {selectedRoom.electricBlankets.broken > 0 && (
                            <div className="text-xs text-orange-600 font-bold flex items-center gap-1 bg-orange-50 p-2 rounded">
                                <AlertTriangle size={12} />
                                目前有 {selectedRoom.electricBlankets.broken} 件故障待修
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {showImportModal && (
        <OccupancyImportModal 
            rooms={rooms}
            onClose={() => setShowImportModal(false)}
            onConfirmImport={handleImportConfirm}
        />
      )}
    </div>
  );
};

export default RoomManagement;
