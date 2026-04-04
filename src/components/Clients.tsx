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
import { Client } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Phone, 
  Mail, 
  MapPin, 
  Trash2, 
  Edit2, 
  UserPlus,
  Users,
  MessageCircle,
  DollarSign,
  TrendingUp,
  Target,
  AlertCircle,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: '',
    service: '',
    status: 'lead' as Client['status'],
    address: '',
    estimatedValue: 0,
    totalPrice: 0,
    paidAmount: 0,
    remainingAmount: 0,
    lastWhatsAppContact: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        remainingAmount: formData.totalPrice - formData.paidAmount
      };
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), data);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingClient(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clients');
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      phone: '', 
      email: '', 
      source: '',
      service: '',
      status: 'lead', 
      address: '',
      estimatedValue: 0,
      totalPrice: 0,
      paidAmount: 0,
      remainingAmount: 0,
      lastWhatsAppContact: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'clients');
      }
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      source: client.source || '',
      service: client.service || '',
      status: client.status,
      address: client.address || '',
      estimatedValue: client.estimatedValue || 0,
      totalPrice: client.totalPrice || 0,
      paidAmount: client.paidAmount || 0,
      remainingAmount: client.remainingAmount || 0,
      lastWhatsAppContact: client.lastWhatsAppContact || ''
    });
    setIsModalOpen(true);
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         client.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openWhatsApp = async (client: Client) => {
    if (!client.phone) return;
    
    const cleanPhone = client.phone.replace(/\D/g, '');
    const now = new Date().toISOString();
    
    try {
      await updateDoc(doc(db, 'clients', client.id), {
        lastWhatsAppContact: now
      });
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'clients');
    }
  };

  const getWhatsAppStatus = (lastContact?: string) => {
    if (!lastContact) return { color: 'text-gray-300', label: 'لم يتم التواصل' };
    
    const lastDate = new Date(lastContact);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) return { color: 'text-emerald-500', label: 'تواصل حديث' };
    if (diffDays <= 7) return { color: 'text-amber-500', label: 'تواصل منذ أسبوع' };
    return { color: 'text-rose-400', label: 'تواصل قديم' };
  };

  const totalOutstanding = clients.reduce((acc, c) => acc + (c.remainingAmount || 0), 0);
  const totalContractValue = clients.reduce((acc, c) => acc + (c.totalPrice || 0), 0);
  const totalPaid = clients.reduce((acc, c) => acc + (c.paidAmount || 0), 0);

  const kanbanColumns = [
    { id: 'lead', title: 'عميل محتمل', color: 'bg-blue-500', icon: <Target size={16} /> },
    { id: 'contacted', title: 'تم التواصل', color: 'bg-amber-500', icon: <Phone size={16} /> },
    { id: 'proposal', title: 'عرض سعر', color: 'bg-purple-500', icon: <FileText size={16} /> },
    { id: 'negotiation', title: 'تفاوض', color: 'bg-rose-500', icon: <DollarSign size={16} /> },
    { id: 'active', title: 'تم التعاقد', color: 'bg-emerald-500', icon: <CheckCircle2 size={16} /> }
  ];

  const updateClientStatus = async (clientId: string, newStatus: Client['status']) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'clients');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">إدارة العملاء (CRM)</h2>
          <p className="text-gray-500 mt-1 font-medium">إدارة قاعدة بيانات العملاء، الفرص البيعية، والتحصيل المالي</p>
        </div>
        <button 
          onClick={() => {
            setEditingClient(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <UserPlus size={20} />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Financial Summary Banner */}
      <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-[2rem] p-8 text-white shadow-xl shadow-rose-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-400/20 rounded-full -ml-24 -mb-24 blur-2xl" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-rose-100 font-bold uppercase tracking-wider text-xs">
              <AlertCircle size={16} />
              <span>إجمالي المبالغ المستحقة للتحصيل</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-5xl font-black">{totalOutstanding.toLocaleString()}</h3>
              <span className="text-xl font-bold text-rose-100">ج.م</span>
            </div>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[160px]">
              <p className="text-rose-100 text-xs font-bold mb-1">إجمالي التعاقدات</p>
              <p className="text-xl font-black">{totalContractValue.toLocaleString()} <span className="text-xs">ج.م</span></p>
            </div>
            <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[160px]">
              <p className="text-rose-100 text-xs font-bold mb-1">تم تحصيل</p>
              <p className="text-xl font-black">{totalPaid.toLocaleString()} <span className="text-xs">ج.م</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Users size={24} />
            </div>
            <span className="text-gray-500 font-bold">إجمالي العملاء</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{clients.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <span className="text-gray-500 font-bold">العملاء النشطين</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{clients.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Target size={24} />
            </div>
            <span className="text-gray-500 font-bold">فرص بيعية (Leads)</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{clients.filter(c => c.status === 'lead').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <DollarSign size={24} />
            </div>
            <span className="text-gray-500 font-bold">إجمالي المبالغ المستحقة</span>
          </div>
          <p className="text-3xl font-black text-gray-900">
            {clients.reduce((acc, c) => acc + (c.remainingAmount || 0), 0).toLocaleString()} <span className="text-sm font-bold">ج.م</span>
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن عميل..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 bg-gray-50 p-1 rounded-2xl">
          <button 
            onClick={() => setViewMode('list')}
            className={clsx(
              "px-4 py-2 rounded-xl font-bold text-xs transition-all",
              viewMode === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            قائمة
          </button>
          <button 
            onClick={() => setViewMode('kanban')}
            className={clsx(
              "px-4 py-2 rounded-xl font-bold text-xs transition-all",
              viewMode === 'kanban' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            كانبان (Pipeline)
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['all', 'lead', 'contacted', 'proposal', 'negotiation', 'active', 'inactive', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                "px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap",
                statusFilter === status 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {status === 'all' ? 'الكل' : 
               status === 'lead' ? 'فرصة' : 
               status === 'contacted' ? 'تواصل' :
               status === 'proposal' ? 'عرض' :
               status === 'negotiation' ? 'تفاوض' :
               status === 'active' ? 'نشط' : 
               status === 'inactive' ? 'غير نشط' : 'مغلق'}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] -mx-4 px-4 scrollbar-hide">
          {kanbanColumns.map(column => {
            const columnClients = filteredClients.filter(c => c.status === column.id);
            const columnTotal = columnClients.reduce((sum, c) => sum + (c.estimatedValue || c.totalPrice || 0), 0);
            
            return (
              <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className={clsx("w-2 h-2 rounded-full", column.color)} />
                    <h4 className="font-black text-gray-900">{column.title}</h4>
                    <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {columnClients.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-gray-400">
                    {columnTotal.toLocaleString()} ج.م
                  </span>
                </div>
                
                <div className="flex-1 bg-gray-50/50 rounded-[2rem] p-3 space-y-3 border-2 border-dashed border-gray-100">
                  {columnClients.map(client => (
                    <div 
                      key={client.id} 
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => openEditModal(client)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">
                          {client.service || 'بدون خدمة'}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openWhatsApp(client); }}
                            className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-lg"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      </div>
                      <h5 className="font-bold text-gray-900 text-sm mb-1">{client.name}</h5>
                      <p className="text-[10px] text-gray-400 font-medium mb-3 line-clamp-1">
                        {client.source || 'لا توجد تفاصيل'}
                      </p>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                        <span className="text-xs font-black text-gray-900">
                          {(client.estimatedValue || client.totalPrice || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
                        </span>
                        <div className="flex -space-x-2 rtl:space-x-reverse">
                          <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-gray-400">
                            {client.name[0]}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {columnClients.length === 0 && (
                    <div className="h-20 flex items-center justify-center text-gray-300 text-xs font-bold">
                      لا يوجد عملاء
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div key={client.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col h-full">
              <div className={clsx(
                "absolute top-0 right-0 w-1.5 h-full",
                client.status === 'active' ? "bg-emerald-500" : 
                client.status === 'lead' ? "bg-blue-500" : 
                client.status === 'closed' ? "bg-purple-500" : "bg-gray-300"
              )} />
              
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
                  {client.name[0]}
                </div>
                <div className="flex gap-1">
                  {client.phone && (
                    <div className="flex flex-col items-center relative">
                      <button 
                        onClick={() => openWhatsApp(client)}
                        className={clsx(
                          "p-2 rounded-xl transition-all hover:bg-gray-50",
                          getWhatsAppStatus(client.lastWhatsAppContact).color
                        )}
                        title={getWhatsAppStatus(client.lastWhatsAppContact).label}
                      >
                        <div className="relative">
                          <MessageCircle size={20} />
                          <div className={clsx(
                            "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white",
                            getWhatsAppStatus(client.lastWhatsAppContact).color.replace('text-', 'bg-')
                          )} />
                        </div>
                      </button>
                      {client.lastWhatsAppContact && (
                        <span className="text-[8px] font-bold text-gray-400 mt-[-4px]">
                          {new Date(client.lastWhatsAppContact).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )}
                  <button onClick={() => openEditModal(client)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(client.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-gray-900 mb-2">{client.name}</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                  المصدر: {client.source || 'غير محدد'}
                </span>
                <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">
                  {client.service || 'بدون خدمة'}
                </span>
              </div>
              
              <div className="space-y-3 mb-6 flex-1">
                {client.phone && (
                  <div className="flex items-center gap-3 text-gray-500 font-medium text-sm">
                    <Phone size={16} className="text-gray-400" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3 text-gray-500 font-medium text-sm">
                    <Mail size={16} className="text-gray-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
              </div>

              {/* Financial Summary in Card */}
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 mb-1">إجمالي المبلغ</p>
                  <p className="text-sm font-black text-gray-900">{(client.totalPrice || 0).toLocaleString()} ج.م</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 mb-1">المتبقي</p>
                  <p className="text-sm font-black text-red-600">{(client.remainingAmount || 0).toLocaleString()} ج.م</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <span className={clsx(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  client.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                  client.status === 'lead' ? "bg-blue-50 text-blue-600" : 
                  client.status === 'closed' ? "bg-purple-50 text-purple-600" :
                  "bg-gray-100 text-gray-500"
                )}>
                  {client.status === 'active' ? 'عميل نشط' : client.status === 'lead' ? 'فرصة بيعية' : client.status === 'closed' ? 'مغلق (تم البيع)' : 'غير نشط'}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {new Date(client.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد عملاء</h3>
          <p className="text-gray-500 font-medium">ابدأ بإضافة أول عميل لوكالتك الآن</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[80vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">اسم العميل / الشركة</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="مثال: شركة المراعي"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">رقم الهاتف</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="05xxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="example@mail.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">مصدر العميل</label>
              <select 
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
              >
                <option value="">اختر المصدر</option>
                <option value="Facebook">فيسبوك</option>
                <option value="Instagram">إنستغرام</option>
                <option value="Snapchat">سناب شات</option>
                <option value="Google">جوجل</option>
                <option value="Referral">توصية</option>
                <option value="Website">الموقع الإلكتروني</option>
                <option value="Other">أخرى</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الخدمة المطلوبة</label>
              <input 
                type="text" 
                value={formData.service}
                onChange={(e) => setFormData({...formData, service: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="مثال: إدارة حسابات"
              />
            </div>
          </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الحالة</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as Client['status']})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
              >
                <option value="lead">فرصة بيعية (Lead)</option>
                <option value="contacted">تم التواصل (Contacted)</option>
                <option value="proposal">عرض سعر (Proposal)</option>
                <option value="negotiation">تفاوض (Negotiation)</option>
                <option value="active">عميل نشط (Active)</option>
                <option value="inactive">غير نشط (Inactive)</option>
                <option value="closed">مغلق / تم البيع (Closed)</option>
              </select>
            </div>

            <div className="bg-blue-50 p-6 rounded-3xl space-y-4">
              <h4 className="font-black text-blue-900 text-sm">المعلومات المالية</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-700">القيمة المتوقعة (لـ Leads)</label>
                  <input 
                    type="number" 
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({...formData, estimatedValue: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-white border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-700">إجمالي قيمة التعاقد</label>
                  <input 
                    type="number" 
                    value={formData.totalPrice}
                    onChange={(e) => setFormData({...formData, totalPrice: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-white border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-700">المبلغ المدفوع</label>
                <input 
                  type="number" 
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({...formData, paidAmount: Number(e.target.value)})}
                  className="w-full px-4 py-3 bg-white border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  placeholder="0"
                />
              </div>
            <div className="pt-2 border-t border-blue-100 flex justify-between items-center">
              <span className="text-xs font-bold text-blue-700">المبلغ المتبقي:</span>
              <span className="text-lg font-black text-blue-900">{(formData.totalPrice - formData.paidAmount).toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">العنوان</label>
            <textarea 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[80px]"
              placeholder="العنوان الكامل للعميل..."
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingClient ? 'حفظ التعديلات' : 'إضافة العميل'}
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
