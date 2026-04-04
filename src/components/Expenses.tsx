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
import { Expense } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Edit2, 
  TrendingDown,
  PieChart,
  Tag,
  Briefcase,
  Users,
  Settings
} from 'lucide-react';
import { clsx } from 'clsx';

export const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    category: 'ads' as Expense['category'],
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expensesData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), formData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({ category: 'ads', amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      handleFirestoreError(err, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'expenses');
      }
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    return categoryFilter === 'all' || expense.category === categoryFilter;
  });

  const categoryLabels: Record<Expense['category'], string> = {
    ads: 'إعلانات ممولة',
    salaries: 'رواتب الفريق',
    tools: 'أدوات واشتراكات',
    other: 'مصاريف أخرى'
  };

  const categoryIcons: Record<Expense['category'], any> = {
    ads: TrendingDown,
    salaries: Users,
    tools: Settings,
    other: Tag
  };

  const categoryColors: Record<Expense['category'], string> = {
    ads: "bg-blue-50 text-blue-600",
    salaries: "bg-emerald-50 text-emerald-600",
    tools: "bg-indigo-50 text-indigo-600",
    other: "bg-gray-50 text-gray-600"
  };

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">المصاريف</h2>
          <p className="text-gray-500 mt-1 font-medium">تتبع مصاريف الوكالة، الرواتب، وتكاليف الإعلانات</p>
        </div>
        <button 
          onClick={() => {
            setEditingExpense(null);
            setFormData({ category: 'ads', amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          <span>إضافة مصروف جديد</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
            <TrendingDown size={32} />
          </div>
          <div>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-wider">إجمالي المصاريف</p>
            <h3 className="text-4xl font-black text-gray-900">ج.م{totalAmount.toLocaleString()}</h3>
          </div>
        </div>
        <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl">
          {['all', 'ads', 'salaries', 'tools', 'other'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={clsx(
                "px-4 py-2 rounded-xl font-bold text-xs transition-all",
                categoryFilter === cat 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {cat === 'all' ? 'الكل' : categoryLabels[cat as Expense['category']]}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredExpenses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExpenses.map((expense) => {
            const Icon = categoryIcons[expense.category];
            return (
              <div key={expense.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center", categoryColors[expense.category])}>
                    <Icon size={24} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      setEditingExpense(expense);
                      setFormData({
                        category: expense.category,
                        amount: expense.amount,
                        description: expense.description || '',
                        date: expense.date
                      });
                      setIsModalOpen(true);
                    }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-black text-gray-400 uppercase mb-1">{categoryLabels[expense.category]}</p>
                  <h3 className="text-xl font-black text-gray-900">{expense.description || 'بدون وصف'}</h3>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-rose-600 font-black text-lg">
                    <span className="text-sm">ج.م</span>
                    <span>{expense.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 font-bold text-xs">
                    <Calendar size={14} />
                    <span>{expense.date}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <CreditCard size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد مصاريف</h3>
          <p className="text-gray-500 font-medium">ابدأ بتسجيل مصاريف الوكالة لمتابعة الأرباح</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">التصنيف</label>
            <select 
              required
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value as Expense['category']})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
            >
              <option value="ads">إعلانات ممولة</option>
              <option value="salaries">رواتب الفريق</option>
              <option value="tools">أدوات واشتراكات</option>
              <option value="other">مصاريف أخرى</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">المبلغ (ج.م)</label>
              <input 
                required
                type="number" 
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">التاريخ</label>
              <input 
                required
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">الوصف</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]"
              placeholder="مثال: إعلانات فيسبوك لشهر مارس..."
            />
          </div>
          
          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              {editingExpense ? 'حفظ التعديلات' : 'إضافة المصروف'}
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
