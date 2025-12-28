
import React, { useState, useMemo } from 'react';
import { BookingRecord } from '../types';
import { Search, Calendar, Filter, User, MapPin, CalendarClock, Trash2, ArrowRight } from 'lucide-react';

interface BookingHistoryProps {
  records: BookingRecord[];
  onDeleteRecord: (id: string) => void;
}

const BookingHistory: React.FC<BookingHistoryProps> = ({ records, onDeleteRecord }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD

  // Extract unique years
  const years = useMemo(() => {
    const y = new Set(records.map(r => r.checkInDate.split('-')[0]));
    return Array.from(y).sort((a: string, b: string) => b.localeCompare(a));
  }, [records]);

  // Filter Logic
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 1. Keyword Search
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch = 
        record.guestName.toLowerCase().includes(lowerSearch) || 
        record.roomCode.toLowerCase().includes(lowerSearch) ||
        (record.notes && record.notes.toLowerCase().includes(lowerSearch));

      if (!matchesSearch) return false;

      // 2. Date Filter (Specific Date Priority)
      if (selectedDate) {
        return record.checkInDate === selectedDate;
      }

      // 3. Year/Month Filter
      const [rYear, rMonth] = record.checkInDate.split('-');
      const matchesYear = selectedYear === 'ALL' || rYear === selectedYear;
      const matchesMonth = selectedMonth === 'ALL' || rMonth === selectedMonth;

      return matchesYear && matchesMonth;
    }).sort((a, b) => b.checkInDate.localeCompare(a.checkInDate)); // Sort by date descending
  }, [records, searchTerm, selectedYear, selectedMonth, selectedDate]);

  return (
    <div className="space-y-6 animate-fade-in pb-20 h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif text-glamping-900 font-bold tracking-wide flex items-center gap-3">
            <CalendarClock size={32} className="text-glamping-600"/>
            歷史訂房紀錄
          </h2>
          <p className="text-glamping-500 mt-1 text-sm md:text-base">查詢過往入住資料與房客紀錄</p>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-glamping-200 shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋姓名、房號或備註..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Filters */}
          <div className="flex gap-2 flex-wrap md:flex-nowrap">
             {/* Year */}
             <div className="relative min-w-[100px]">
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white text-sm appearance-none cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(e.target.value); setSelectedDate(''); }}
                >
                  <option value="ALL">所有年份</option>
                  {years.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <Filter size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-glamping-400 pointer-events-none"/>
             </div>

             {/* Month */}
             <div className="relative min-w-[100px]">
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white text-sm appearance-none cursor-pointer"
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
                >
                  <option value="ALL">所有月份</option>
                  {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <Filter size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-glamping-400 pointer-events-none"/>
             </div>

             {/* Specific Date Picker */}
             <div className="relative">
                <input 
                  type="date"
                  className="px-3 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white text-sm text-glamping-600"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedYear('ALL'); setSelectedMonth('ALL'); }}
                />
             </div>

             {/* Clear Button */}
             {(searchTerm || selectedDate || selectedYear !== 'ALL' || selectedMonth !== 'ALL') && (
               <button 
                  onClick={() => { setSearchTerm(''); setSelectedYear('ALL'); setSelectedMonth('ALL'); setSelectedDate(''); }}
                  className="px-3 py-2 text-sm text-glamping-500 hover:text-glamping-800 underline"
               >
                 清除
               </button>
             )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-glamping-200 flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
             <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-glamping-50 z-10 shadow-sm">
                   <tr className="border-b border-glamping-200 text-xs font-bold text-glamping-500 uppercase tracking-wider">
                      <th className="p-4 font-serif">入住期間</th>
                      <th className="p-4 font-serif">房號 / 房型</th>
                      <th className="p-4 font-serif">入住貴賓</th>
                      <th className="p-4 font-serif">入住人數</th>
                      <th className="p-4 font-serif">備註紀錄</th>
                      <th className="p-4 font-serif text-right">操作</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-glamping-100">
                   {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-glamping-50 transition-colors group">
                           <td className="p-4 text-sm text-glamping-800">
                              <div className="flex items-center gap-1 font-mono">
                                 <span>{record.checkInDate}</span>
                                 {record.checkOutDate && (
                                    <>
                                       <ArrowRight size={12} className="text-glamping-400"/>
                                       <span className="text-glamping-500">{record.checkOutDate}</span>
                                    </>
                                 )}
                              </div>
                           </td>
                           <td className="p-4">
                              <div className="flex items-center gap-2">
                                 <span className="font-serif font-bold text-lg text-luxury-gold">{record.roomCode}</span>
                                 <span className="text-xs text-glamping-400 bg-glamping-100 px-2 py-0.5 rounded-full">{record.roomType}</span>
                              </div>
                           </td>
                           <td className="p-4">
                              <div className="flex items-center gap-2 font-bold text-glamping-900">
                                 <User size={16} className="text-glamping-400"/>
                                 {record.guestName}
                              </div>
                           </td>
                           <td className="p-4 text-sm text-glamping-600">
                              {(record.actualAdults !== undefined && record.actualChildren !== undefined) ? (
                                 <span className="font-bold">{record.actualAdults}大 {record.actualChildren}小</span>
                              ) : (
                                 <span>標準 + {record.extraGuests} 加人</span>
                              )}
                           </td>
                           <td className="p-4 text-sm text-glamping-500 max-w-xs truncate">
                              {record.notes || '-'}
                           </td>
                           <td className="p-4 text-right">
                              <button 
                                onClick={() => onDeleteRecord(record.id)}
                                className="p-2 text-glamping-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                title="刪除此紀錄"
                              >
                                 <Trash2 size={18} />
                              </button>
                           </td>
                        </tr>
                      ))
                   ) : (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-glamping-400">
                           <Calendar size={48} className="mx-auto mb-3 opacity-20"/>
                           <p>沒有找到符合條件的歷史紀錄。</p>
                        </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
          <div className="p-3 bg-glamping-50 border-t border-glamping-200 text-xs text-glamping-500 text-right">
             共顯示 {filteredRecords.length} 筆資料
          </div>
      </div>
    </div>
  );
};

export default BookingHistory;
