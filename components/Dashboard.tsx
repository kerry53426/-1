import React, { useEffect, useState, useMemo } from 'react';
import { Member, MembershipTier, DailyStats, Room, RoomStatus, RoomType } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Users, DollarSign, Tent, MapPin, TrendingUp, Sun, Sparkles, Loader } from 'lucide-react';
import { generateDailyBriefing } from '../services/geminiService';

interface DashboardProps {
  members: Member[];
  dailyStats: DailyStats[];
  rooms: Room[]; // Added rooms prop for real-time calculation
}

const COLORS = ['#787866', '#C5A059', '#949483', '#3f3f36', '#d3d3cb'];
const REGION_COLORS = ['#4b4b3f', '#C5A059', '#787866', '#949483', '#b4b4a6'];

const Dashboard: React.FC<DashboardProps> = ({ members, dailyStats, rooms }) => {
  const [aiBriefing, setAiBriefing] = useState<string>("正在分析今日營運數據，生成簡報中...");

  // Get Today's Stats (Mock data for weather, but we will override visitors/occupancy)
  const todayMockStats = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;

  // --- Real-Time Calculations ---
  
  const getBaseCapacity = (type: RoomType) => {
    if (type === RoomType.PALACE_TENT || type === RoomType.VIP_TENT) return 4;
    return 2;
  };

  const realTimeStats = useMemo(() => {
    let totalVisitors = 0;
    let occupiedRooms = 0;

    rooms.forEach(room => {
      if (room.status === RoomStatus.OCCUPIED) {
        occupiedRooms++;
        
        // Priority: Actual Adults + Children (Synced with Import/Kitchen)
        if (room.actualAdults !== undefined && room.actualChildren !== undefined && (room.actualAdults + room.actualChildren > 0)) {
           totalVisitors += (room.actualAdults + room.actualChildren);
        } else {
           // Fallback: Base Capacity + Extra Guests
           totalVisitors += (getBaseCapacity(room.type) + (room.extraGuests || 0));
        }
      }
    });

    const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

    return {
      visitors: totalVisitors,
      occupancyRate: occupancyRate,
      checkIns: occupiedRooms
    };
  }, [rooms]);


  // Calculate General Stats
  const totalMembers = members.length;
  const totalRevenue = members.reduce((sum, m) => sum + m.totalSpend, 0);
  
  // Calculate Region Data
  const regionCounts: Record<string, number> = {};
  members.forEach(m => {
    const loc = m.location || '未標示';
    regionCounts[loc] = (regionCounts[loc] || 0) + 1;
  });
  const regionData = Object.keys(regionCounts).map(key => ({
    name: key,
    value: regionCounts[key]
  })).sort((a, b) => b.value - a.value);

  // Calculate Monthly Totals (Mock data for history + Real time for today?)
  // For simplicity, we keep the monthly total based on the mock daily stats array for trends,
  // but usually you would sum up real historical records.
  const currentMonthVisitors = dailyStats.reduce((sum, day) => sum + day.visitors, 0);

  useEffect(() => {
    if (!todayMockStats) return;

    const fetchBriefing = async () => {
      // Mock finding VIPs coming soon (Top tier members)
      const vips = members
        .filter(m => m.tier === MembershipTier.DIAMOND || m.tier === MembershipTier.PLATINUM)
        .slice(0, 3)
        .map(m => m.name);
      
      // Construct a stats object that mixes real-time data with mock weather
      const briefingStats: DailyStats = {
        ...todayMockStats,
        visitors: realTimeStats.visitors,
        checkIns: realTimeStats.checkIns,
        occupancyRate: realTimeStats.occupancyRate
      };

      const briefing = await generateDailyBriefing(briefingStats, vips);
      setAiBriefing(briefing);
    };
    fetchBriefing();
  }, [members, todayMockStats, realTimeStats]);

  // Loading State
  if (!todayMockStats) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-glamping-500 space-y-4 animate-fade-in">
        <Loader className="animate-spin text-luxury-gold" size={48} />
        <p className="font-serif text-lg">正在讀取營運數據...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-10">
      {/* Header & AI Briefing */}
      <div className="flex flex-col xl:flex-row gap-6 justify-between items-stretch">
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl md:text-3xl font-serif text-glamping-900 font-bold tracking-wide">營運戰情室</h2>
          <p className="text-glamping-500 mt-2 flex flex-wrap items-center gap-2 bg-white px-3 py-1 rounded-full shadow-sm w-fit border border-glamping-100 text-xs md:text-sm">
            <Sun size={16} className="text-luxury-gold"/> 
            <span className="font-medium">今日山區氣候：{todayMockStats.weather}</span> 
            <span className="text-glamping-300 hidden md:inline">|</span>
            <span>氣溫 18°C - 24°C</span>
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-glamping-800 to-glamping-900 text-white p-4 md:p-6 rounded-xl shadow-xl max-w-3xl flex-1 relative overflow-hidden border border-glamping-700">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-luxury-gold opacity-20 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <h3 className="text-luxury-gold font-serif font-bold mb-2 md:mb-3 flex items-center gap-2 text-base md:text-lg">
              <Sparkles size={20} /> AI 營運總監日報
            </h3>
            <div className="text-sm md:text-base leading-relaxed text-gray-200 whitespace-pre-line font-light tracking-wide">
              {aiBriefing}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics - Operational Focus */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Today's Visitors (Real-Time) */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200 hover:border-luxury-gold transition-all duration-300 group hover:shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">今日入園</p>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-glamping-900 mt-2">{realTimeStats.visitors}</h3>
            </div>
            <div className="p-2 md:p-3 bg-glamping-50 rounded-full text-glamping-600 group-hover:bg-luxury-gold group-hover:text-white transition-colors">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded">
            <TrendingUp size={14} className="mr-1" />
            <span>即時數據</span>
          </div>
        </div>

        {/* Today's Occupancy (Real-Time) */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200 hover:border-luxury-gold transition-all duration-300 group hover:shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">今日入住率</p>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-glamping-900 mt-2">{realTimeStats.occupancyRate}<span className="text-xl ml-1">%</span></h3>
            </div>
            <div className="p-2 md:p-3 bg-glamping-50 rounded-full text-glamping-600 group-hover:bg-luxury-gold group-hover:text-white transition-colors">
              <Tent size={24} />
            </div>
          </div>
          <div className="mt-4 w-full bg-glamping-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-luxury-gold h-1.5 rounded-full transition-all duration-1000" style={{ width: `${realTimeStats.occupancyRate}%` }}></div>
          </div>
        </div>

        {/* Monthly Visitors */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200 hover:border-luxury-gold transition-all duration-300 group hover:shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">本月累計人流</p>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-glamping-900 mt-2">{currentMonthVisitors.toLocaleString()}</h3>
            </div>
            <div className="p-2 md:p-3 bg-glamping-50 rounded-full text-glamping-600 group-hover:bg-luxury-gold group-hover:text-white transition-colors">
              <MapPin size={24} />
            </div>
          </div>
           <div className="mt-4 text-xs text-glamping-500 flex justify-between">
             <span>目標達成率</span>
             <span className="font-bold">{Math.min(100, Math.round((currentMonthVisitors / 800) * 100))}%</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200 hover:border-luxury-gold transition-all duration-300 group hover:shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-glamping-400 uppercase tracking-wider">會員總貢獻</p>
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-glamping-900 mt-2">
                <span className="text-base font-sans mr-1 text-glamping-500">NT$</span>
                {(totalRevenue / 10000).toFixed(1)} 萬
              </h3>
            </div>
            <div className="p-2 md:p-3 bg-glamping-50 rounded-full text-glamping-600 group-hover:bg-luxury-gold group-hover:text-white transition-colors">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs text-glamping-400">
            平均客單價: NT$ {Math.round(totalRevenue / totalMembers).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base md:text-lg font-serif font-bold text-glamping-800">30日來客趨勢圖</h3>
            <div className="flex items-center gap-2 text-sm text-glamping-500">
               <div className="w-2 h-2 bg-luxury-gold rounded-full"></div>
               <span>每日人數</span>
            </div>
          </div>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5A059" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#C5A059" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fill: '#949483', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(str) => str.split('-')[2]} interval={2} />
                <YAxis tick={{fill: '#949483', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#3f3f36', border: 'none', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                  itemStyle={{color: '#C5A059'}}
                  formatter={(value: number) => [`${value} 人`, '入園人數']}
                  labelFormatter={(label) => `日期: ${label}`}
                  cursor={{stroke: '#C5A059', strokeWidth: 1, strokeDasharray: '5 5'}}
                />
                <Area type="monotone" dataKey="visitors" stroke="#C5A059" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" activeDot={{r: 6, strokeWidth: 0}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Region Distribution */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200 flex flex-col">
          <h3 className="text-base md:text-lg font-serif font-bold text-glamping-800 mb-2">貴賓居住地區</h3>
          <p className="text-xs text-glamping-400 mb-4">分析會員主要來源城市</p>
          
          <div className="flex-1 min-h-[200px] w-full relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={regionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={REGION_COLORS[index % REGION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{backgroundColor: '#fff', borderRadius: '8px', borderColor: '#e8e8e3', fontSize: '12px', color: '#3f3f36'}}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                <span className="text-xs text-glamping-400">主要來源</span>
                <span className="text-xl font-serif font-bold text-glamping-800">{regionData[0]?.name || 'N/A'}</span>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            {regionData.slice(0, 4).map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm border-b border-glamping-50 pb-1 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: REGION_COLORS[index % REGION_COLORS.length]}}></div>
                  <span className="text-glamping-600">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-glamping-800">{entry.value} 位</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Membership Tier Bar Chart */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-glamping-200">
          <h3 className="text-base md:text-lg font-serif font-bold text-glamping-800 mb-6">會員等級分佈概況</h3>
          <div className="h-40 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart 
                 layout="vertical" 
                 data={[
                    MembershipTier.CLASSIC,
                    MembershipTier.GOLD,
                    MembershipTier.PLATINUM,
                    MembershipTier.DIAMOND
                  ].map(tier => ({
                    name: tier,
                    value: members.filter(m => m.tier === tier).length
                  }))}
                  margin={{ top: 0, right: 10, left: 40, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 13, fill: '#5e5e4f', fontWeight: 500}} width={80} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f7f7f5'}} 
                    contentStyle={{backgroundColor: '#3f3f36', border: 'none', borderRadius: '8px', color: '#fff'}}
                    itemStyle={{color: '#fff'}}
                  />
                  <Bar dataKey="value" barSize={24} radius={[0, 6, 6, 0]}>
                    {
                      [0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))
                    }
                  </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;