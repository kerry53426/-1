
import React, { useMemo, useState } from 'react';
import { Room, RoomStatus, RoomType, Member, InventoryItem, InventoryLog } from '../types';
import { Utensils, Coffee, AlertTriangle, ChefHat, Package, Plus, Trash2, TrendingDown, ShoppingCart, Clock, CheckCircle, Search, FileText, History, X, ArrowUp, ArrowDown, Beef, Fish, Carrot, Wine, Wheat, Box, RotateCcw } from 'lucide-react';

interface KitchenManagementProps {
  rooms: Room[];
  members: Member[];
  inventory: InventoryItem[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  onDeleteInventoryItem: (id: string) => void;
  onResetInventory?: () => void;
}

type SortField = 'name' | 'quantity' | 'safetyStock' | 'weeklyUsage';
type SortDirection = 'asc' | 'desc';

// Category Configuration for Visuals and Order
const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode, color: string, bg: string }> = {
    '肉品': { icon: <Beef size={20}/>, color: 'text-rose-600', bg: 'bg-rose-50' },
    '海鮮': { icon: <Fish size={20}/>, color: 'text-sky-600', bg: 'bg-sky-50' },
    '蔬果': { icon: <Carrot size={20}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    '酒水': { icon: <Wine size={20}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
    '乾貨': { icon: <Wheat size={20}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
    '消耗品': { icon: <Box size={20}/>, color: 'text-gray-600', bg: 'bg-gray-50' },
};

const ORDERED_CATEGORIES = ['肉品', '海鮮', '蔬果', '乾貨', '酒水', '消耗品'];

const KitchenManagement: React.FC<KitchenManagementProps> = ({ rooms, members, inventory, onUpdateInventory, onDeleteInventoryItem, onResetInventory }) => {
  const [activeTab, setActiveTab] = useState<'MEALS' | 'INVENTORY'>('MEALS');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Inventory Filtering & Sorting
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'SUFFICIENT'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ field: SortField, direction: SortDirection }>({ field: 'name', direction: 'asc' });

  // Adjustment Logic State
  const [pendingAdjustment, setPendingAdjustment] = useState<{ itemId: string, delta: number, currentQty: number } | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [customNote, setCustomNote] = useState('');
  
  // History Viewer State
  const [viewingHistoryItem, setViewingHistoryItem] = useState<InventoryItem | null>(null);

  // New Item Form State
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '', category: '肉品', quantity: 0, unit: '', safetyStock: 0, weeklyUsage: 0, consumptionPerGuest: 0
  });

  // Helper to get base capacity
  const getBaseCapacity = (type: RoomType) => {
    if (type === RoomType.PALACE_TENT || type === RoomType.VIP_TENT) return 4;
    return 2;
  };

  // Calculate Meal Stats
  const mealStats = useMemo(() => {
    let totalBreakfast = 0;
    let totalDinner = 0;
    const diets: Record<string, number> = {};
    const activeRooms = rooms.filter(r => r.status === RoomStatus.OCCUPIED);

    activeRooms.forEach(room => {
        let count = 0;
        // Priority: Use Actual Adults + Children if available
        if (room.actualAdults !== undefined && room.actualChildren !== undefined && (room.actualAdults + room.actualChildren > 0)) {
            count = room.actualAdults + room.actualChildren;
        } else {
             // Fallback: Base + Extra
             const base = getBaseCapacity(room.type);
             count = base + (room.extraGuests || 0);
        }
        
        totalBreakfast += count;
        totalDinner += count;

        const member = members.find(m => m.name === room.currentGuestName);
        const restrictions = new Set<string>();
        if (member) member.dietaryRestrictions.forEach(r => restrictions.add(r));
        if (room.notes) {
            if (room.notes.includes("素")) restrictions.add("素食");
            if (room.notes.includes("牛")) restrictions.add("不吃牛");
        }
        restrictions.forEach(r => diets[r] = (diets[r] || 0) + 1);
    });

    return { breakfast: totalBreakfast, dinner: totalDinner, diets };
  }, [rooms, members]);

  const diningList = useMemo(() => {
     return rooms
        .filter(r => r.status === RoomStatus.OCCUPIED)
        .map(r => {
            const member = members.find(m => m.name === r.currentGuestName);
            
            let total = 0;
            // Priority: Actual occupancy
            if (r.actualAdults !== undefined && r.actualChildren !== undefined && (r.actualAdults + r.actualChildren > 0)) {
                total = r.actualAdults + r.actualChildren;
            } else {
                const base = getBaseCapacity(r.type);
                total = base + (r.extraGuests || 0);
            }
            
            const tags = member ? [...member.dietaryRestrictions] : [];
            if (r.notes && r.notes.includes("素")) tags.push("素食 (備註)");
            if (r.notes && r.notes.includes("牛")) tags.push("不吃牛 (備註)");

            return {
                roomCode: r.code,
                guestName: r.currentGuestName,
                people: total,
                breakdown: (r.actualAdults || r.actualChildren) ? `${r.actualAdults}大${r.actualChildren}小` : '預設',
                tags: Array.from(new Set(tags)),
                notes: r.notes || ''
            };
        })
        .filter(item => 
            item.roomCode.includes(searchTerm) || 
            item.guestName?.includes(searchTerm) ||
            item.tags.some(t => t.includes(searchTerm))
        );
  }, [rooms, members, searchTerm]);

  // Inventory Prediction Helpers
  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= item.safetyStock) {
        return { label: '庫存告急', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertTriangle size={14}/>, urgent: true };
    }
    if (item.quantity < item.weeklyUsage) {
        return { label: '建議叫貨', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <ShoppingCart size={14}/>, urgent: true };
    }
    return { label: '庫存充足', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={14}/>, urgent: false };
  };

  const restockSuggestions = useMemo(() => {
    return inventory.filter(item => item.quantity < item.weeklyUsage).length;
  }, [inventory]);

  // Filtered & Sorted Inventory
  const processedInventory = useMemo(() => {
    let result = [...inventory];
    
    // Filter
    if (stockStatusFilter !== 'ALL') {
        result = result.filter(item => {
            const status = getStockStatus(item);
            if (stockStatusFilter === 'LOW') return status.urgent;
            if (stockStatusFilter === 'SUFFICIENT') return !status.urgent;
            return true;
        });
    }

    // Sort
    result.sort((a, b) => {
        let valA = a[sortConfig.field];
        let valB = b[sortConfig.field];
        
        // Handle string vs number sorting
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortConfig.direction === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        }
    });

    return result;
  }, [inventory, stockStatusFilter, sortConfig]);

  // Group Inventory by Category
  const groupedInventory = useMemo(() => {
      const groups: Record<string, InventoryItem[]> = {};
      ORDERED_CATEGORIES.forEach(cat => groups[cat] = []);
      
      // Fallback for items with unknown categories
      groups['其他'] = [];

      processedInventory.forEach(item => {
          if (groups[item.category]) {
              groups[item.category].push(item);
          } else {
              groups['其他'].push(item);
          }
      });
      return groups;
  }, [processedInventory]);


  // Inventory Handlers
  const handleAddItem = () => {
    if (!newItem.name || !newItem.unit) return;
    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name,
      category: newItem.category as any,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      safetyStock: Number(newItem.safetyStock),
      weeklyUsage: Number(newItem.weeklyUsage),
      consumptionPerGuest: Number(newItem.consumptionPerGuest),
      logs: [{
          id: Date.now().toString(),
          date: new Date().toLocaleString(),
          type: 'RESTOCK',
          reason: '初始建檔',
          amount: Number(newItem.quantity),
          balanceAfter: Number(newItem.quantity)
      }]
    };
    onUpdateInventory([...inventory, item]);
    setShowAddModal(false);
    setNewItem({ name: '', category: '肉品', quantity: 0, unit: '', safetyStock: 0, weeklyUsage: 0, consumptionPerGuest: 0 });
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('⚠️ 警告：確定要刪除此食材項目嗎？刪除後無法復原。')) {
      onDeleteInventoryItem(id); // Use the prop function for deletion
    }
  };

  const handleSort = (field: SortField) => {
     setSortConfig(current => ({
         field,
         direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
     }));
  };

  // Trigger Modal instead of direct update
  const initiateAdjustment = (itemId: string, delta: number, currentQty: number) => {
    setPendingAdjustment({ itemId, delta, currentQty });
    // Set default reasons
    if (delta > 0) setAdjustmentReason('進貨/補貨');
    else setAdjustmentReason('一般消耗');
    setCustomNote('');
  };

  const confirmAdjustment = () => {
    if (!pendingAdjustment) return;
    
    const { itemId, delta, currentQty } = pendingAdjustment;
    const newQuantity = Math.max(0, Number((currentQty + delta).toFixed(2)));
    const actualDelta = newQuantity - currentQty; // Recalculate actual change in case of 0 floor
    
    if (actualDelta === 0) {
        setPendingAdjustment(null);
        return;
    }

    const logType: InventoryLog['type'] = 
        delta > 0 ? 'RESTOCK' : 
        adjustmentReason === '報廢/腐壞' ? 'SPOILED' : 
        adjustmentReason === '員工餐' ? 'STAFF_MEAL' : 
        adjustmentReason === '盤點修正' ? 'ADJUSTMENT' : 'USAGE';

    const newLog: InventoryLog = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        type: logType,
        reason: customNote ? `${adjustmentReason}: ${customNote}` : adjustmentReason,
        amount: actualDelta,
        balanceAfter: newQuantity
    };

    onUpdateInventory(inventory.map(item => 
      item.id === itemId ? { 
          ...item, 
          quantity: newQuantity,
          logs: [newLog, ...item.logs] 
      } : item
    ));

    setPendingAdjustment(null);
  };

  const handleAutoDeduct = () => {
    const totalGuests = mealStats.dinner; // Assume dinner is the main consumption event
    if (totalGuests === 0) {
        alert("今日無用餐人數，無法計算消耗。");
        return;
    }
    
    if (window.confirm(`今日用餐人數 ${totalGuests} 人。\n系統將自動扣除相對應的食材庫存，確定執行？`)) {
        onUpdateInventory(inventory.map(item => {
            if (item.consumptionPerGuest > 0) {
                const consumed = Number((totalGuests * item.consumptionPerGuest).toFixed(2));
                const newQty = Math.max(0, Number((item.quantity - consumed).toFixed(2)));
                const actualConsumed = item.quantity - newQty;
                
                if (actualConsumed > 0) {
                    const log: InventoryLog = {
                        id: `auto-${Date.now()}`,
                        date: new Date().toLocaleString(),
                        type: 'USAGE',
                        reason: `系統自動扣除 (${totalGuests}人份)`,
                        amount: -actualConsumed,
                        balanceAfter: newQty
                    };
                    return { ...item, quantity: newQty, logs: [log, ...item.logs] };
                }
            }
            return item;
        }));
        alert("✅ 已成功扣除今日預估消耗量");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortConfig.field !== field) return <ArrowUp size={12} className="opacity-0 group-hover:opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-luxury-gold"/> : <ArrowDown size={12} className="text-luxury-gold"/>;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl md:text-3xl font-serif text-glamping-900 font-bold tracking-wide">廚房與庫存管理</h2>
                <p className="text-glamping-500 mt-1 text-sm">今日餐點統計與食材監控</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-lg border border-glamping-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('MEALS')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'MEALS' ? 'bg-glamping-800 text-white shadow' : 'text-glamping-500 hover:bg-glamping-50'}`}
                >
                    <Utensils size={16} className="inline mr-2"/> 今日備餐
                </button>
                <button 
                  onClick={() => setActiveTab('INVENTORY')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'INVENTORY' ? 'bg-glamping-800 text-white shadow' : 'text-glamping-500 hover:bg-glamping-50'}`}
                >
                    <Package size={16} className="inline mr-2"/> 食材庫存
                </button>
            </div>
        </div>

        {activeTab === 'MEALS' && (
          <div className="space-y-6 animate-slide-up">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">今日早餐</p>
                        <h3 className="text-3xl font-serif font-bold text-glamping-900 mt-1">{mealStats.breakfast} <span className="text-sm text-glamping-500 font-sans font-normal">份</span></h3>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-full text-orange-500"><Coffee size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">今日晚餐</p>
                        <h3 className="text-3xl font-serif font-bold text-glamping-900 mt-1">{mealStats.dinner} <span className="text-sm text-glamping-500 font-sans font-normal">份</span></h3>
                    </div>
                    <div className="p-3 bg-glamping-800 rounded-full text-white"><Utensils size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">特殊飲食</p>
                        <AlertTriangle size={16} className="text-red-400" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(mealStats.diets).length > 0 ? (
                            Object.entries(mealStats.diets).map(([key, count]) => (
                                <span key={key} className="text-xs font-bold px-2 py-1 bg-red-50 text-red-700 rounded border border-red-100">{key}: {count}</span>
                            ))
                        ) : <span className="text-sm text-glamping-400 italic">無特殊需求</span>}
                    </div>
                </div>
            </div>

            {/* Guest List */}
            <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
                <div className="p-4 border-b border-glamping-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-serif font-bold text-glamping-800 flex items-center gap-2">
                        <ChefHat size={20} /> 用餐名單
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="搜尋房號..." 
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-glamping-300 bg-glamping-50 text-sm focus:outline-none focus:ring-2 focus:ring-glamping-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-glamping-50 text-glamping-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4">房號</th>
                                <th className="p-4">姓名</th>
                                <th className="p-4">人數</th>
                                <th className="p-4">飲食禁忌</th>
                                <th className="p-4">備註</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-glamping-100">
                            {diningList.length > 0 ? diningList.map((item, idx) => (
                                <tr key={idx} className="hover:bg-glamping-50">
                                    <td className="p-4 font-serif font-bold text-luxury-gold">{item.roomCode}</td>
                                    <td className="p-4 font-bold">{item.guestName}</td>
                                    <td className="p-4">
                                        {item.people} 位 
                                        <span className="ml-1 text-xs text-glamping-400">({item.breakdown})</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {item.tags.map((tag, i) => (
                                                <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded border border-red-100">{tag}</span>
                                            ))}
                                            {item.tags.length === 0 && '-'}
                                        </div>
                                    </td>
                                    <td className="p-4 text-glamping-500 truncate max-w-[150px]">{item.notes}</td>
                                </tr>
                            )) : <tr><td colSpan={5} className="p-8 text-center text-glamping-400">暫無資料</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-slide-up">
             
             {/* Prediction Summary Card */}
             {restockSuggestions > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-900 shadow-sm">
                   <div className="flex items-center gap-3">
                       <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                          <ShoppingCart size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-lg">採購建議</h4>
                          <p className="text-sm opacity-80">系統預測有 <strong>{restockSuggestions}</strong> 項食材庫存不足一週，建議儘早叫貨。</p>
                       </div>
                   </div>
                </div>
             )}

             <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex items-center gap-2 bg-white rounded-lg border border-glamping-200 p-1">
                   <button onClick={() => setStockStatusFilter('ALL')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${stockStatusFilter === 'ALL' ? 'bg-glamping-800 text-white' : 'text-glamping-500 hover:bg-glamping-50'}`}>全部</button>
                   <button onClick={() => setStockStatusFilter('LOW')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${stockStatusFilter === 'LOW' ? 'bg-red-500 text-white' : 'text-glamping-500 hover:bg-glamping-50'}`}>庫存告急</button>
                   <button onClick={() => setStockStatusFilter('SUFFICIENT')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${stockStatusFilter === 'SUFFICIENT' ? 'bg-emerald-500 text-white' : 'text-glamping-500 hover:bg-glamping-50'}`}>庫存充足</button>
                </div>

                <div className="flex gap-2">
                    {/* Reset Button */}
                    {onResetInventory && (
                        <button 
                            onClick={onResetInventory}
                            className="flex items-center gap-2 bg-gray-100 text-gray-600 border border-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition shadow-sm text-sm"
                            title="重置為預設庫存"
                        >
                            <RotateCcw size={16} />
                        </button>
                    )}
                    <button 
                    onClick={handleAutoDeduct}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition shadow-sm text-sm"
                    >
                        <TrendingDown size={16} /> 扣除今日消耗
                    </button>
                    <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-luxury-gold text-white px-4 py-2 rounded-lg font-bold hover:bg-yellow-600 transition shadow-sm text-sm"
                    >
                        <Plus size={16} /> 新增食材
                    </button>
                </div>
             </div>

             {/* GROUPED INVENTORY LIST */}
             <div className="space-y-8">
                {Object.keys(groupedInventory).map(category => {
                    const items = groupedInventory[category];
                    if (items.length === 0) return null;
                    const config = CATEGORY_CONFIG[category] || { icon: <Package size={20}/>, color: 'text-gray-600', bg: 'bg-gray-50' };

                    return (
                        <div key={category} className="animate-fade-in">
                             {/* Category Header */}
                             <h3 className={`font-serif font-bold text-lg mb-3 flex items-center gap-2 ${config.color} border-l-4 pl-3 border-current`}>
                                 <span className={`p-1.5 rounded-lg ${config.bg}`}>{config.icon}</span>
                                 {category}
                                 <span className="text-sm font-sans font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{items.length} 項</span>
                             </h3>

                             <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-glamping-50 text-glamping-500 font-bold uppercase text-xs border-b border-glamping-100">
                                            <tr>
                                                <th className="p-4 cursor-pointer hover:bg-glamping-100 group w-1/4" onClick={() => handleSort('name')}>
                                                    <div className="flex items-center gap-1">品項名稱 <SortIcon field="name"/></div>
                                                </th>
                                                <th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('quantity')}>
                                                    <div className="flex items-center gap-1">當前庫存 <SortIcon field="quantity"/></div>
                                                </th>
                                                <th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('safetyStock')}>
                                                    <div className="flex items-center gap-1">安全水位 <SortIcon field="safetyStock"/></div>
                                                </th>
                                                <th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('weeklyUsage')}>
                                                    <div className="flex items-center gap-1">預估週用量 <SortIcon field="weeklyUsage"/></div>
                                                </th>
                                                <th className="p-4">庫存健康度</th>
                                                <th className="p-4 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-glamping-100">
                                            {items.map(item => {
                                                const status = getStockStatus(item);
                                                return (
                                                <tr key={item.id} className="hover:bg-glamping-50 group">
                                                    <td className="p-4">
                                                        <div className="font-bold text-glamping-900">{item.name}</div>
                                                        <button 
                                                            onClick={() => setViewingHistoryItem(item)}
                                                            className="text-xs text-glamping-400 hover:text-luxury-gold flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <History size={12}/> 查看紀錄
                                                        </button>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => initiateAdjustment(item.id, -1, item.quantity)}
                                                                className="w-6 h-6 rounded bg-gray-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center font-bold transition-colors"
                                                            >-</button>
                                                            <span className={`font-mono font-bold text-lg ${item.quantity <= item.safetyStock ? 'text-red-500' : 'text-glamping-800'}`}>
                                                                {item.quantity}
                                                            </span>
                                                            <span className="text-xs text-glamping-500">{item.unit}</span>
                                                            <button 
                                                                onClick={() => initiateAdjustment(item.id, 1, item.quantity)}
                                                                className="w-6 h-6 rounded bg-gray-100 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center font-bold transition-colors"
                                                            >+</button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-glamping-500">{item.safetyStock} {item.unit}</td>
                                                    <td className="p-4 text-glamping-500 flex items-center gap-1">
                                                        <Clock size={14} className="opacity-50"/> {item.weeklyUsage} {item.unit}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                                                            {status.icon} {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteItem(item.id);
                                                          }}
                                                          className="text-glamping-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                                                          title="刪除此品項"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        </div>
                    );
                })}
             </div>
          </div>
        )}

        {/* Reason / Adjustment Modal */}
        {pendingAdjustment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
                    <h3 className="font-serif font-bold text-xl mb-4 text-glamping-900 flex items-center gap-2">
                        {pendingAdjustment.delta > 0 ? <Plus size={24} className="text-emerald-500"/> : <TrendingDown size={24} className="text-red-500"/>}
                        {pendingAdjustment.delta > 0 ? '增加庫存' : '減少庫存'}
                    </h3>
                    
                    <p className="text-sm text-glamping-600 mb-4">
                        將 {inventory.find(i => i.id === pendingAdjustment.itemId)?.name} 數量 
                        <span className="font-bold mx-1">
                             {pendingAdjustment.delta > 0 ? '+' : ''}{pendingAdjustment.delta}
                        </span>
                        (變更為 {Math.max(0, pendingAdjustment.currentQty + pendingAdjustment.delta)})
                    </p>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-glamping-500 uppercase">變更原因</label>
                        <select 
                            className="w-full border rounded-lg px-3 py-2 bg-glamping-50 font-medium"
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                        >
                            {pendingAdjustment.delta > 0 ? (
                                <>
                                    <option value="進貨/補貨">進貨 / 補貨</option>
                                    <option value="盤點修正">盤點修正 (少記了)</option>
                                    <option value="退貨歸還">客人退貨 / 歸還</option>
                                </>
                            ) : (
                                <>
                                    <option value="一般消耗">一般消耗 (備餐)</option>
                                    <option value="員工餐">員工餐使用</option>
                                    <option value="報廢/腐壞">報廢 / 腐壞</option>
                                    <option value="盤點修正">盤點修正 (多記了)</option>
                                </>
                            )}
                        </select>
                        
                        <input 
                            type="text"
                            placeholder="備註說明 (選填)"
                            className="w-full border rounded-lg px-3 py-2"
                            value={customNote}
                            onChange={e => setCustomNote(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-6">
                        <button onClick={() => setPendingAdjustment(null)} className="flex-1 py-2 border rounded text-glamping-600 hover:bg-glamping-50">取消</button>
                        <button onClick={confirmAdjustment} className="flex-1 py-2 bg-glamping-800 text-white rounded font-bold hover:bg-glamping-900">確認變更</button>
                    </div>
                </div>
            </div>
        )}

        {/* History Modal */}
        {viewingHistoryItem && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
                    <div className="p-6 border-b border-glamping-200 flex justify-between items-center">
                        <div>
                             <h3 className="font-serif font-bold text-xl text-glamping-900">{viewingHistoryItem.name}</h3>
                             <p className="text-sm text-glamping-500">庫存變更紀錄</p>
                        </div>
                        <button onClick={() => setViewingHistoryItem(null)} className="text-glamping-400 hover:text-glamping-600"><X size={24}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        {viewingHistoryItem.logs.length === 0 ? (
                            <div className="text-center text-glamping-400 py-12">尚無變更紀錄</div>
                        ) : (
                            <div className="space-y-4">
                                {viewingHistoryItem.logs.map((log, idx) => (
                                    <div key={idx} className="flex gap-4 items-start pb-4 border-b border-glamping-100 last:border-0">
                                        <div className={`mt-1 p-2 rounded-full shrink-0 ${
                                            log.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 
                                            log.type === 'SPOILED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {log.amount > 0 ? <Plus size={16}/> : <TrendingDown size={16}/>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-glamping-800">{log.reason}</span>
                                                <span className="text-xs text-glamping-400">{log.date}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className={`text-sm font-bold ${log.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {log.amount > 0 ? '+' : ''}{log.amount} {viewingHistoryItem.unit}
                                                </span>
                                                <span className="text-xs text-glamping-500 bg-glamping-50 px-2 py-0.5 rounded">
                                                    結餘: {log.balanceAfter}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
             </div>
        )}

        {/* Add Item Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scale-in">
                    <h3 className="font-serif font-bold text-xl mb-4 text-glamping-900">新增食材品項</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-glamping-500 mb-1">品項名稱</label>
                            <input type="text" className="w-full border rounded px-3 py-2" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">類別</label>
                                <select className="w-full border rounded px-3 py-2" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value as any})}>
                                    <option value="肉品">肉品</option>
                                    <option value="海鮮">海鮮</option>
                                    <option value="蔬果">蔬果</option>
                                    <option value="酒水">酒水</option>
                                    <option value="乾貨">乾貨</option>
                                    <option value="消耗品">消耗品</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">單位</label>
                                <input type="text" className="w-full border rounded px-3 py-2" placeholder="kg, 瓶, 包" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">初始庫存</label>
                                <input type="number" className="w-full border rounded px-3 py-2" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">安全水位</label>
                                <input type="number" className="w-full border rounded px-3 py-2" value={newItem.safetyStock} onChange={e => setNewItem({...newItem, safetyStock: Number(e.target.value)})} />
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">預估每週總用量</label>
                                <input type="number" className="w-full border rounded px-3 py-2" placeholder="做為叫貨預測基準" value={newItem.weeklyUsage} onChange={e => setNewItem({...newItem, weeklyUsage: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-glamping-500 mb-1">每人消耗量 (自動扣除用)</label>
                                <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={newItem.consumptionPerGuest} onChange={e => setNewItem({...newItem, consumptionPerGuest: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded text-glamping-600">取消</button>
                            <button onClick={handleAddItem} className="flex-1 py-2 bg-glamping-800 text-white rounded font-bold">新增</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default KitchenManagement;
