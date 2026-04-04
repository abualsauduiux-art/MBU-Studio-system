import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Invoice, Expense, Project, Client } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { clsx } from 'clsx';

export const Reports = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[]);
      setLoading(false);
    });

    return () => {
      unsubInvoices();
      unsubExpenses();
    };
  }, []);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;

  // Monthly Data for Chart
  const monthlyData = [
    { name: 'يناير', revenue: 4000, expenses: 2400 },
    { name: 'فبراير', revenue: 3000, expenses: 1398 },
    { name: 'مارس', revenue: 2000, expenses: 9800 },
    { name: 'أبريل', revenue: 2780, expenses: 3908 },
    { name: 'مايو', revenue: 1890, expenses: 4800 },
    { name: 'يونيو', revenue: 2390, expenses: 3800 },
  ];

  const expenseCategories = [
    { name: 'إعلانات', value: expenses.filter(e => e.category === 'ads').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'رواتب', value: expenses.filter(e => e.category === 'salaries').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'أدوات', value: expenses.filter(e => e.category === 'tools').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'أخرى', value: expenses.filter(e => e.category === 'other').reduce((sum, e) => sum + e.amount, 0) },
  ].filter(c => c.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f43f5e'];

  const handleExport = () => {
    const data = [
      ['التاريخ', 'النوع', 'المبلغ', 'الوصف'],
      ...invoices.map(i => [new Date(i.createdAt).toLocaleDateString('ar-EG'), 'إيراد', i.amount, i.notes || '']),
      ...expenses.map(e => [e.date, 'مصروف', e.amount, e.description || ''])
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">التقارير والتحليلات</h2>
          <p className="text-gray-500 mt-1 font-medium">تحليل الأداء المالي ونمو الوكالة</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm"
        >
          <ArrowUpRight size={20} />
          <span>تصدير التقرير</span>
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-emerald-600 flex items-center text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
              <ArrowUpRight size={14} />
              12%
            </span>
          </div>
          <p className="text-gray-400 font-bold text-sm uppercase mb-1">إجمالي الإيرادات</p>
          <h3 className="text-3xl font-black text-gray-900">ج.م{totalRevenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
            <span className="text-rose-600 flex items-center text-xs font-bold bg-rose-50 px-2 py-1 rounded-lg">
              <ArrowDownRight size={14} />
              5%
            </span>
          </div>
          <p className="text-gray-400 font-bold text-sm uppercase mb-1">إجمالي المصاريف</p>
          <h3 className="text-3xl font-black text-gray-900">ج.م{totalExpenses.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <span className="text-blue-600 flex items-center text-xs font-bold bg-blue-50 px-2 py-1 rounded-lg">
              <ArrowUpRight size={14} />
              8%
            </span>
          </div>
          <p className="text-gray-400 font-bold text-sm uppercase mb-1">صافي الربح</p>
          <h3 className={clsx("text-3xl font-black", totalProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
            ج.م{totalProfit.toLocaleString()}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue vs Expenses Chart */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-gray-900 mb-8">الإيرادات مقابل المصاريف</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الإيرادات" />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="المصاريف" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Distribution */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-gray-900 mb-8">توزيع المصاريف</h3>
          <div className="h-[300px] w-full">
            {expenseCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <PieChartIcon size={48} className="mb-4 opacity-20" />
                <p className="font-bold">لا توجد بيانات كافية</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
