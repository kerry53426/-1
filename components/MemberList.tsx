
import React, { useState, useMemo } from 'react';
import { Member, MembershipTier } from '../types';
import { Search, Filter, User, ChevronRight, MapPin } from 'lucide-react';

interface MemberListProps {
  members: Member[];
  onSelectMember: (member: Member) => void;
}

const MemberList: React.FC<MemberListProps> = ({ members, onSelectMember }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');

  // Extract unique locations for filter
  const uniqueLocations = useMemo(() => {
    const locs = new Set(members.map(m => m.location || "其他"));
    return Array.from(locs).sort();
  }, [members]);

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.includes(searchTerm) || m.phone.includes(searchTerm) || m.tags.some(t => t.includes(searchTerm));
    const matchesTier = filterTier === 'ALL' || m.tier === filterTier;
    const matchesLocation = filterLocation === 'ALL' || (m.location || "其他") === filterLocation;
    return matchesSearch && matchesTier && matchesLocation;
  });

  const getTierColor = (tier: MembershipTier) => {
    switch(tier) {
      case MembershipTier.DIAMOND: return 'text-gray-900 bg-gray-100 border-gray-300';
      case MembershipTier.PLATINUM: return 'text-indigo-800 bg-indigo-50 border-indigo-200';
      case MembershipTier.GOLD: return 'text-yellow-800 bg-yellow-50 border-yellow-200';
      default: return 'text-glamping-800 bg-glamping-100 border-glamping-200';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif text-glamping-800 font-bold">會員名錄</h2>
          <p className="text-glamping-500 text-sm md:text-base">管理貴賓資料與住宿紀錄</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋姓名、電話或標籤..." 
              className="pl-10 pr-4 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white w-full sm:w-64 text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters Group */}
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={16} />
              <select 
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white appearance-none text-sm shadow-sm cursor-pointer"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              >
                <option value="ALL">所有等級</option>
                {Object.values(MembershipTier).map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
            
            <div className="relative flex-1 sm:flex-none">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-glamping-400" size={16} />
              <select 
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-glamping-300 focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-white appearance-none text-sm shadow-sm cursor-pointer"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              >
                <option value="ALL">所有地區</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-glamping-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-glamping-50 z-10 shadow-sm">
              <tr className="border-b border-glamping-200 text-xs font-bold text-glamping-500 uppercase tracking-wider">
                <th className="p-4 font-serif">會員姓名</th>
                <th className="p-4 font-serif">等級</th>
                <th className="p-4 font-serif">居住地區</th>
                <th className="p-4 font-serif">最近入住</th>
                <th className="p-4 font-serif">累積消費</th>
                <th className="p-4 font-serif"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glamping-100">
              {filteredMembers.map((member) => (
                <tr 
                  key={member.id} 
                  className="hover:bg-glamping-50 cursor-pointer transition-colors group"
                  onClick={() => onSelectMember(member)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-glamping-100 flex items-center justify-center text-glamping-600 group-hover:bg-luxury-gold group-hover:text-white transition-colors">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-glamping-900">{member.name}</div>
                        <div className="text-xs text-glamping-500">{member.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTierColor(member.tier)}`}>
                      {member.tier}
                    </span>
                  </td>
                  <td className="p-4 text-glamping-700">
                    <div className="flex items-center gap-1 text-sm">
                        <MapPin size={14} className="text-glamping-400" />
                        {member.location || '未標示'}
                    </div>
                  </td>
                  <td className="p-4 text-glamping-600 text-sm">
                    {member.history.length > 0 ? member.history[0].date : '尚未入住'}
                  </td>
                  <td className="p-4 font-mono text-glamping-800 text-sm">
                    NT$ {member.totalSpend.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <ChevronRight size={18} className="text-glamping-300 group-hover:text-luxury-gold transition-colors inline-block" />
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-glamping-400 flex flex-col items-center justify-center">
                    <User size={48} className="mb-4 opacity-20"/>
                    沒有找到符合條件的會員資料。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MemberList;
