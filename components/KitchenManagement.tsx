
import React, { useMemo, useState, useEffect } from 'react';
import { Room, RoomStatus, RoomType, Member, InventoryItem, InventoryLog, BookingRecord } from '../types';
import { Utensils, Coffee, AlertTriangle, ChefHat, Package, Plus, Trash2, TrendingDown, ShoppingCart, Clock, CheckCircle, Search, FileText, History, X, ArrowUp, ArrowDown, Beef, Fish, Carrot, Wine, Wheat, Box, RotateCcw, Calendar, ChevronLeft, ChevronRight, Soup, Sparkles, Loader, Snowflake, Droplet, Cookie, Wrench, Tag, FolderPlus, Minus, CheckSquare } from 'lucide-react';
import { generateKitchenAdvice } from '../services/geminiService';

interface KitchenManagementProps {
  rooms: Room[];
  members: Member[];
  inventory: InventoryItem[];
  bookingRecords: BookingRecord[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  onDeleteInventoryItem: (id: string) => void;
  onResetInventory?: () => void;
}

type SortField = 'name' | 'quantity' | 'safetyStock' | 'weeklyUsage';
type SortDirection = 'asc' | 'desc';

// Base Categories
const BASE_CATEGORIES: Record<string, { icon: React.ReactNode, color: string, bg: string }> = {
    '火鍋菜盤': { icon: <Carrot size={20}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    '火鍋冷凍': { icon: <Snowflake size={20}/>, color: 'text-sky-600', bg: 'bg-sky-50' },
    '火鍋沾料': { icon: <Droplet size={20}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
    '早餐食材': { icon: <Wheat size={20}/>, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    '下午茶': { icon: <Coffee size={20}/>, color: 'text-rose-600', bg: 'bg-rose-50' },
    'DIY': { icon: <Wrench size={20}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
    '豬牛肉': { icon: <Beef size={20}/>, color: 'text-red-700', bg: 'bg-red-50' },
    '海鮮': { icon: <Fish size={20}/>, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    '其他': { icon: <Box size={20}/>, color: 'text-gray-600', bg: 'bg-gray-50' },
};

const KitchenManagement: React.FC<KitchenManagementProps> = ({ rooms, members, inventory, bookingRecords, onUpdateInventory, onDeleteInventoryItem, onResetInventory }) => {
  const [activeTab, setActiveTab] = useState<'MEALS' | 'INVENTORY'>('MEALS');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Custom Category Logic
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('glamping_custom_categories');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
      localStorage.setItem('glamping_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Merge Base + Custom Categories
  const allCategoryNames = useMemo(() => {
      const baseNames = Object.keys(BASE_CATEGORIES).filter(k => k !== '其他');
      const combined = Array.from(new Set([...baseNames, ...customCategories]));
      return combined.filter(c => c !== '其他').concat('其他');
  }, [customCategories]);

  const getCategoryConfig = (cat: string) => {
      if (BASE_CATEGORIES[cat]) return BASE_CATEGORIES[cat];
      return { icon: <Tag size={20}/>, color: 'text-slate-600', bg: 'bg-slate-100' };
  };

  const handleAddCustomCategory = () => {
      if (newCategoryName.trim()) {
          if (!allCategoryNames.includes(newCategoryName.trim())) {
              setCustomCategories([...customCategories, newCategoryName.trim()]);
              setNewItem({ ...newItem, category: newCategoryName.trim() });
              setNewCategoryName('');
              setIsAddingCategory(false);
          } else {
              alert("此類別已存在！");
          }
      }
  };

  // AI Advice State
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'SUFFICIENT'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ field: SortField, direction: SortDirection }>({ field: 'name', direction: 'asc' });

  // --- ADJUSTMENT STATE ---
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('一般消耗');
  const [customNote, setCustomNote] = useState('');
  
  const [viewingHistoryItem, setViewingHistoryItem] = useState<InventoryItem | null>(null);

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '', category: '火鍋菜盤', quantity: 0, unit: '', safetyStock: 0, weeklyUsage: 0, consumptionPerGuest: 0
  });

  const getBaseCapacity = (type: RoomType) => { if (type === RoomType.PALACE_TENT || type === RoomType.VIP_TENT) return 4; return 2; };
  const shiftDate = (days: number) => { const d = new Date(selectedDate); d.setDate(d.getDate() + days); setSelectedDate(d.toISOString().split('T')[0]); setAiAdvice(""); };
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const calculatePlatters = (people: number) => { let two=0, three=0; if(people<=0)return{two,three}; if(people<=2)two=1;else if(people===3)three=1;else if(people===4)two=2;else if(people===5){two=1;three=1;}else if(people===6)three=2;else{three=Math.floor(people/3);if(people%3===1){if(three>0){three--;two+=2;}else two++;}else if(people%3===2)two++;} return {two, three}; };

  const mealStats = useMemo(() => {
    let totalBreakfast=0, totalDinner=0; const diets:Record<string,number>={};
    let vegPlatters={two:0,three:0}, meatPlatters={two:0,three:0}, seafoodPlatters={two:0,three:0};
    const processRoom = (a:number, c:number, e:number, type:RoomType, n:string, g:string, isDinner:boolean) => {
        let count = a+c>0 ? a+c : getBaseCapacity(type)+e;
        if(count===0) return 0;
        let veg=0, noSea=0;
        const m = members.find(mem=>mem.name===g);
        const tags = new Set<string>();
        if(m) m.dietaryRestrictions.forEach(r=>tags.add(r));
        const note = (n||"")+(m?.notes||"");
        if(note.includes("素")) tags.add("素食");
        if(note.includes("海鮮過敏")||note.includes("不吃海鮮")) tags.add("海鮮過敏");
        if(note.includes("牛")) tags.add("不吃牛");

        if(tags.has("素食")) {
            const match = note.match(/(\d+)[位個人]*[素]/);
            veg = (note.includes("全素")||note.includes("都素")) ? count : (match ? parseInt(match[1],10) : 1);
        }
        if(tags.has("海鮮過敏")) {
             const match = note.match(/(\d+)[位個人]*[不無過].*[海]/);
             noSea = (note.includes("都不吃海鮮")||note.includes("全不吃海鮮")) ? count : (match ? parseInt(match[1],10) : 1);
        }

        if(isDinner) {
            const vp = calculatePlatters(veg); vegPlatters.two+=vp.two; vegPlatters.three+=vp.three;
            const mp = calculatePlatters(Math.max(0, count-veg)); meatPlatters.two+=mp.two; meatPlatters.three+=mp.three;
            const sp = calculatePlatters(Math.max(0, count-veg-noSea)); seafoodPlatters.two+=sp.two; seafoodPlatters.three+=sp.three;
        }
        tags.forEach(t=>diets[t]=(diets[t]||0)+1);
        return count;
    };

    if(isToday) {
        const todayStr = new Date().toISOString().split('T')[0];
        rooms.filter(r=>r.status===RoomStatus.OCCUPIED).forEach(r=>{
            const isCheckOutToday = r.checkOutDate === todayStr;
            const isDinner = !isCheckOutToday; 
            const isBreakfast = r.checkInDate !== todayStr;
            const c = processRoom(r.actualAdults||0, r.actualChildren||0, r.extraGuests, r.type, r.notes||"", r.currentGuestName||"", isDinner);
            if(isDinner) totalDinner+=c; if(isBreakfast) totalBreakfast+=c;
        });
    } else {
        bookingRecords.filter(r=>{if(!r.checkOutDate)return r.checkInDate===selectedDate; return selectedDate>=r.checkInDate && selectedDate<=r.checkOutDate;}).forEach(r=>{
            const isCheckOutToday = r.checkOutDate === selectedDate;
            const isCheckInToday = r.checkInDate === selectedDate;
            const isDinner = !isCheckOutToday; 
            const isBreakfast = !isCheckInToday;
            const c = processRoom(r.actualAdults||0, r.actualChildren||0, r.extraGuests, r.roomType as RoomType, r.notes||"", r.guestName, isDinner);
            if(isDinner) totalDinner+=c; if(isBreakfast) totalBreakfast+=c;
        });
    }
    return { breakfast: totalBreakfast, dinner: totalDinner, diets, platters: { veg: vegPlatters, meat: meatPlatters, seafood: seafoodPlatters } };
  }, [rooms, members, bookingRecords, selectedDate, isToday]);

  const diningList = useMemo(() => {
     let list = [];
     if (isToday) {
         list = rooms.filter(r=>r.status===RoomStatus.OCCUPIED).map(r=>{
             const m = members.find(mem=>mem.name===r.currentGuestName);
             let t=0; if(r.actualAdults!==undefined && r.actualChildren!==undefined && (r.actualAdults+r.actualChildren>0)) t=r.actualAdults+r.actualChildren; else t=getBaseCapacity(r.type)+(r.extraGuests||0);
             const tags = m ? [...m.dietaryRestrictions] : [];
             if(r.notes && r.notes.includes("素")) tags.push("素食(備註)");
             if(r.notes && r.notes.includes("牛")) tags.push("不吃牛(備註)");
             return { roomCode: r.code, guestName: r.currentGuestName, people: t, breakdown: (r.actualAdults||r.actualChildren)?`${r.actualAdults}大${r.actualChildren}小`:'預設', tags: Array.from(new Set(tags)), notes: r.notes||'' };
         });
     } else {
         list = bookingRecords.filter(r=>{if(!r.checkOutDate)return r.checkInDate===selectedDate; return selectedDate>=r.checkInDate && selectedDate<=r.checkOutDate;}).map(r=>{
             let t=0; if(r.actualAdults!==undefined && r.actualChildren!==undefined && (r.actualAdults+r.actualChildren>0)) t=r.actualAdults+r.actualChildren; else {let b=2; if(r.roomType.includes("皇宮")||r.roomType.includes("尊爵"))b=4; t=b+(r.extraGuests||0);}
             let st = r.checkInDate===selectedDate?'(入住)':(r.checkOutDate===selectedDate?'(退房)':'(續住)');
             const tags = []; if(r.notes?.includes("素")) tags.push("見備註");
             return { roomCode: r.roomCode, guestName: r.guestName+st, people: t, breakdown: (r.actualAdults||r.actualChildren)?`${r.actualAdults}大${r.actualChildren}小`:'預測', tags, notes: r.notes||'' };
         });
     }
     return list.filter(i=>i.roomCode.includes(searchTerm)||i.guestName?.includes(searchTerm)||i.tags.some(t=>t.includes(searchTerm)));
  }, [rooms, members, bookingRecords, selectedDate, isToday, searchTerm]);

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= item.safetyStock) { return { label: '庫存告急', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertTriangle size={14}/>, urgent: true }; }
    if (item.quantity < item.weeklyUsage) { return { label: '建議叫貨', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <ShoppingCart size={14}/>, urgent: true }; }
    return { label: '庫存充足', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={14}/>, urgent: false };
  };

  const restockSuggestions = useMemo(()=>inventory.filter(i=>i.quantity<i.weeklyUsage).length,[inventory]);
  
  // Search Filter - searches across ALL categories
  const processedInventory = useMemo(()=>{
      let res = [...inventory];
      if(searchTerm) {
          const lower = searchTerm.toLowerCase();
          res = res.filter(i => i.name.toLowerCase().includes(lower) || i.category.toLowerCase().includes(lower));
      }
      if(stockStatusFilter!=='ALL') res=res.filter(i=>{const s=getStockStatus(i); return stockStatusFilter==='LOW'?s.urgent:!s.urgent;});
      res.sort((a,b)=>{
          let vA=a[sortConfig.field], vB=b[sortConfig.field];
          if(typeof vA==='string'&&typeof vB==='string') return sortConfig.direction==='asc'?vA.localeCompare(vB):vB.localeCompare(vA);
          return sortConfig.direction==='asc'?(vA as number)-(vB as number):(vB as number)-(vA as number);
      });
      return res;
  },[inventory, stockStatusFilter, sortConfig, searchTerm]);

  const groupedInventory = useMemo(() => {
      const groups: Record<string, InventoryItem[]> = {};
      allCategoryNames.forEach(cat => groups[cat] = []);
      
      processedInventory.forEach(item => {
          if (groups[item.category]) groups[item.category].push(item);
          else {
            // Fallback for items with categories not in current list
            if (!groups['其他']) groups['其他'] = [];
            groups['其他'].push(item);
          }
      });
      return groups;
  }, [processedInventory, allCategoryNames]);

  const handleAddItem = () => {
    if (!newItem.name || !newItem.unit) return;
    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name,
      category: newItem.category as string,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      safetyStock: Number(newItem.safetyStock),
      weeklyUsage: Number(newItem.weeklyUsage),
      consumptionPerGuest: Number(newItem.consumptionPerGuest),
      logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), type: 'RESTOCK', reason: '初始建檔', amount: Number(newItem.quantity), balanceAfter: Number(newItem.quantity) }]
    };
    onUpdateInventory([...inventory, item]);
    setShowAddModal(false);
    setNewItem({ name: '', category: '火鍋菜盤', quantity: 0, unit: '', safetyStock: 0, weeklyUsage: 0, consumptionPerGuest: 0 });
  };
  
  const handleDeleteItem = (id: string) => { if(window.confirm('⚠️ 警告：確定要刪除此食材項目嗎？')) onDeleteInventoryItem(id); };
  const handleSort = (field: SortField) => { setSortConfig(c=>({field, direction: c.field===field && c.direction==='asc'?'desc':'asc'})); };
  
  // --- Smart Batch Adjustment Handlers ---
  const openAdjustmentModal = (item: InventoryItem, initialDelta: number = 0) => {
      setAdjustmentItem(item);
      setAdjustmentDelta(initialDelta);
      setAdjustmentReason(initialDelta >= 0 ? '進貨/補貨' : '一般消耗');
      setCustomNote('');
  };

  const handleBatchUpdate = () => {
      if(!adjustmentItem || adjustmentDelta === 0) return;
      
      const newQ = Math.max(0, Number((adjustmentItem.quantity + adjustmentDelta).toFixed(2)));
      const actualDelta = newQ - adjustmentItem.quantity;
      
      if(actualDelta === 0) { setAdjustmentItem(null); return; }
      
      const logType: InventoryLog['type'] = adjustmentDelta > 0 ? 'RESTOCK' : adjustmentReason.includes('報廢') ? 'SPOILED' : adjustmentReason.includes('員工') ? 'STAFF_MEAL' : adjustmentReason.includes('修正') ? 'ADJUSTMENT' : 'USAGE';
      
      const newLog: InventoryLog = {
          id: Date.now().toString(),
          date: new Date().toLocaleString(),
          type: logType,
          reason: customNote ? `${adjustmentReason}: ${customNote}` : adjustmentReason,
          amount: actualDelta,
          balanceAfter: newQ
      };
      
      onUpdateInventory(inventory.map(i => i.id === adjustmentItem.id ? { ...i, quantity: newQ, logs: [newLog, ...i.logs] } : i));
      setAdjustmentItem(null);
      setAdjustmentDelta(0);
  };

  const handleAutoDeduct = () => {
      const guests = mealStats.dinner; if(guests===0){alert("無用餐人數");return;}
      if(window.confirm(`今日用餐人數 ${guests} 人。\n確定扣除預估消耗？`)) {
          onUpdateInventory(inventory.map(i=>{
              if(i.consumptionPerGuest>0){
                  const c=Number((guests*i.consumptionPerGuest).toFixed(2)); const nq=Math.max(0, Number((i.quantity-c).toFixed(2))); const ac=i.quantity-nq;
                  if(ac>0){ const l:InventoryLog={id:`auto-${Date.now()}`, date:new Date().toLocaleString(), type:'USAGE', reason:`自動扣除(${guests}人)`, amount:-ac, balanceAfter:nq}; return {...i, quantity:nq, logs:[l,...i.logs]}; }
              } return i;
          })); alert("✅ 已扣除");
      }
  };
  const handleGenerateAdvice = async () => { setIsGeneratingAdvice(true); try{const ad=await generateKitchenAdvice(selectedDate, mealStats, diningList); setAiAdvice(ad);}catch(e){setAiAdvice("無法產生建議");}finally{setIsGeneratingAdvice(false);} };
  const SortIcon = ({ field }: { field: SortField }) => { if(sortConfig.field!==field)return<ArrowUp size={12} className="opacity-0 group-hover:opacity-30"/>; return sortConfig.direction==='asc'?<ArrowUp size={12} className="text-luxury-gold"/>:<ArrowDown size={12} className="text-luxury-gold"/>; };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div><h2 className="text-2xl md:text-3xl font-serif text-glamping-900 font-bold tracking-wide">廚房與庫存管理</h2><p className="text-glamping-500 mt-1 text-sm">今日餐點統計與食材監控</p></div>
            <div className="flex bg-white p-1 rounded-lg border border-glamping-200 shadow-sm">
                <button onClick={() => setActiveTab('MEALS')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'MEALS' ? 'bg-glamping-800 text-white shadow' : 'text-glamping-500 hover:bg-glamping-50'}`}><Utensils size={16} className="inline mr-2"/> 備餐計畫</button>
                <button onClick={() => setActiveTab('INVENTORY')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'INVENTORY' ? 'bg-glamping-800 text-white shadow' : 'text-glamping-500 hover:bg-glamping-50'}`}><Package size={16} className="inline mr-2"/> 食材庫存</button>
            </div>
        </div>

        {activeTab === 'MEALS' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-center gap-4 bg-white p-3 rounded-xl border border-glamping-200 shadow-sm">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-glamping-100 rounded-full"><ChevronLeft size={20}/></button>
                <div className="flex flex-col items-center"><div className="flex items-center gap-2 text-lg font-serif font-bold text-glamping-900"><Calendar size={20} className="text-luxury-gold" /><input type="date" className="bg-transparent text-center focus:outline-none cursor-pointer" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setAiAdvice(""); }} /></div>{isToday ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">即時房態</span> : <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1">預測數據</span>}</div>
                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-glamping-100 rounded-full"><ChevronRight size={20}/></button>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-glamping-900 text-white rounded-xl p-6 shadow-lg border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><ChefHat size={100} /></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-serif font-bold flex items-center gap-2 text-luxury-gold"><Sparkles size={18} /> AI 主廚備餐叮嚀</h3>{!aiAdvice && (<button onClick={handleGenerateAdvice} disabled={isGeneratingAdvice} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center gap-2 disabled:opacity-50">{isGeneratingAdvice ? <><Loader size={14} className="animate-spin"/> 生成中...</> : '✨ 生成建議'}</button>)}</div>
                    {aiAdvice ? <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-line bg-white/5 p-4 rounded-lg border border-white/10">{aiAdvice}</div> : <p className="text-gray-400 text-sm italic">點擊上方按鈕，讓 AI 根據今日的房型人數與飲食禁忌，提供專業的備料順序與注意事項建議。</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200 flex items-center justify-between"><div><p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">{isToday ? '今日早餐' : `${selectedDate.split('-')[1]}/${selectedDate.split('-')[2]} 早餐`}</p><h3 className="text-3xl font-serif font-bold text-glamping-900 mt-1">{mealStats.breakfast} <span className="text-sm text-glamping-500 font-sans font-normal">份</span></h3></div><div className="p-3 bg-orange-50 rounded-full text-orange-500"><Coffee size={24} /></div></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200 flex items-center justify-between"><div><p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">{isToday ? '今日晚餐' : `${selectedDate.split('-')[1]}/${selectedDate.split('-')[2]} 晚餐`}</p><h3 className="text-3xl font-serif font-bold text-glamping-900 mt-1">{mealStats.dinner} <span className="text-sm text-glamping-500 font-sans font-normal">份</span></h3></div><div className="p-3 bg-glamping-800 rounded-full text-white"><Utensils size={24} /></div></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-glamping-200"><div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">特殊飲食</p><AlertTriangle size={16} className="text-red-400" /></div><div className="flex flex-wrap gap-2">{Object.entries(mealStats.diets).length > 0 ? Object.entries(mealStats.diets).map(([key, count]) => (<span key={key} className="text-xs font-bold px-2 py-1 bg-red-50 text-red-700 rounded border border-red-100">{key}: {count}</span>)) : <span className="text-sm text-glamping-400 italic">無特殊需求</span>}</div></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
                <div className="bg-glamping-50 px-4 py-3 border-b border-glamping-100"><h3 className="font-serif font-bold text-glamping-800 flex items-center gap-2"><Soup size={20} className="text-luxury-gold"/> 晚餐備料指引 (菜盤/海鮮盤)</h3></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100"><h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><span className="w-2 h-6 bg-amber-500 rounded-full"></span> 葷食高湯菜盤 (一般)</h4><div className="space-y-2"><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-amber-100"><span className="text-sm font-bold text-glamping-600">雙人盤 (2人份)</span><span className="text-xl font-serif font-bold text-amber-600">{mealStats.platters.meat.two} <span className="text-xs text-glamping-400">盤</span></span></div><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-amber-100"><span className="text-sm font-bold text-glamping-600">三人盤 (3人份)</span><span className="text-xl font-serif font-bold text-amber-600">{mealStats.platters.meat.three} <span className="text-xs text-glamping-400">盤</span></span></div></div></div>
                    <div className="bg-sky-50 rounded-xl p-4 border border-sky-100"><h4 className="font-bold text-sky-900 mb-3 flex items-center gap-2"><span className="w-2 h-6 bg-sky-500 rounded-full"></span> 海鮮盤 (扣除過敏/素食)</h4><div className="space-y-2"><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-sky-100"><span className="text-sm font-bold text-glamping-600">雙人盤 (2人份)</span><span className="text-xl font-serif font-bold text-sky-600">{mealStats.platters.seafood.two} <span className="text-xs text-glamping-400">盤</span></span></div><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-sky-100"><span className="text-sm font-bold text-glamping-600">三人盤 (3人份)</span><span className="text-xl font-serif font-bold text-sky-600">{mealStats.platters.seafood.three} <span className="text-xs text-glamping-400">盤</span></span></div></div></div>
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100"><h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2"><span className="w-2 h-6 bg-emerald-500 rounded-full"></span> 素食菜盤 (純素)</h4><div className="space-y-2"><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-emerald-100"><span className="text-sm font-bold text-glamping-600">雙人盤 (2人份)</span><span className="text-xl font-serif font-bold text-emerald-600">{mealStats.platters.veg.two} <span className="text-xs text-glamping-400">盤</span></span></div><div className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-emerald-100"><span className="text-sm font-bold text-glamping-600">三人盤 (3人份)</span><span className="text-xl font-serif font-bold text-emerald-600">{mealStats.platters.veg.three} <span className="text-xs text-glamping-400">盤</span></span></div></div></div>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
                <div className="p-4 border-b border-glamping-100 flex flex-col sm:flex-row justify-between items-center gap-4"><h3 className="font-serif font-bold text-glamping-800 flex items-center gap-2"><ChefHat size={20} /> 用餐名單</h3><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={16} /><input type="text" placeholder="搜尋房號..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-glamping-300 bg-glamping-50 text-sm focus:outline-none focus:ring-2 focus:ring-glamping-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-glamping-50 text-glamping-500 font-bold uppercase text-xs"><tr><th className="p-4">房號</th><th className="p-4">姓名</th><th className="p-4">人數</th><th className="p-4">飲食禁忌</th><th className="p-4">備註</th></tr></thead><tbody className="divide-y divide-glamping-100">{diningList.length > 0 ? diningList.map((item, idx) => (<tr key={idx} className="hover:bg-glamping-50"><td className="p-4 font-serif font-bold text-luxury-gold">{item.roomCode}</td><td className="p-4 font-bold">{item.guestName}</td><td className="p-4">{item.people} 位 <span className="ml-1 text-xs text-glamping-400">({item.breakdown})</span></td><td className="p-4"><div className="flex flex-wrap gap-1">{item.tags.map((tag, i) => (<span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded border border-red-100">{tag}</span>))}{item.tags.length === 0 && '-'}</div></td><td className="p-4 text-glamping-500 truncate max-w-[150px]">{item.notes}</td></tr>)) : <tr><td colSpan={5} className="p-8 text-center text-glamping-400">暫無資料</td></tr>}</tbody></table></div>
            </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-slide-up">
             <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={18} />
                   <input 
                      type="text" 
                      placeholder="快速搜尋全庫存 (品項、類別)..." 
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white text-sm shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-glamping-200 p-1">
                        <button onClick={() => setStockStatusFilter('ALL')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${stockStatusFilter === 'ALL' ? 'bg-glamping-800 text-white' : 'text-glamping-500 hover:bg-glamping-50'}`}>全部</button>
                        <button onClick={() => setStockStatusFilter('LOW')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${stockStatusFilter === 'LOW' ? 'bg-red-500 text-white' : 'text-glamping-500 hover:bg-glamping-50'}`}>庫存告急</button>
                    </div>
                    <button onClick={handleAutoDeduct} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition shadow-sm text-sm"><TrendingDown size={16} /> 扣除今日</button>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-luxury-gold text-white px-4 py-2 rounded-lg font-bold hover:bg-yellow-600 transition shadow-sm text-sm"><Plus size={16} /> 新增</button>
                </div>
             </div>
             
             {/* GROUPED INVENTORY LIST */}
             <div className="space-y-8">
                {allCategoryNames.map(category => {
                    const items = groupedInventory[category] || [];
                    if (items.length === 0) return null;
                    const config = getCategoryConfig(category);

                    return (
                        <div key={category} className="animate-fade-in">
                             <h3 className={`font-serif font-bold text-lg mb-3 flex items-center gap-2 ${config.color} border-l-4 pl-3 border-current`}><span className={`p-1.5 rounded-lg ${config.bg}`}>{config.icon}</span>{category}<span className="text-sm font-sans font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{items.length} 項</span></h3>
                             <div className="bg-white rounded-xl shadow-sm border border-glamping-200 overflow-hidden">
                                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-glamping-50 text-glamping-500 font-bold uppercase text-xs border-b border-glamping-100"><tr><th className="p-4 cursor-pointer hover:bg-glamping-100 group w-1/4" onClick={() => handleSort('name')}><div className="flex items-center gap-1">品項名稱 <SortIcon field="name"/></div></th><th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('quantity')}><div className="flex items-center gap-1">當前庫存 <SortIcon field="quantity"/></div></th><th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('safetyStock')}><div className="flex items-center gap-1">安全水位 <SortIcon field="safetyStock"/></div></th><th className="p-4 cursor-pointer hover:bg-glamping-100 group" onClick={() => handleSort('weeklyUsage')}><div className="flex items-center gap-1">預估週用量 <SortIcon field="weeklyUsage"/></div></th><th className="p-4">庫存健康度</th><th className="p-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-glamping-100">{items.map(item => { const status = getStockStatus(item); return (<tr key={item.id} className="hover:bg-glamping-50 group"><td className="p-4"><div className="font-bold text-glamping-900">{item.name}</div><button onClick={() => setViewingHistoryItem(item)} className="text-xs text-glamping-400 hover:text-luxury-gold flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"><History size={12}/> 查看紀錄</button></td><td className="p-4"><div className="flex items-center gap-2"><button onClick={() => openAdjustmentModal(item, -1)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center font-bold transition-colors active:scale-95">-</button><span className={`font-mono font-bold text-lg w-16 text-center ${item.quantity <= item.safetyStock ? 'text-red-500' : 'text-glamping-800'}`}>{item.quantity}</span><span className="text-xs text-glamping-500 w-8">{item.unit}</span><button onClick={() => openAdjustmentModal(item, 1)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center font-bold transition-colors active:scale-95">+</button></div></td><td className="p-4 text-glamping-500">{item.safetyStock} {item.unit}</td><td className="p-4 text-glamping-500 flex items-center gap-1"><Clock size={14} className="opacity-50"/> {item.weeklyUsage} {item.unit}</td><td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.color}`}>{status.icon} {status.label}</span></td><td className="p-4 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="text-glamping-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all" title="刪除此品項"><Trash2 size={18} /></button></td></tr>)})}</tbody></table></div></div>
                        </div>
                    );
                })}
             </div>
          </div>
        )}

        {/* Batch Adjustment Modal */}
        {adjustmentItem && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
                    <div className="flex justify-between items-start mb-4">
                         <div>
                             <h3 className="font-serif font-bold text-xl text-glamping-900">{adjustmentItem.name}</h3>
                             <p className="text-sm text-glamping-500">目前庫存: {adjustmentItem.quantity} {adjustmentItem.unit}</p>
                         </div>
                         <button onClick={() => setAdjustmentItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4 bg-glamping-50 p-4 rounded-xl border border-glamping-100">
                             <input 
                                type="number" 
                                className={`text-4xl font-mono font-bold bg-transparent text-center w-32 focus:outline-none border-b-2 ${adjustmentDelta >= 0 ? 'text-emerald-600 border-emerald-200 focus:border-emerald-500' : 'text-red-600 border-red-200 focus:border-red-500'}`}
                                value={adjustmentDelta}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if(!isNaN(val)) setAdjustmentDelta(val);
                                }}
                             />
                             <span className="text-glamping-400 font-bold">{adjustmentItem.unit}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setAdjustmentDelta(d => d + 1)} className="py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100">+1</button>
                            <button onClick={() => setAdjustmentDelta(d => d + 5)} className="py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100">+5</button>
                            <button onClick={() => setAdjustmentDelta(d => d + 10)} className="py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100">+10</button>
                            
                            <button onClick={() => setAdjustmentDelta(d => d - 1)} className="py-2 bg-red-50 text-red-700 rounded-lg font-bold text-sm hover:bg-red-100">-1</button>
                            <button onClick={() => setAdjustmentDelta(d => d - 5)} className="py-2 bg-red-50 text-red-700 rounded-lg font-bold text-sm hover:bg-red-100">-5</button>
                            <button onClick={() => setAdjustmentDelta(d => d - 10)} className="py-2 bg-red-50 text-red-700 rounded-lg font-bold text-sm hover:bg-red-100">-10</button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-glamping-500 uppercase mb-1">變更原因</label>
                            <select className="w-full border rounded-lg px-3 py-2 bg-white text-sm" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)}>
                                <option value="進貨/補貨">進貨 / 補貨</option>
                                <option value="一般消耗">一般消耗 (備餐)</option>
                                <option value="盤點修正">盤點修正</option>
                                <option value="員工餐">員工餐使用</option>
                                <option value="報廢/腐壞">報廢 / 腐壞</option>
                                <option value="退貨歸還">退貨 / 歸還</option>
                            </select>
                        </div>
                        <button 
                            onClick={handleBatchUpdate}
                            disabled={adjustmentDelta === 0}
                            className="w-full py-3 bg-glamping-900 text-white rounded-lg font-bold hover:bg-black transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={18} /> 確認調整
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {/* History Modal */}
        {viewingHistoryItem && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"><div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in"><div className="p-6 border-b border-glamping-200 flex justify-between items-center"><div><h3 className="font-serif font-bold text-xl text-glamping-900">{viewingHistoryItem.name}</h3><p className="text-sm text-glamping-500">庫存變更紀錄</p></div><button onClick={() => setViewingHistoryItem(null)} className="text-glamping-400 hover:text-glamping-600"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-6">{viewingHistoryItem.logs.length === 0 ? <div className="text-center text-glamping-400 py-12">尚無變更紀錄</div> : (<div className="space-y-4">{viewingHistoryItem.logs.map((log, idx) => (<div key={idx} className="flex gap-4 items-start pb-4 border-b border-glamping-100 last:border-0"><div className={`mt-1 p-2 rounded-full shrink-0 ${log.amount > 0 ? 'bg-emerald-100 text-emerald-600' : log.type === 'SPOILED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{log.amount > 0 ? <Plus size={16}/> : <TrendingDown size={16}/>}</div><div className="flex-1"><div className="flex justify-between"><span className="font-bold text-glamping-800">{log.reason}</span><span className="text-xs text-glamping-400">{log.date}</span></div><div className="flex justify-between items-center mt-1"><span className={`text-sm font-bold ${log.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{log.amount > 0 ? '+' : ''}{log.amount} {viewingHistoryItem.unit}</span><span className="text-xs text-glamping-500 bg-glamping-50 px-2 py-0.5 rounded">結餘: {log.balanceAfter}</span></div></div></div>))}</div>)}</div></div></div>
        )}

        {/* Add Item Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scale-in"><h3 className="font-serif font-bold text-xl mb-4 text-glamping-900">新增食材品項</h3><div className="space-y-4">
                <div><label className="block text-xs font-bold text-glamping-500 mb-1">品項名稱</label><input type="text" className="w-full border rounded px-3 py-2" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-glamping-500 mb-1">類別</label>
                        <div className="flex gap-2">
                            <select className="w-full border rounded px-3 py-2 text-sm" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                                {allCategoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="bg-glamping-100 hover:bg-glamping-200 text-glamping-600 p-2 rounded border border-glamping-300 transition" title="新增自訂類別">
                                {isAddingCategory ? <X size={16}/> : <Plus size={16}/>}
                            </button>
                        </div>
                        {isAddingCategory && (
                            <div className="mt-2 flex gap-2 animate-fade-in">
                                <input type="text" placeholder="輸入新類別名稱" className="w-full border rounded px-2 py-1 text-sm" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                                <button onClick={handleAddCustomCategory} className="bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-emerald-600 whitespace-nowrap">新增</button>
                            </div>
                        )}
                    </div>
                    <div><label className="block text-xs font-bold text-glamping-500 mb-1">單位</label><input type="text" className="w-full border rounded px-3 py-2" placeholder="kg, 瓶, 包" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-glamping-500 mb-1">初始庫存</label><input type="number" className="w-full border rounded px-3 py-2" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} /></div><div><label className="block text-xs font-bold text-glamping-500 mb-1">安全水位</label><input type="number" className="w-full border rounded px-3 py-2" value={newItem.safetyStock} onChange={e => setNewItem({...newItem, safetyStock: Number(e.target.value)})} /></div></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-glamping-500 mb-1">預估每週總用量</label><input type="number" className="w-full border rounded px-3 py-2" placeholder="做為叫貨預測基準" value={newItem.weeklyUsage} onChange={e => setNewItem({...newItem, weeklyUsage: Number(e.target.value)})} /></div><div><label className="block text-xs font-bold text-glamping-500 mb-1">每人消耗量 (自動扣除用)</label><input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={newItem.consumptionPerGuest} onChange={e => setNewItem({...newItem, consumptionPerGuest: Number(e.target.value)})} /></div></div>
                <div className="flex gap-3 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded text-glamping-600">取消</button><button onClick={handleAddItem} className="flex-1 py-2 bg-glamping-800 text-white rounded font-bold">新增</button></div>
            </div></div></div>
        )}
    </div>
  );
};

export default KitchenManagement;
