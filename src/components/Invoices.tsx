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
import { Invoice, Client, Project, AgencySettings, InvoiceItem } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Edit2, 
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Settings,
  Image as ImageIcon,
  X,
  MessageCircle,
  Users,
  Briefcase
} from 'lucide-react';
import { clsx } from 'clsx';

export const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customNumber: '',
    clientId: '',
    projectId: '',
    amount: 0,
    currency: '',
    dueDate: '',
    status: 'unpaid' as Invoice['status'],
    items: [] as InvoiceItem[],
    notes: ''
  });

  const [settingsFormData, setSettingsFormData] = useState<Partial<AgencySettings>>({
    name: 'MBU Studio',
    logo: 'https://drive.google.com/uc?export=download&id=1CA2157vgEoRRyRJVFuAhPN9GntFBcl9C',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '966500000000+',
    email: 'info@mbustudio.com',
    website: 'www.mbustudio.com',
    taxNumber: '',
    currency: 'ج.م'
  });

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      setInvoices(invoicesData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'invoices');
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    });

    const unsubscribeSettings = onSnapshot(collection(db, 'agencySettings'), (snapshot) => {
      if (!snapshot.empty) {
        const settingsData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AgencySettings;
        setAgencySettings(settingsData);
        setSettingsFormData(settingsData);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeClients();
      unsubscribeProjects();
      unsubscribeSettings();
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (agencySettings?.id) {
        await updateDoc(doc(db, 'agencySettings', agencySettings.id), {
          ...settingsFormData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'agencySettings'), {
          ...settingsFormData,
          updatedAt: new Date().toISOString()
        });
      }
      setIsSettingsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, agencySettings ? OperationType.UPDATE : OperationType.CREATE, 'agencySettings');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const newAmount = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setFormData({ ...formData, items: newItems, amount: newAmount });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    const newAmount = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setFormData({ ...formData, items: newItems, amount: newAmount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id), {
          ...formData,
          currency: formData.currency || agencySettings?.currency || 'ج.م'
        });
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...formData,
          currency: formData.currency || agencySettings?.currency || 'ج.م',
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingInvoice(null);
      setFormData({ customNumber: '', clientId: '', projectId: '', amount: 0, currency: '', dueDate: '', status: 'unpaid', items: [], notes: '' });
    } catch (err) {
      handleFirestoreError(err, editingInvoice ? OperationType.UPDATE : OperationType.CREATE, 'invoices');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'invoices');
      }
    }
  };

  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);

  const handlePrint = (invoice: Invoice) => {
    setPrintingInvoice(invoice);
    setTimeout(() => {
      window.print();
      setPrintingInvoice(null);
    }, 100);
  };

  const openWhatsApp = (invoice: Invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const cleanPhone = client?.phone?.replace(/\D/g, '');
    if (!cleanPhone) {
      alert('لا يوجد رقم هاتف مسجل لهذا العميل');
      return;
    }

    const invoiceNum = invoice.customNumber || `#${invoice.id.slice(-6).toUpperCase()}`;
    const amount = `${invoice.currency || agencySettings?.currency || 'ج.م'}${invoice.amount.toLocaleString()}`;
    
    const message = `مرحباً ${client?.name}،\n\nنود إخطاركم بصدور الفاتورة رقم ${invoiceNum} بمبلغ ${amount}.\nتاريخ الاستحقاق: ${invoice.dueDate}\n\nشكراً لتعاملكم معنا!`;
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'عميل غير معروف';
  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'مشروع غير معروف';

  const filteredInvoices = invoices.filter(invoice => {
    const clientName = getClientName(invoice.clientId).toLowerCase();
    const matchesSearch = clientName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">الفواتير والمدفوعات</h2>
          <p className="text-gray-500 mt-1 font-medium">إدارة الفواتير، تتبع المدفوعات، والتحصيل</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Settings size={20} />
            <span>إعدادات الوكالة</span>
          </button>
          <button 
            onClick={() => {
              setEditingInvoice(null);
              setFormData({ customNumber: '', clientId: '', projectId: '', amount: 0, currency: '', dueDate: '', status: 'unpaid', items: [], notes: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            <span>إنشاء فاتورة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم العميل..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'paid', 'unpaid', 'partial'].map((status) => (
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
              {status === 'all' ? 'الكل' : status === 'paid' ? 'مدفوعة' : status === 'unpaid' ? 'غير مدفوعة' : 'مدفوعة جزئياً'}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredInvoices.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                <th className="px-6 py-4">رقم الفاتورة</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">المشروع</th>
                <th className="px-6 py-4">المبلغ</th>
                <th className="px-6 py-4">تاريخ الاستحقاق</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {invoice.customNumber ? invoice.customNumber : `#${invoice.id.slice(-6).toUpperCase()}`}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-bold">{getClientName(invoice.clientId)}</td>
                  <td className="px-6 py-4 text-gray-500 font-medium">{getProjectName(invoice.projectId || '')}</td>
                  <td className="px-6 py-4 font-black text-gray-900">{invoice.currency || agencySettings?.currency || 'ج.م'}{invoice.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-500 font-medium">{invoice.dueDate}</td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      invoice.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                      invoice.status === 'unpaid' ? "bg-rose-50 text-rose-600" : 
                      "bg-amber-50 text-amber-600"
                    )}>
                      {invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'unpaid' ? 'غير مدفوعة' : 'جزئية'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handlePrint(invoice)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => openWhatsApp(invoice)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button onClick={() => {
                        setEditingInvoice(invoice);
                        setFormData({
                          customNumber: invoice.customNumber || '',
                          clientId: invoice.clientId,
                          projectId: invoice.projectId || '',
                          amount: invoice.amount,
                          currency: invoice.currency || '',
                          dueDate: invoice.dueDate,
                          status: invoice.status,
                          items: invoice.items || [],
                          notes: invoice.notes || ''
                        });
                        setIsModalOpen(true);
                      }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(invoice.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <FileText size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد فواتير</h3>
          <p className="text-gray-500 font-medium">ابدأ بإنشاء أول فاتورة لعملائك الآن</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingInvoice ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">رقم الفاتورة (اختياري)</label>
                <div className="relative">
                  <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="مثال: INV-2024-001"
                    value={formData.customNumber}
                    onChange={(e) => setFormData({...formData, customNumber: e.target.value})}
                    className="w-full pr-12 pl-4 py-3 bg-white border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">العميل</label>
                <div className="relative">
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <select 
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                    className="w-full pr-12 pl-4 py-3 bg-white border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none shadow-sm"
                  >
                    <option value="">اختر العميل...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">المشروع المرتبط (اختياري)</label>
              <div className="relative">
                <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <select 
                  value={formData.projectId}
                  onChange={(e) => {
                    const projId = e.target.value;
                    const project = projects.find(p => p.id === projId);
                    setFormData({
                      ...formData, 
                      projectId: projId,
                      clientId: project ? project.clientId : formData.clientId
                    });
                  }}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="">اختر المشروع...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">تاريخ الاستحقاق</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="date" 
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <label className="text-sm font-black text-gray-900">بنود الفاتورة</label>
              </div>
              <button 
                type="button"
                onClick={addItem}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-100"
              >
                <Plus size={14} />
                إضافة بند جديد
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.items.length > 0 ? (
                formData.items.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 items-start bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group">
                    <div className="flex-1 w-full">
                      <input 
                        type="text"
                        placeholder="وصف الخدمة أو المنتج"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <div className="w-24">
                        <input 
                          type="number"
                          placeholder="الكمية"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all text-center"
                        />
                      </div>
                      <div className="flex-1 sm:w-32">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                            {formData.currency || agencySettings?.currency || 'ج.م'}
                          </span>
                          <input 
                            type="number"
                            placeholder="السعر"
                            value={item.price}
                            onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            className="w-full pr-4 pl-10 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-xs text-gray-400 font-bold">لا توجد بنود مضافة بعد</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">المبلغ الإجمالي</label>
              <div className="relative">
                <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="number" 
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-black text-blue-600"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الحالة</label>
              <div className="relative">
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as Invoice['status']})}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="unpaid">غير مدفوعة</option>
                  <option value="paid">مدفوعة</option>
                  <option value="partial">مدفوعة جزئياً</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">ملاحظات إضافية</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium h-24 resize-none"
              placeholder="شروط الدفع، تفاصيل التحويل، إلخ..."
            />
          </div>
          
          <div className="pt-6 flex gap-3 sticky bottom-0 bg-white pb-2">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingInvoice ? 'حفظ التعديلات' : 'إنشاء وإصدار الفاتورة'}
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

      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="إعدادات الوكالة"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">اسم الوكالة</label>
            <input 
              required
              type="text" 
              value={settingsFormData.name}
              onChange={(e) => setSettingsFormData({...settingsFormData, name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">رابط اللوجو (URL)</label>
            <input 
              type="text" 
              value={settingsFormData.logo}
              onChange={(e) => setSettingsFormData({...settingsFormData, logo: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">العنوان</label>
            <input 
              type="text" 
              value={settingsFormData.address}
              onChange={(e) => setSettingsFormData({...settingsFormData, address: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الهاتف</label>
              <input 
                type="text" 
                value={settingsFormData.phone}
                onChange={(e) => setSettingsFormData({...settingsFormData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
              <input 
                type="email" 
                value={settingsFormData.email}
                onChange={(e) => setSettingsFormData({...settingsFormData, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الرقم الضريبي</label>
              <input 
                type="text" 
                value={settingsFormData.taxNumber}
                onChange={(e) => setSettingsFormData({...settingsFormData, taxNumber: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">العملة</label>
              <input 
                type="text" 
                value={settingsFormData.currency}
                onChange={(e) => setSettingsFormData({...settingsFormData, currency: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="ج.م"
              />
            </div>
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice Template */}
      {printingInvoice && (
        <div className="fixed inset-0 bg-white z-[9999] p-10 text-right dir-rtl print-only-content">
          <div className="max-w-4xl mx-auto border-2 border-gray-100 p-12 rounded-3xl">
            <div className="flex justify-between items-start mb-12">
              <div>
                {agencySettings?.logo && (
                  <img src={agencySettings.logo} alt="Logo" className="h-16 mb-4 object-contain" referrerPolicy="no-referrer" />
                )}
                <h1 className="text-4xl font-black text-blue-600 mb-2">فاتورة ضريبية</h1>
                <p className="text-gray-500 font-bold">
                  رقم الفاتورة: {printingInvoice.customNumber ? printingInvoice.customNumber : `#${printingInvoice.id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-black text-gray-900">{agencySettings?.name || 'MBU Studio'}</h2>
                <p className="text-gray-500 font-medium">{agencySettings?.address}</p>
                <p className="text-gray-500 font-medium">هاتف: {agencySettings?.phone}</p>
                {agencySettings?.taxNumber && <p className="text-gray-500 font-medium">الرقم الضريبي: {agencySettings.taxNumber}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <h3 className="text-sm font-black text-gray-400 uppercase mb-4">مقدمة إلى:</h3>
                <p className="text-xl font-black text-gray-900">{getClientName(printingInvoice.clientId)}</p>
                <p className="text-gray-500 font-medium">{getProjectName(printingInvoice.projectId || '')}</p>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-gray-400 uppercase mb-4">تفاصيل الفاتورة:</h3>
                <p className="text-gray-700 font-bold">تاريخ الإصدار: {new Date(printingInvoice.createdAt).toLocaleDateString('ar-EG')}</p>
                <p className="text-gray-700 font-bold">تاريخ الاستحقاق: {printingInvoice.dueDate}</p>
              </div>
            </div>

            <table className="w-full mb-12">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="py-4 text-right font-black text-gray-900">الوصف</th>
                  <th className="py-4 text-center font-black text-gray-900">الكمية</th>
                  <th className="py-4 text-left font-black text-gray-900">السعر</th>
                  <th className="py-4 text-left font-black text-gray-900">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {printingInvoice.items && printingInvoice.items.length > 0 ? (
                  printingInvoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-6 text-gray-700 font-medium">{item.description}</td>
                      <td className="py-6 text-center text-gray-700 font-medium">{item.quantity}</td>
                      <td className="py-6 text-left text-gray-700 font-medium">{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{item.price.toLocaleString()}</td>
                      <td className="py-6 text-left font-black text-gray-900">{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{(item.quantity * item.price).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-gray-50">
                    <td className="py-6 text-gray-700 font-medium">خدمات تسويقية وتطويرية للمشروع</td>
                    <td className="py-6 text-center text-gray-700 font-medium">1</td>
                    <td className="py-6 text-left text-gray-700 font-medium">{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{printingInvoice.amount.toLocaleString()}</td>
                    <td className="py-6 text-left font-black text-gray-900">{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{printingInvoice.amount.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between items-start">
              <div className="flex-1 ml-12">
                {printingInvoice.notes && (
                  <>
                    <h3 className="text-sm font-black text-gray-400 uppercase mb-2">ملاحظات:</h3>
                    <p className="text-gray-600 font-medium whitespace-pre-wrap">{printingInvoice.notes}</p>
                  </>
                )}
              </div>
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>المجموع الفرعي:</span>
                  <span>{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{printingInvoice.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>الضريبة (0%):</span>
                  <span>{printingInvoice.currency || agencySettings?.currency || 'ج.م'}0</span>
                </div>
                <div className="flex justify-between text-2xl font-black text-blue-600 pt-3 border-t border-gray-100">
                  <span>الإجمالي:</span>
                  <span>{printingInvoice.currency || agencySettings?.currency || 'ج.م'}{printingInvoice.amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-20 pt-12 border-t border-gray-50 text-center">
              <p className="text-gray-400 font-medium">شكراً لتعاملكم معنا!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
