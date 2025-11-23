
import React, { useState, useEffect } from 'react';
import { Member, AIAnalysisResult } from '../types';
import { ArrowLeft, Star, Calendar, Phone, Mail, Tag, Utensils, Sparkles, Leaf, MapPin, Bell } from 'lucide-react';
import { analyzeMemberNotes, generateWelcomeMessage } from '../services/geminiService';

interface MemberDetailProps {
  member: Member;
  onBack: () => void;
  onUpdateMember: (updatedMember: Member) => void;
}

const MemberDetail: React.FC<MemberDetailProps> = ({ member, onBack, onUpdateMember }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState<string>("");
  const [loadingMsg, setLoadingMsg] = useState(false);
  
  // State for the notes input area
  const [notesInput, setNotesInput] = useState(member.notes);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result: AIAnalysisResult = await analyzeMemberNotes(notesInput);
    
    // Merge results into member data
    const updatedMember: Member = {
      ...member,
      notes: notesInput,
      dietaryRestrictions: Array.from(new Set([...member.dietaryRestrictions, ...result.dietaryRestrictions])),
      specialRequests: Array.from(new Set([...(member.specialRequests || []), ...result.specialRequests])),
      tags: Array.from(new Set([...member.tags, ...result.tags])),
      preferences: result.summary
    };
    
    onUpdateMember(updatedMember);
    setIsAnalyzing(false);
  };

  const handleGenerateWelcome = async () => {
    setLoadingMsg(true);
    const msg = await generateWelcomeMessage(member);
    setWelcomeMsg(msg);
    setLoadingMsg(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      <button 
        onClick={onBack}
        className="flex items-center text-glamping-600 hover:text-glamping-900 transition-colors mb-4"
      >
        <ArrowLeft size={18} className="mr-2" />
        返回列表
      </button>

      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-glamping-200 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-glamping-100 rounded-full transform translate-x-1/3 -translate-y-1/3 opacity-50"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start text-center md:text-left">
          <div className="w-24 h-24 bg-glamping-200 rounded-full flex items-center justify-center text-4xl text-glamping-600 font-serif font-bold shadow-inner flex-shrink-0">
            {member.name.charAt(0)}
          </div>
          
          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2 justify-center md:justify-start">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-glamping-900">{member.name}</h2>
              <span className="px-4 py-1 rounded-full bg-luxury-gold text-white text-sm font-medium shadow-sm flex items-center w-fit mx-auto md:mx-0">
                <Star size={14} className="mr-1 fill-white" /> {member.tier}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-4 md:gap-6 text-glamping-600 mt-4 text-sm justify-center md:justify-start">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-glamping-400"/>
                <span className="font-medium text-glamping-800">{member.location || '未標示地區'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-glamping-400"/>
                <span>{member.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-glamping-400"/>
                <span>{member.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-glamping-400"/>
                <span>入會日: {member.joinDate}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto mt-4 md:mt-0">
             <button 
                onClick={handleGenerateWelcome}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-glamping-800 text-white px-4 py-2 rounded-lg hover:bg-glamping-900 transition shadow-sm text-sm"
                disabled={loadingMsg}
             >
                <Sparkles size={16} />
                {loadingMsg ? "撰寫中..." : "AI 生成迎賓信"}
             </button>
          </div>
        </div>

        {welcomeMsg && (
          <div className="mt-6 p-4 bg-glamping-50 border border-glamping-200 rounded-lg relative animate-fade-in text-left">
             <h4 className="text-sm font-bold text-glamping-700 mb-2 flex items-center"><Sparkles size={14} className="mr-2 text-luxury-gold"/> AI 建議迎賓詞</h4>
             <p className="text-glamping-800 italic leading-relaxed whitespace-pre-wrap font-serif text-sm md:text-base">{welcomeMsg}</p>
             <button 
              onClick={() => setWelcomeMsg("")} 
              className="absolute top-2 right-2 text-xs text-glamping-400 hover:text-glamping-600"
            >
              關閉
             </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: AI Insights & Tags */}
        <div className="space-y-6">
          {/* AI Summary Card */}
          <div className="bg-white rounded-xl shadow-sm border border-glamping-200 p-6">
            <div className="flex items-center gap-2 mb-4 text-luxury-gold">
              <Sparkles size={20} />
              <h3 className="font-serif font-bold text-lg text-glamping-900">AI 智能管家分析</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-glamping-400 uppercase tracking-wider mb-2">喜好摘要</h4>
                <p className="text-glamping-700 text-sm leading-relaxed bg-glamping-50 p-3 rounded-lg border border-glamping-100">
                  {member.preferences || "尚無分析資料。請在右側輸入備註並點擊分析。"}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-glamping-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Utensils size={14} /> 飲食禁忌
                </h4>
                <div className="flex flex-wrap gap-2">
                  {member.dietaryRestrictions.length > 0 ? (
                    member.dietaryRestrictions.map((item, i) => (
                      <span key={i} className="px-3 py-1 bg-red-50 text-luxury-accent rounded-md text-sm font-medium border border-red-100">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-glamping-400">無特殊紀錄</span>
                  )}
                </div>
              </div>

              {/* Special Requests Section */}
              <div>
                <h4 className="text-xs font-bold text-glamping-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bell size={14} /> 特殊需求
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(member.specialRequests && member.specialRequests.length > 0) ? (
                    member.specialRequests.map((item, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-md text-sm font-medium border border-purple-100">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-glamping-400">無特殊需求</span>
                  )}
                </div>
              </div>

              <div>
                 <h4 className="text-xs font-bold text-glamping-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Tag size={14} /> 標籤
                </h4>
                <div className="flex flex-wrap gap-2">
                  {member.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-glamping-100 text-glamping-700 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

           {/* History Card */}
           <div className="bg-white rounded-xl shadow-sm border border-glamping-200 p-6">
              <h3 className="font-serif font-bold text-lg text-glamping-900 mb-4">入住歷史</h3>
              <div className="space-y-4">
                {member.history.map((visit, index) => (
                  <div key={index} className="flex items-start gap-4 pb-4 border-b border-glamping-100 last:border-0">
                    <div className="bg-glamping-50 p-2 rounded text-center min-w-[60px]">
                      <div className="text-xs text-glamping-500">{visit.date.split('-')[0]}</div>
                      <div className="text-sm font-bold text-glamping-800">{visit.date.split('-')[1]}/{visit.date.split('-')[2]}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-glamping-800">{visit.accommodationType}</div>
                      <div className="text-sm text-glamping-500">入住 {visit.stayDuration} 晚</div>
                      {visit.notes && (
                        <div className="text-xs text-glamping-400 mt-1 italic">
                          "{visit.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {member.history.length === 0 && (
                   <p className="text-sm text-glamping-500">尚無歷史紀錄</p>
                )}
              </div>
           </div>
        </div>

        {/* Right Column: Notes Editor & Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-glamping-200 p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif font-bold text-lg text-glamping-900 flex items-center gap-2">
                <Leaf size={20} className="text-glamping-600"/> 服務手記
              </h3>
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || !notesInput.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  isAnalyzing || !notesInput.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-glamping-800 text-white hover:bg-glamping-700'
                }`}
              >
                {isAnalyzing ? (
                  <>分析中...</>
                ) : (
                  <>
                    <Sparkles size={16} /> 分析並更新資料
                  </>
                )}
              </button>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-4 text-sm text-yellow-800">
              <p className="font-bold mb-1">💡 使用 AI 整理雜亂筆記</p>
              <p>在此輸入管家口語化的觀察（例如：「林先生這次帶了兩瓶紅酒，但不吃牛肉，小孩對花生過敏，想要延後退房」），點擊分析後，系統將自動提取「喜好」、「禁忌」、「特殊需求」與「標籤」。</p>
            </div>

            <textarea
              className="w-full flex-1 p-4 border border-glamping-200 rounded-lg focus:ring-2 focus:ring-glamping-500 focus:outline-none resize-none text-glamping-800 leading-relaxed min-h-[300px]"
              placeholder="請輸入此次服務觀察或備註事項..."
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;
