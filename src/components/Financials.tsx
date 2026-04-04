import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  Wallet,
  CreditCard,
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { Client, Invoice, Expense } from '../types';

export const Financials = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);
    });

    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('createdAt', 'desc')), (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
    });

    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[]);
      setLoading(false);
    });

    return () => {
      unsubClients();
      unsubInvoices();
      unsubExpenses();
    };
  }, []);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOutstanding = clients.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const exportFinancialReport = () => {
    const headers = ["Category", "Details", "Amount", "Date", "Status"];
    const rows = [];

    // Summary Section
    rows.push(["SUMMARY", "", "", "", ""]);
    rows.push(["Total Revenue", "", totalRevenue, "", ""]);
    rows.push(["Total Expenses", "", totalExpenses, "", ""]);
    rows.push(["Net Profit", "", profit, "", ""]);
    rows.push(["Profit Margin", "", `${profitMargin.toFixed(2)}%`, "", ""]);
    rows.push(["Total Outstanding", "", totalOutstanding, "", ""]);
    rows.push(["", "", "", "", ""]);

    // Transactions Section
    rows.push(["TRANSACTIONS", "", "", "", ""]);
    rows.push(headers);
    const sortedTransactions = [...invoices.map(i => ({ ...i, type: 'invoice' })), ...expenses.map(e => ({ ...e, type: 'expense' }))]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    sortedTransactions.forEach((item: any) => {
      rows.push([
        item.type === 'invoice' ? 'Invoice' : 'Expense',
        item.type === 'invoice' ? (item.clientName || 'Client') : item.category,
        item.amount,
        item.createdAt.split('T')[0],
        item.status || 'Paid'
      ]);
    });
    rows.push(["", "", "", "", ""]);

    // Client Balances Section
    rows.push(["CLIENT BALANCES", "", "", "", ""]);
    rows.push(["Client Name", "Total Price", "Paid Amount", "Remaining Amount", "Progress"]);
    clients.filter(c => (c.remainingAmount || 0) > 0).forEach(client => {
      rows.push([
        client.name,
        client.totalPrice,
        client.paidAmount,
        client.remainingAmount || 0,
        `${Math.round((client.paidAmount / client.totalPrice) * 100)}%`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h2 className="text-3xl font-black text-gray-900">النظام المالي</h2>
          <p className="text-gray-500 mt-1 font-medium">تتبع الإيرادات، المصاريف، والأرباح الكلية</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportFinancialReport}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={18} />
            <span>تصدير تقرير</span>
          </button>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['month', 'year', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                  timeRange === range ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                )}
              >
                {range === 'month' ? 'هذا الشهر' : range === 'year' ? 'هذا العام' : 'الكل'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <ArrowUpRight size={12} />
              +12%
            </span>
          </div>
          <p className="text-gray-500 text-sm font-bold mb-1">إجمالي الإيرادات</p>
          <h3 className="text-2xl font-black text-gray-900">ج.م{totalRevenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <ArrowDownRight size={12} />
              -5%
            </span>
          </div>
          <p className="text-gray-500 text-sm font-bold mb-1">إجمالي المصاريف</p>
          <h3 className="text-2xl font-black text-gray-900">ج.م{totalExpenses.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <div className="w-10 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${profitMargin}%` }} />
            </div>
          </div>
          <p className="text-gray-500 text-sm font-bold mb-1">صافي الربح</p>
          <h3 className="text-2xl font-black text-gray-900">ج.م{profit.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              مستحقات
            </span>
          </div>
          <p className="text-gray-500 text-sm font-bold mb-1">مبالغ متبقية لدى العملاء</p>
          <h3 className="text-2xl font-black text-gray-900">ج.م{totalOutstanding.toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">آخر المعاملات</h3>
            <div className="flex gap-2">
              <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                <Filter size={18} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {[...invoices.map(i => ({ ...i, type: 'invoice' })), ...expenses.map(e => ({ ...e, type: 'expense' }))]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 8)
              .map((item: any, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      item.type === 'invoice' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      {item.type === 'invoice' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">
                        {item.type === 'invoice' ? `فاتورة: ${item.clientName || 'عميل'}` : item.category}
                      </p>
                      <p className="text-xs font-bold text-gray-400">{item.createdAt.split('T')[0]}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={clsx(
                      "text-sm font-black",
                      item.type === 'invoice' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {item.type === 'invoice' ? '+' : '-'}ج.م{item.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{item.status || 'مدفوع'}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Client Balances */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">مستحقات العملاء</h3>
            <span className="text-xs font-bold text-gray-400">{clients.filter(c => (c.remainingAmount || 0) > 0).length} عملاء</span>
          </div>
          <div className="divide-y divide-gray-50">
            {clients
              .filter(c => (c.remainingAmount || 0) > 0)
              .sort((a, b) => (b.remainingAmount || 0) - (a.remainingAmount || 0))
              .map((client, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {client.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{client.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600" 
                            style={{ width: `${(client.paidAmount / client.totalPrice) * 100}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">
                          {Math.round((client.paidAmount / client.totalPrice) * 100)}% تم سداده
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-rose-600">ج.م{(client.remainingAmount || 0).toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">متبقي</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
