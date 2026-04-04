import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  BarChart3, 
  Plus,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const [stats, setStats] = useState({
    clients: 0,
    projects: 0,
    revenue: 0,
    expenses: 0,
    tasks: {
      total: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    },
    myTasks: {
      total: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    },
    recentProjects: [] as any[],
    recentActivities: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setStats(prev => ({ ...prev, clients: snap.size }));
    });

    const unsubProjects = onSnapshot(query(collection(db, 'projects'), orderBy('createdAt', 'desc')), (snap) => {
      const projects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ 
        ...prev, 
        projects: snap.size,
        recentProjects: projects.slice(0, 4)
      }));
    });

    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), (snap) => {
      const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Global task stats
      const taskStats = {
        total: snap.size,
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length
      };

      // User specific task stats
      const myTasks = tasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(profile?.uid));
      const myTaskStats = {
        total: myTasks.length,
        todo: myTasks.filter(t => t.status === 'todo').length,
        in_progress: myTasks.filter(t => t.status === 'in_progress').length,
        review: myTasks.filter(t => t.status === 'review').length,
        done: myTasks.filter(t => t.status === 'done').length
      };

      // Derive recent activities from tasks and projects
      const recentTasks = tasks.slice(0, 5).map(t => ({
        id: t.id,
        type: 'task',
        title: t.title,
        description: `تمت إضافة مهمة جديدة: ${t.title}`,
        time: t.createdAt,
        icon: CheckSquare,
        color: 'blue'
      }));

      setStats(prev => ({ 
        ...prev, 
        tasks: taskStats, 
        myTasks: myTaskStats,
        recentActivities: recentTasks
      }));
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      const revenue = snap.docs
        .map(doc => doc.data())
        .filter(d => d.status === 'paid')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      setStats(prev => ({ ...prev, revenue }));
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      const expenses = snap.docs
        .map(doc => doc.data())
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      setStats(prev => ({ ...prev, expenses }));
      setLoading(false);
    });

    return () => {
      unsubClients();
      unsubProjects();
      unsubTasks();
      unsubInvoices();
      unsubExpenses();
    };
  }, [profile?.uid]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const profit = stats.revenue - stats.expenses;
  const completionRate = stats.myTasks.total > 0 
    ? Math.round((stats.myTasks.done / stats.myTasks.total) * 100) 
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">أهلاً، {profile?.name} 👋</h2>
          <p className="text-gray-500 mt-1 font-medium">
            {isAdmin || isManager ? 'نظرة عامة على أداء الوكالة اليوم' : 'إليك ملخص لمهامك وأدائك اليوم'}
          </p>
        </div>
        {(isAdmin || isManager) && (
          <div className="flex gap-3">
            <Link to="/reports" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm">
              <BarChart3 size={18} />
              <span>عرض التقارير</span>
            </Link>
            <Link to="/projects" className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              <Plus size={18} />
              <span>إضافة مشروع</span>
            </Link>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isAdmin || isManager ? (
          <>
            {[
              { label: "إجمالي العملاء", value: stats.clients.toString(), change: "+12%", icon: Users, color: "blue" },
              { label: "المشاريع النشطة", value: stats.projects.toString(), change: "+5%", icon: Briefcase, color: "indigo" },
              { label: "الإيرادات الكلية", value: `ج.م${stats.revenue.toLocaleString()}`, change: "+18%", icon: DollarSign, color: "emerald" },
              { label: "صافي الربح", value: `ج.م${profit.toLocaleString()}`, change: profit >= 0 ? "+15%" : "-5%", icon: TrendingUp, color: profit >= 0 ? "emerald" : "rose" },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center", 
                    stat.color === 'blue' ? "bg-blue-50 text-blue-600" : 
                    stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" : 
                    stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : 
                    "bg-rose-50 text-rose-600"
                  )}>
                    <stat.icon size={24} />
                  </div>
                  <span className={clsx("text-xs font-bold px-2 py-1 rounded-lg", stat.change.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-gray-500 text-sm font-bold mb-1">{stat.label}</p>
                <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
              </div>
            ))}
          </>
        ) : (
          <>
            {[
              { label: "مهامي الكلية", value: stats.myTasks.total.toString(), icon: CheckSquare, color: "blue" },
              { label: "قيد التنفيذ", value: stats.myTasks.in_progress.toString(), icon: Clock, color: "indigo" },
              { label: "بانتظار المراجعة", value: stats.myTasks.review.toString(), icon: AlertCircle, color: "amber" },
              { label: "نسبة الإنجاز", value: `${completionRate}%`, icon: Target, color: "emerald" },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center", 
                    stat.color === 'blue' ? "bg-blue-50 text-blue-600" : 
                    stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" : 
                    stat.color === 'amber' ? "bg-amber-50 text-amber-600" : 
                    "bg-emerald-50 text-emerald-600"
                  )}>
                    <stat.icon size={24} />
                  </div>
                  {stat.label === "نسبة الإنجاز" && (
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-sm font-bold mb-1">{stat.label}</p>
                <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activities */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center justify-between">
            <span>النشاطات الأخيرة</span>
          </h3>
          <div className="space-y-6">
            {stats.recentActivities.length > 0 ? stats.recentActivities.map((activity, i) => (
              <div key={i} className="flex gap-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", 
                  activity.color === 'blue' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  <activity.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1">
                    {activity.time ? new Date(activity.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-gray-400 font-bold">لا توجد نشاطات حالياً</div>
            )}
          </div>
        </div>

        {/* Task Overview */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center justify-between">
            <span>{isAdmin || isManager ? 'نظرة على المهام العامة' : 'ملخص مهامي'}</span>
            <Link to="/tasks" className="text-blue-600 text-xs font-bold hover:underline">إدارة المهام</Link>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Clock size={20} />
                </div>
                <span className="text-sm font-bold text-gray-700">قيد العمل</span>
              </div>
              <span className="text-lg font-black text-blue-600">
                {isAdmin || isManager ? stats.tasks.in_progress : stats.myTasks.in_progress}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <AlertCircle size={20} />
                </div>
                <span className="text-sm font-bold text-gray-700">للمراجعة</span>
              </div>
              <span className="text-lg font-black text-amber-600">
                {isAdmin || isManager ? stats.tasks.review : stats.myTasks.review}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-sm font-bold text-gray-700">مكتملة</span>
              </div>
              <span className="text-lg font-black text-emerald-600">
                {isAdmin || isManager ? stats.tasks.done : stats.myTasks.done}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Projects or Performance */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {isAdmin || isManager ? (
            <>
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900">المشاريع الأخيرة</h3>
                <Link to="/projects" className="text-blue-600 text-sm font-bold hover:underline">عرض الكل</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                      <th className="px-6 py-4">المشروع</th>
                      <th className="px-6 py-4">الحالة</th>
                      <th className="px-6 py-4">الميزانية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.recentProjects.length > 0 ? stats.recentProjects.map((project, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900">{project.name}</td>
                        <td className="px-6 py-4">
                          <span className={clsx("px-3 py-1 rounded-full text-xs font-bold", 
                            project.status === "in_progress" ? "bg-blue-50 text-blue-600" : 
                            project.status === "completed" ? "bg-emerald-50 text-emerald-600" : 
                            "bg-amber-50 text-amber-600"
                          )}>
                            {project.status === 'in_progress' ? 'نشط' : project.status === 'completed' ? 'مكتمل' : 'معلق'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-900">ج.م{(project.budget || 0).toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-gray-400 font-bold">لا توجد مشاريع حالياً</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6">
                <Zap size={40} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">أداء متميز!</h3>
              <p className="text-gray-500 font-medium max-w-sm">
                لقد أكملت {stats.myTasks.done} مهمة بنجاح. استمر في هذا العطاء لتحقيق أهداف الفريق.
              </p>
              <div className="mt-8 w-full max-w-xs bg-gray-50 p-4 rounded-2xl">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-gray-500">معدل الإنجاز</span>
                  <span className="text-blue-600">{completionRate}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${completionRate}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
