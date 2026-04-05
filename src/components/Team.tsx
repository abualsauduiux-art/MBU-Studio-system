import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDocs,
  where,
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { db, handleFirestoreError, OperationType, secondaryAuth, auth } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  Users, 
  Trash2, 
  Edit2, 
  User as UserIcon,
  ShieldCheck,
  UserCog,
  Lock,
  Mail,
  Briefcase as BriefcaseIcon,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export const Team = () => {
  const { profile } = useAuth();
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    jobTitle: '',
    role: 'employee' as UserRole,
    permissions: {
      dashboard: true,
      clients: true,
      projects: true,
      tasks: true,
      messages: true,
      financials: false,
      team: false,
      settings: false,
    }
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setTeam(teamData);
      setLoading(false);
    }, (err) => {
      console.error("Team list snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingMember) {
        await updateDoc(doc(db, 'users', editingMember.uid), { 
          name: formData.name,
          email: formData.email,
          jobTitle: formData.jobTitle,
          role: formData.role,
          permissions: formData.permissions,
          password: formData.password // Update password record in Firestore
        });
      } else {
        // Pre-check Firestore to give a better error message if they are already in the team
        const q = query(collection(db, 'users'), where('email', '==', formData.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setError('هذا البريد الإلكتروني مسجل بالفعل كعضو في الفريق.');
          return;
        }

        // 1. Create the user in Firebase Auth using secondaryAuth (to avoid signing out current admin)
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );
        
        const newUid = userCredential.user.uid;

        // 2. Create the user profile in Firestore
        const newProfile: UserProfile = {
          uid: newUid,
          name: formData.name,
          email: formData.email,
          jobTitle: formData.jobTitle,
          role: formData.role,
          permissions: formData.permissions,
          password: formData.password, // Store password in Firestore
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', newUid), newProfile);
        
        // Sign out from secondary auth immediately to keep it clean
        await secondaryAuth.signOut();
      }
      setIsModalOpen(false);
      setEditingMember(null);
      resetForm();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        // If user exists in Auth but not in Firestore (checked above), 
        // we can create a manual entry that AuthProvider will merge later.
        try {
          const manualId = `manual_${formData.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const newProfile: UserProfile = {
            uid: manualId,
            name: formData.name,
            email: formData.email,
            jobTitle: formData.jobTitle,
            role: formData.role,
            permissions: formData.permissions,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', manualId), newProfile);
          
          setIsModalOpen(false);
          setEditingMember(null);
          resetForm();
          alert('هذا المستخدم لديه حساب بالفعل. تم تحديث بياناته وسيتم تفعيلها عند تسجيل دخوله القادم.');
          return;
        } catch (manualErr) {
          console.error("Manual profile creation failed", manualErr);
          setError('هذا البريد الإلكتروني مستخدم بالفعل في نظام التحقق (Firebase Auth). يرجى الطلب من العضو تسجيل الدخول أولاً ثم تعديل بياناته.');
        }
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل)');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('تسجيل الدخول بالبريد الإلكتروني غير مفعل في إعدادات Firebase. يرجى تفعيله من لوحة التحكم.');
      } else if (err.code === 'permission-denied') {
        setError('ليس لديك الصلاحية الكافية لإضافة أعضاء جدد.');
      } else {
        setError(`حدث خطأ: ${err.message || 'يرجى المحاولة مرة أخرى.'}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      jobTitle: '', 
      role: 'employee',
      permissions: {
        dashboard: true,
        clients: true,
        projects: true,
        tasks: true,
        messages: true,
        financials: false,
        team: false,
        settings: false,
      }
    });
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العضو من الفريق؟')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  const handleDeleteAll = async () => {
    const adminEmail = "abualsaud.uiux@gmail.com";
    const membersToDelete = team.filter(m => m.email !== adminEmail);
    
    if (membersToDelete.length === 0) {
      alert('لا يوجد أعضاء لحذفهم (باستثناء المسؤول).');
      return;
    }

    if (window.confirm(`هل أنت متأكد من حذف جميع أعضاء الفريق (${membersToDelete.length} عضو)؟ لا يمكن التراجع عن هذه الخطوة.`)) {
      setIsDeletingAll(true);
      try {
        for (const member of membersToDelete) {
          await deleteDoc(doc(db, 'users', member.uid));
        }
        alert('تم حذف جميع الأعضاء بنجاح.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  const openEditModal = (member: UserProfile) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      password: member.password || '',
      jobTitle: member.jobTitle || '',
      role: member.role,
      permissions: member.permissions || {
        dashboard: true,
        clients: true,
        projects: true,
        tasks: true,
        messages: true,
        financials: false,
        team: false,
        settings: false,
      }
    });
    setIsModalOpen(true);
  };

  const filteredTeam = team.filter(member => {
    return (member.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
           (member.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (member.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const roleColors: Record<UserRole, string> = {
    admin: "bg-rose-50 text-rose-600 border-rose-100",
    manager: "bg-blue-50 text-blue-600 border-blue-100",
    employee: "bg-gray-50 text-gray-600 border-gray-100"
  };

  const roleIcons: Record<UserRole, any> = {
    admin: ShieldCheck,
    manager: UserCog,
    employee: UserIcon
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">إدارة الفريق</h2>
          <p className="text-gray-500 mt-1 font-medium">إدارة أعضاء الوكالة، الأدوار، والصلاحيات</p>
        </div>
        <div className="flex gap-3">
          {profile?.role === 'admin' && (
            <button 
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
              className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-bold hover:bg-red-100 transition-all border border-red-100 disabled:opacity-50"
            >
              <AlertTriangle size={20} />
              <span>{isDeletingAll ? 'جاري الحذف...' : 'حذف الكل'}</span>
            </button>
          )}
          <button 
            onClick={() => {
              setEditingMember(null);
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            <span>إضافة عضو جديد</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm relative">
        <Search className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="البحث عن عضو في الفريق..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-16 pl-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
        />
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTeam.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeam.map((member) => {
            const Icon = roleIcons[member.role];
            return (
              <div key={member.uid} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center relative overflow-hidden">
                <div className="absolute top-4 left-4 flex gap-1">
                  <button onClick={() => openEditModal(member)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(member.uid)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="relative inline-block mb-6">
                  <img 
                    src={member.photoURL || `https://ui-avatars.com/api/?name=${member.name}&background=random`} 
                    alt={member.name} 
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-xl"
                  />
                  <div className={clsx("absolute -bottom-2 -right-2 w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-lg", roleColors[member.role])}>
                    <Icon size={20} />
                  </div>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-1">{member.name}</h3>
                <p className="text-sm text-blue-600 font-bold mb-4">{member.jobTitle || 'بدون مسمى وظيفي'}</p>
                <p className="text-xs text-gray-400 font-medium mb-4">{member.email}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1 uppercase">تاريخ الانضمام</p>
                    <p className="text-sm font-black text-gray-700">{member.createdAt ? new Date(member.createdAt).toLocaleDateString('ar-EG') : 'غير متوفر'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1 uppercase">الحالة</p>
                    <p className="text-sm font-black text-emerald-500">نشط</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد أعضاء</h3>
          <p className="text-gray-500 font-medium">ابدأ بإضافة أعضاء الفريق يدوياً أو انتظر تسجيل دخولهم</p>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingMember ? 'تعديل بيانات العضو' : 'إضافة عضو جديد للفريق'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">
              {error}
            </div>
          )}

          {editingMember && (
            <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-4 mb-6">
              <img 
                src={editingMember?.photoURL || `https://ui-avatars.com/api/?name=${editingMember?.name}&background=random`} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div>
                <p className="font-black text-gray-900">{editingMember?.name}</p>
                <p className="text-xs text-gray-500 font-bold">{editingMember?.email}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">الاسم الكامل</label>
            <div className="relative">
              <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="مثال: أحمد محمد"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="example@gmail.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required={!editingMember}
                type="text" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder={editingMember ? "تغيير كلمة المرور..." : "كلمة المرور (6 أحرف على الأقل)"}
              />
            </div>
            {editingMember && (
              <p className="text-[10px] text-amber-600 font-bold px-2">
                * ملاحظة: تغيير كلمة المرور هنا يحدث السجل فقط. لتفعيلها فعلياً في نظام الدخول، يجب على العضو استخدام خيار "نسيت كلمة المرور" عند تسجيل الدخول أو التواصل معك.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">المسمى الوظيفي</label>
            <div className="relative">
              <BriefcaseIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={formData.jobTitle}
                onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="مثال: مصمم جرافيك"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <label className="text-sm font-bold text-gray-700 block">الصلاحيات (ماذا يمكنه أن يرى؟)</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'dashboard', label: 'لوحة التحكم' },
                { id: 'clients', label: 'العملاء' },
                { id: 'projects', label: 'المشاريع' },
                { id: 'tasks', label: 'المهام' },
                { id: 'messages', label: 'الرسائل' },
                { id: 'financials', label: 'المالية' },
                { id: 'team', label: 'الفريق' },
                { id: 'settings', label: 'الإعدادات' },
              ].map((perm) => (
                <label key={perm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                  <input 
                    type="checkbox"
                    checked={(formData.permissions as any)[perm.id]}
                    onChange={(e) => setFormData({
                      ...formData,
                      permissions: {
                        ...formData.permissions,
                        [perm.id]: e.target.checked
                      }
                    })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingMember ? 'حفظ التعديلات' : 'إضافة العضو'}
            </button>
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-8 bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
