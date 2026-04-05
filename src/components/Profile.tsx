import React, { useState } from 'react';
import { User, MapPin, CreditCard, Camera, Save, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';

export const Profile = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    photoURL: profile?.photoURL || '',
    address: profile?.address || '',
    cashNumber: profile?.cashNumber || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    
    setLoading(true);
    setSuccess(false);
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        name: formData.name,
        photoURL: formData.photoURL,
        address: formData.address,
        cashNumber: formData.cashNumber,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("حدث خطأ أثناء تحديث الملف الشخصي.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900">الملف الشخصي</h2>
        <p className="text-gray-500 mt-1 font-medium">إدارة معلوماتك الشخصية وبيانات الدفع</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative group">
              <img 
                src={formData.photoURL || `https://ui-avatars.com/api/?name=${formData.name}&background=random`} 
                alt="Profile" 
                className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl"
              />
              <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="text-white" size={32} />
              </div>
            </div>
            <div className="w-full max-w-sm">
              <label className="text-xs font-bold text-gray-400 block mb-2 text-center">رابط الصورة الشخصية</label>
              <input 
                type="text" 
                value={formData.photoURL}
                onChange={(e) => setFormData({...formData, photoURL: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-xs font-medium text-center"
                placeholder="https://example.com/photo.jpg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                الاسم الكامل
              </label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="أدخل اسمك الكامل"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <MapPin size={18} className="text-blue-600" />
                العنوان
              </label>
              <input 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="أدخل عنوان السكن"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" />
                رقم الكاش (للراتب)
              </label>
              <input 
                type="text" 
                value={formData.cashNumber}
                onChange={(e) => setFormData({...formData, cashNumber: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="مثال: 01012345678"
              />
              <p className="text-[10px] text-gray-400 font-bold">هذا الرقم سيستخدم لتحويل الراتب والمكافآت</p>
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : success ? (
                <>
                  <Check size={20} />
                  <span>تم الحفظ بنجاح</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>حفظ التغييرات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
