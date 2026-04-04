import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, UserProfile, Client, Project } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';

export const Analytics = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() })) as Task[]));
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() })) as unknown as UserProfile[]));
    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map(d => ({ id: d.id, ...d.data() })) as Client[]));
    const unsubProjects = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]));
    setLoading(false);

    return () => { unsubTasks(); unsubUsers(); unsubClients(); unsubProjects(); };
  }, []);

  // Data for Task Completion by User
  const taskCompletionData = users.map(user => {
    const userTasks = tasks.filter(t => t.assignedTo.includes(user.uid));
    const completed = userTasks.filter(t => t.status === 'done').length;
    return {
      name: user.name,
      completed,
      total: userTasks.length
    };
  }).filter(d => d.total > 0);

  // Data for Client Status Distribution
  const clientStatusData = [
    { name: 'فرصة', value: clients.filter(c => c.status === 'lead').length, color: '#3b82f6' },
    { name: 'نشط', value: clients.filter(c => c.status === 'active').length, color: '#10b981' },
    { name: 'مغلق', value: clients.filter(c => c.status === 'closed').length, color: '#a855f7' },
    { name: 'غير نشط', value: clients.filter(c => c.status === 'inactive').length, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  // Data for Project Status
  const projectStatusData = [
    { name: 'قيد التنفيذ', value: projects.filter(p => p.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'مكتمل', value: projects.filter(p => p.status === 'completed').length, color: '#10b981' },
    { name: 'متوقف', value: projects.filter(p => p.status === 'on_hold').length, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">تقارير الأداء والتحليلات</h2>
          <p className="text-gray-500 mt-1 font-medium">نظرة شاملة على أداء الفريق، المشاريع، والنمو المالي</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-bold text-sm">
          <Activity size={18} />
          <span>تحديث مباشر</span>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-gray-500 font-bold">نسبة الإنجاز</span>
          </div>
          <p className="text-3xl font-black text-gray-900">
            {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <span className="text-gray-500 font-bold">إجمالي التعاقدات</span>
          </div>
          <p className="text-3xl font-black text-gray-900">
            {clients.reduce((acc, c) => acc + (c.totalPrice || 0), 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <span className="text-gray-500 font-bold">مهام قيد العمل</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{tasks.filter(t => t.status !== 'done').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <Users size={24} />
            </div>
            <span className="text-gray-500 font-bold">الفريق النشط</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{users.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Completion Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-xl font-black text-gray-900">إنجاز المهام لكل موظف</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskCompletionData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="completed" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Status Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <PieChartIcon size={20} />
            </div>
            <h3 className="text-xl font-black text-gray-900">توزيع حالات العملاء</h3>
          </div>
          <div className="h-80 w-full flex flex-col md:flex-row items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {clientStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 min-w-[150px]">
              {clientStatusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-bold text-gray-500">{entry.name}</span>
                  <span className="text-xs font-black text-gray-900">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
