import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Loader, FileImage, Edit2, ArrowRight, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { Room, RoomStatus, RoomType } from '../types';
import { analyzeOccupancyImage } from '../services/geminiService';

interface OccupancyImportModalProps {
  rooms: Room[];
  onClose: () => void;
  onConfirmImport: (bookings: ParsedBooking[], sheetDate: string, stayDuration: number) => void;
}

export interface ParsedBooking {
  roomCode: string;
  targetRoomId?: string;
  roomType?: RoomType;
  baseCapacity: number;
  guestName: string;
  checkInDate: string;
  adults: number;
  children: number;
  extraGuests: number;
  notes: string;
  status: 'MATCHED' | 'NOT_FOUND' | 'CONFLICT';
  warning?: string;
}

const OccupancyImportModal: React.FC<OccupancyImportModalProps> = ({ rooms, onClose, onConfirmImport }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedBooking[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sheetDate, setSheetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stayDuration, setStayDuration] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getBaseCapacity = (roomType: RoomType): number => {
    if (roomType === RoomType.PALACE_TENT || roomType === RoomType.VIP_TENT) return 4;
    return 2;
  };

  const generateWarning = (room: Room): string | undefined => {
    const warnings: string[] = [];
    if (room.status === RoomStatus.DIRTY) warnings.push("待清潔");
    if (room.status === RoomStatus.AWAITING_STRIP) warnings.push("待拉床");
    if (room.status === RoomStatus.MAINTENANCE) warnings.push("維護中");
    if (room.notes && room.notes.trim().length > 0) warnings.push("有維修紀錄");
    return warnings.length > 0 ? "⚠️ 房況: " + warnings.join(', ') : undefined;
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setParsedData([]);
    try {
      const base64Data = selectedImage.split(',')[1];
      const rawData = await analyzeOccupancyImage(base64Data);
      
      const processed: ParsedBooking[] = rawData.map((item: any) => {
        const room = rooms.find(r => r.code === item.roomCode);
        let status: ParsedBooking['status'] = 'NOT_FOUND';
        let targetId = undefined;
        let roomType = undefined;
        let baseCapacity = 0;
        let extraGuests = 0;
        let warning = item.stayDurationInfo ? `ℹ️ 報表註記: ${item.stayDurationInfo}` : undefined;

        if (room) {
           status = room.status === RoomStatus.OCCUPIED ? 'CONFLICT' : 'MATCHED';
           targetId = room.id;
           roomType = room.type;
           baseCapacity = getBaseCapacity(room.type);
           const totalPeople = (item.adults || 0) + (item.children || 0);
           extraGuests = Math.max(0, Math.min(2, totalPeople - baseCapacity));
           
           const roomWarning = generateWarning(room);
           if (roomWarning) warning = warning ? `${warning} | ${roomWarning}` : roomWarning;
        }

        return {
          roomCode: item.roomCode,
          targetRoomId: targetId,
          roomType: roomType,
          baseCapacity: baseCapacity,
          guestName: item.guestName,
          checkInDate: item.checkInDate,
          adults: item.adults || 0,
          children: item.children || 0,
          extraGuests,
          notes: '', // 報表資訊不填入維修備註欄
          status,
          warning
        };
      });
      setParsedData(processed);
    } catch (error: any) {
      alert(error.message || "分析失敗，請確認圖片是否清晰或 API 設定是否正確。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualMap = (index: number, roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const updatedData = [...parsedData];
    const item = updatedData[index];
    const baseCapacity = getBaseCapacity(room.type);
    const totalPeople = item.adults + item.children;
    const extraGuests = Math.max(0, Math.min(2, totalPeople - baseCapacity));
    
    updatedData[index] = { 
        ...item, 
        roomCode: room.code, 
        targetRoomId: room.id, 
        roomType: room.type, 
        baseCapacity, 
        extraGuests, 
        status: room.status === RoomStatus.OCCUPIED ? 'CONFLICT' : 'MATCHED',
        warning: generateWarning(room)
    };
    setParsedData(updatedData);
    setEditingIndex(null);
  };

  const validBookings = parsedData.filter(d => d.status === 'MATCHED' || d.status === 'CONFLICT');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-glamping-200">
        <div className="bg-glamping-900 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-serif font-bold text-lg flex items-center gap-2">
            <Camera size={20} className="text-luxury-gold"/> 匯入訂房報表
          </h3>
          <button onClick={onClose} className="hover:text-luxury-gold transition"><X size={24}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
           {!selectedImage ? (
             <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-glamping-300 rounded-xl p-12 flex flex-col items-center justify-center text-glamping-400 hover:border-luxury-gold hover:text-luxury-gold hover:bg-glamping-50 transition cursor-pointer h-64">
               <Upload size={48} className="mb-4"/>
               <p className="font-bold text-lg">點擊上傳訂房報表圖片</p>
               <p className="text-sm">支援 JPG, PNG 格式</p>
               <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
             </div>
           ) : (
             <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                   <div className="w-full md:w-1/3 space-y-3">
                      <div className="bg-glamping-50 rounded-lg p-2 border border-glamping-200">
                        <img src={selectedImage} alt="Preview" className="w-full h-auto rounded shadow-sm" />
                        <button onClick={() => setSelectedImage(null)} className="mt-2 w-full text-xs text-glamping-500 hover:text-red-500 underline">重新選擇圖片</button>
                      </div>
                      <div className="flex gap-3">
                          <div className="bg-white p-3 rounded-lg border border-glamping-200 shadow-sm flex-1">
                            <label className="text-xs font-bold text-glamping-500 uppercase mb-1 block">報表日期</label>
                            <input type="date" className="w-full border-none focus:ring-0 text-glamping-900 font-bold bg-transparent" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-glamping-200 shadow-sm flex-1">
                            <label className="text-xs font-bold text-glamping-500 uppercase mb-1 block">預設入住天數</label>
                            <select className="w-full border-none focus:ring-0 text-glamping-900 font-bold bg-transparent" value={stayDuration} onChange={(e) => setStayDuration(Number(e.target.value))}>
                              <option value={1}>1 晚</option>
                              <option value={2}>2 晚 (二泊)</option>
                              <option value={3}>3 晚</option>
                            </select>
                          </div>
                      </div>
                   </div>
                   <div className="flex-1 space-y-4">
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-amber-900 text-sm">
                        <h4 className="font-bold flex items-center gap-2 mb-2"><AlertCircle size={16}/> AI 分析說明</h4>
                        <p>系統將自動辨識房號、姓名與天數。</p>
                        <p className="mt-1 text-xs opacity-80">
                          - <strong>自動天數辨識</strong>：若報表標註「2泊」，系統會自動在警示欄提醒。<br/>
                          - <strong>維修備註保護</strong>：報表上的需求不會寫入房間備註，避免覆蓋維修紀錄。
                        </p>
                      </div>
                      {parsedData.length === 0 && (
                        <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full py-3 bg-glamping-800 text-white font-bold rounded-lg hover:bg-glamping-900 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                          {isAnalyzing ? <><Loader size={18} className="animate-spin"/> 正在解析圖片...</> : <><FileImage size={18}/> 開始 AI 分析</>}
                        </button>
                      )}
                   </div>
                </div>

                {parsedData.length > 0 && (
                   <div className="animate-fade-in overflow-x-auto">
                      <h4 className="font-bold text-glamping-800 mb-3">分析結果 ({parsedData.length} 筆)</h4>
                      <table className="w-full text-left text-sm border border-glamping-200 rounded-lg">
                        <thead className="bg-glamping-50 text-glamping-500 font-bold uppercase text-xs">
                          <tr>
                            <th className="p-3">狀態</th>
                            <th className="p-3">房號</th>
                            <th className="p-3">房客姓名</th>
                            <th className="p-3">人數</th>
                            <th className="p-3">警示 / 注意事項</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-glamping-100">
                          {parsedData.map((row, idx) => (
                            <tr key={idx} className={row.status === 'NOT_FOUND' ? 'bg-red-50' : 'bg-white'}>
                              <td className="p-3">
                                {row.status === 'MATCHED' && <span className="text-emerald-600 font-bold">✓ 正常</span>}
                                {row.status === 'NOT_FOUND' && <span className="text-red-500 font-bold">? 未配對</span>}
                                {row.status === 'CONFLICT' && <span className="text-amber-600 font-bold">! 已入住</span>}
                              </td>
                              <td className="p-3">
                                <div onClick={() => setEditingIndex(idx)} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                                  {/* Fix: use editingIndex directly instead of non-existent isEditing to resolve line 218 error */}
                                  {editingIndex === idx ? (
                                    <select autoFocus onBlur={() => setEditingIndex(null)} onChange={(e) => handleManualMap(idx, e.target.value)} className="border rounded text-xs">
                                      <option value="">選擇房號...</option>
                                      {rooms.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                                    </select>
                                  ) : (
                                    <>{row.roomCode} <Edit2 size={12} className="opacity-30"/></>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 font-bold">{row.guestName}</td>
                              <td className="p-3">{row.adults}大{row.children}小</td>
                              <td className="p-3 text-xs text-red-600 font-bold">{row.warning || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                )}
             </div>
           )}
        </div>
        {parsedData.length > 0 && (
          <div className="p-4 border-t border-glamping-200 bg-glamping-50 flex justify-end gap-3 shrink-0">
            <button onClick={() => { setParsedData([]); setSelectedImage(null); }} className="px-4 py-2 text-glamping-600 hover:text-glamping-900 font-bold">重新上傳</button>
            <button onClick={() => onConfirmImport(validBookings, sheetDate, stayDuration)} disabled={validBookings.length === 0} className="px-6 py-2 bg-luxury-gold text-white rounded-lg font-bold shadow-md hover:bg-yellow-600 transition">
              確認匯入 ({validBookings.length} 筆)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OccupancyImportModal;