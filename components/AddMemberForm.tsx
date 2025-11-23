
import React, { useState } from 'react';
import { Member, MembershipTier } from '../types';
import { X } from 'lucide-react';

interface AddMemberFormProps {
  onSave: (member: Member) => void;
  onCancel: () => void;
}

const TAIWAN_LOCATIONS = [
  "台北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
  "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
  "台南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "其他"
];

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    location: '台北市',
    tier: MembershipTier.CLASSIC,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Create new member object with default values
    const newMember: Member = {
      id: Date.now().toString(),
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      location: formData.location,
      tier: formData.tier,
      joinDate: new Date().toISOString().split('T')[0],
      totalVisits: 0,
      totalSpend: 0,
      tags: ['新會員'],
      dietaryRestrictions: [],
      specialRequests: [], // Initialize empty special requests
      preferences: '',
      history: [],
      notes: ''
    };
    onSave(newMember);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-glamping-200">
        <div className="bg-glamping-900 p-5 flex justify-between items-center">
          <h3 className="text-white font-serif font-bold text-lg tracking-wide">新增貴賓檔案</h3>
          <button onClick={onCancel} className="text-glamping-300 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-glamping-500 uppercase tracking-wider mb-1">姓名</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-glamping-500 uppercase tracking-wider mb-1">電話</label>
              <input
                required
                type="tel"
                className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-glamping-500 uppercase tracking-wider mb-1">居住地區</label>
              <select
                className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              >
                {TAIWAN_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-glamping-500 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-glamping-500 uppercase tracking-wider mb-1">會員等級</label>
            <select
              className="w-full px-4 py-2 border border-glamping-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-glamping-500 bg-glamping-50"
              value={formData.tier}
              onChange={e => setFormData({...formData, tier: e.target.value as MembershipTier})}
            >
              {Object.values(MembershipTier).map(tier => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
          </div>

          <div className="pt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 px-4 border border-glamping-300 rounded-lg text-glamping-700 hover:bg-glamping-100 transition font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-luxury-gold text-white rounded-lg hover:bg-yellow-600 transition shadow-md font-bold"
            >
              建立檔案
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberForm;
