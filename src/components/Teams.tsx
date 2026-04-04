import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Team, UserProfile } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  Users, 
  User, 
  Trash2, 
  Edit2, 
  Shield,
  LayoutGrid,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

export const Teams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
    members: [] as string[]
  });

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'teams');
      setLoading(false);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await updateDoc(doc(db, 'teams', editingTeam.id), formData);
        // Update users' teamId
        // Note: In a real app, this would be a batch or cloud function
        for (const memberId of formData.members) {
          const userRef = doc(db, 'users', memberId);
          await updateDoc(userRef, { teamId: editingTeam.id });
        }
      } else {
        const docRef = await addDoc(collection(db, 'teams'), formData);
        // Update users' teamId
        for (const memberId of formData.members) {
          const userRef = doc(db, 'users', memberId);
          await updateDoc(userRef, { teamId: docRef.id });
        }
      }
      setIsModalOpen(false);
      setEditingTeam(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingTeam ? OperationType.UPDATE : OperationType.CREATE, 'teams');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', leaderId: '', members: [] });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الفريق؟')) {
      try {
        await deleteDoc(doc(db, 'teams', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'teams');
      }
    }
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      leaderId: team.leaderId,
      members: team.members
    });
    setIsModalOpen(true);
  };

  const getLeaderName = (id: string) => users.find(u => u.uid === id)?.name || 'غير محدد';

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">إدارة الفرق</h2>
        </div>
        <button 
          onClick={() => {
            setEditingTeam(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          <span>إنشاء فريق جديد</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن فريق..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <div key={team.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 border border-gray-50">
                    <Users size={28} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(team)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(team.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-2">{team.name}</h3>
                <p className="text-gray-500 text-sm font-medium mb-6 line-clamp-2">{team.description || 'لا يوجد وصف للفريق'}</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">قائد الفريق</p>
                        <p className="text-sm font-bold text-gray-900">{getLeaderName(team.leaderId)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {team.members.slice(0, 4).map((memberId, i) => {
                        const user = users.find(u => u.uid === memberId);
                        return (
                          <div key={memberId} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600 overflow-hidden">
                            {user?.photoURL ? (
                              <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user?.name[0] || '?'
                            )}
                          </div>
                        );
                      })}
                      {team.members.length > 4 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                          +{team.members.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-black text-gray-400">
                      {team.members.length} أعضاء
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد فرق</h3>
          <p className="text-gray-500 font-medium">ابدأ بتنظيم فريقك وإنشاء أول فريق الآن</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTeam ? 'تعديل الفريق' : 'إنشاء فريق جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">اسم الفريق</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="مثال: فريق التصميم"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">وصف الفريق</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[80px]"
              placeholder="وصف مهام الفريق..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">قائد الفريق</label>
            <select 
              required
              value={formData.leaderId}
              onChange={(e) => setFormData({...formData, leaderId: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
            >
              <option value="">اختر القائد...</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>{user.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">أعضاء الفريق</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-gray-50 rounded-2xl">
              {users.length > 0 ? (
                users.map(user => (
                  <label key={user.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-all cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.members.includes(user.uid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, members: [...formData.members, user.uid]});
                        } else {
                          setFormData({...formData, members: formData.members.filter(id => id !== user.uid)});
                        }
                      }}
                      className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-gray-700">{user.name}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-full py-4 text-center text-gray-400 text-xs font-bold">
                  لا يوجد أعضاء متاحين. يرجى إضافة أعضاء من صفحة "الفريق" أولاً.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingTeam ? 'حفظ التعديلات' : 'إنشاء الفريق'}
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
