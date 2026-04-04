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
import { Project, Client, UserProfile } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  Filter, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Edit2, 
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    teamMembers: [] as string[],
    name: '',
    serviceType: 'social_media' as Project['serviceType'],
    budget: 0,
    status: 'in_progress' as Project['status'],
    startDate: '',
    endDate: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
    });

    const unsubscribeTeam = onSnapshot(collection(db, 'users'), (snapshot) => {
      const teamData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setTeam(teamData);
    });

    return () => {
      unsubscribe();
      unsubscribeClients();
      unsubscribeTeam();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await updateDoc(doc(db, 'projects', editingProject.id), formData);
      } else {
        await addDoc(collection(db, 'projects'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingProject(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingProject ? OperationType.UPDATE : OperationType.CREATE, 'projects');
    }
  };

  const resetForm = () => {
    setFormData({ clientId: '', teamMembers: [], name: '', serviceType: 'social_media', budget: 0, status: 'in_progress', startDate: '', endDate: '', notes: '' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'projects');
      }
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({
      clientId: project.clientId,
      teamMembers: project.teamMembers || [],
      name: project.name,
      serviceType: project.serviceType,
      budget: project.budget,
      status: project.status,
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      notes: project.notes || ''
    });
    setIsModalOpen(true);
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'عميل غير معروف';

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const serviceTypeLabels: Record<Project['serviceType'], string> = {
    social_media: 'سوشيال ميديا',
    ads: 'إعلانات ممولة',
    seo: 'تحسين محركات البحث',
    design: 'تصميم جرافيك'
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">إدارة المشاريع</h2>
          <p className="text-gray-500 mt-1 font-medium">تتبع المشاريع، الميزانيات، والمواعيد النهائية</p>
        </div>
        <button 
          onClick={() => {
            setEditingProject(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          <span>إضافة مشروع جديد</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن مشروع..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'in_progress', 'completed', 'on_hold'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                "px-5 py-3 rounded-2xl font-bold text-sm transition-all",
                statusFilter === status 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {status === 'all' ? 'الكل' : status === 'in_progress' ? 'قيد التنفيذ' : status === 'completed' ? 'مكتمل' : 'معلق'}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div key={project.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={clsx(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  project.status === 'in_progress' ? "bg-blue-50 text-blue-600" : 
                  project.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                  "bg-amber-50 text-amber-600"
                )}>
                  {project.status === 'in_progress' ? 'قيد التنفيذ' : project.status === 'completed' ? 'مكتمل' : 'معلق'}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(project)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(project.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-gray-900 mb-2">{project.name}</h3>
              <p className="text-sm text-gray-500 font-bold mb-4 flex items-center gap-2">
                <Users size={14} />
                {getClientName(project.clientId)}
              </p>

              <div className="flex -space-x-2 rtl:space-x-reverse mb-6">
                {(project.teamMembers || []).slice(0, 4).map((memberId, i) => {
                  const user = team.find(u => u.uid === memberId);
                  return (
                    <div key={memberId} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600 overflow-hidden" title={user?.name}>
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user?.name[0] || '?'
                      )}
                    </div>
                  );
                })}
                {(project.teamMembers || []).length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                    +{(project.teamMembers || []).length - 4}
                  </div>
                )}
                {(project.teamMembers || []).length === 0 && (
                  <span className="text-xs text-gray-400 font-bold">لم يتم تعيين أعضاء</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">الخدمة</p>
                  <p className="text-sm font-bold text-gray-700">{serviceTypeLabels[project.serviceType]}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">الميزانية</p>
                  <p className="text-sm font-black text-blue-600">ج.م{project.budget.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400">تاريخ البدء:</span>
                  <span className="text-gray-700">{project.startDate || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400">تاريخ الانتهاء:</span>
                  <span className="text-gray-700">{project.endDate || 'غير محدد'}</span>
                </div>
              </div>

              <button className="w-full py-3 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2 group">
                <span>عرض التفاصيل</span>
                <ExternalLink size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Briefcase size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد مشاريع</h3>
          <p className="text-gray-500 font-medium">ابدأ بإضافة أول مشروع لوكالتك الآن</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProject ? 'تعديل بيانات المشروع' : 'إضافة مشروع جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">اسم المشروع</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="مثال: حملة رمضان 2024"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">العميل</label>
            <select 
              required
              value={formData.clientId}
              onChange={(e) => setFormData({...formData, clientId: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
            >
              <option value="">اختر العميل...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">نوع الخدمة</label>
              <select 
                value={formData.serviceType}
                onChange={(e) => setFormData({...formData, serviceType: e.target.value as Project['serviceType']})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
              >
                <option value="social_media">سوشيال ميديا</option>
                <option value="ads">إعلانات ممولة</option>
                <option value="seo">تحسين محركات البحث</option>
                <option value="design">تصميم جرافيك</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الميزانية (ج.م)</label>
              <input 
                required
                type="number" 
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">تاريخ البدء</label>
              <input 
                type="date" 
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">تاريخ الانتهاء</label>
              <input 
                type="date" 
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">الحالة</label>
            <select 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value as Project['status']})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
            >
              <option value="in_progress">قيد التنفيذ</option>
              <option value="completed">مكتمل</option>
              <option value="on_hold">معلق</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">ملاحظات المشروع</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]"
              placeholder="تفاصيل إضافية عن المشروع..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">فريق العمل (يمكنك اختيار أكثر من عضو)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-3 bg-gray-50 rounded-2xl">
              {team.map(member => (
                <label key={member.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-all cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.teamMembers.includes(member.uid)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({...formData, teamMembers: [...formData.teamMembers, member.uid]});
                      } else {
                        setFormData({...formData, teamMembers: formData.teamMembers.filter(id => id !== member.uid)});
                      }
                    }}
                    className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-gray-700">{member.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingProject ? 'حفظ التعديلات' : 'إضافة المشروع'}
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
