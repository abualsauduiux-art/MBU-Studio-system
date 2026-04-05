import React, { useState, ReactNode, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, login, loginWithEmail, logout, db } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Logo, LogoFull } from './components/Logo';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  where,
  updateDoc,
  doc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  FileText, 
  CreditCard, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  User as UserIcon,
  Plus,
  Mail,
  Lock,
  MessageSquare,
  Calendar as CalendarIcon,
  FolderOpen,
  WifiOff,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active?: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
        : "text-gray-500 hover:bg-blue-50 hover:text-blue-600"
    )}
  >
    <Icon size={20} className={cn(active ? "text-white" : "text-gray-400 group-hover:text-blue-600")} />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout = ({ children }: { children: ReactNode }) => {
  const { profile, loading, hasPermission } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsOffline(false);
      } catch (err: any) {
        if (err.message?.includes('unavailable') || err.message?.includes('offline')) {
          setIsOffline(true);
        }
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Close sidebar on route change on mobile
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          time: data.createdAt ? new Date(data.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'
        };
      });
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error("Error marking notification as read", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans" dir="rtl">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 sm:w-72 bg-white border-l border-gray-100 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          !isSidebarOpen && "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
          <div className="mb-10 px-2 flex items-center justify-between">
            <LogoFull />
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {hasPermission('dashboard') && <SidebarItem to="/" icon={LayoutDashboard} label="لوحة التحكم" active={location.pathname === "/"} />}
            {hasPermission('clients') && <SidebarItem to="/clients" icon={Users} label="العملاء" active={location.pathname === "/clients"} />}
            {hasPermission('projects') && <SidebarItem to="/projects" icon={Briefcase} label="المشاريع" active={location.pathname === "/projects"} />}
            {hasPermission('tasks') && (
              <SidebarItem to="/tasks" icon={CheckSquare} label="المهام" active={location.pathname === "/tasks"} />
            )}
            {hasPermission('messages') && <SidebarItem to="/messages" icon={MessageSquare} label="الرسائل" active={location.pathname === "/messages"} />}
            
            {hasPermission('team') && (
              <SidebarItem to="/team" icon={UserIcon} label="الفريق" active={location.pathname === "/team"} />
            )}

            {hasPermission('financials') && (
              <>
                <SidebarItem to="/financials" icon={CreditCard} label="النظام المالي" active={location.pathname === "/financials"} />
                <SidebarItem to="/invoices" icon={FileText} label="الفواتير" active={location.pathname === "/invoices"} />
                <SidebarItem to="/expenses" icon={CreditCard} label="المصاريف" active={location.pathname === "/expenses"} />
              </>
            )}

            {hasPermission('settings') && (
              <SidebarItem to="/reports" icon={BarChart3} label="التقارير" active={location.pathname === "/reports"} />
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100">
            <button 
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-xl transition-colors group"
            >
              <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
              <span className="font-medium">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="flex items-center gap-6 mr-auto">
            {isOffline && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold border border-amber-100 animate-pulse">
                <WifiOff size={14} />
                <span>وضع عدم الاتصال</span>
              </div>
            )}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all relative"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-20 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="font-black text-gray-900">الإشعارات</h3>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                for (const n of notifications.filter(notif => !notif.read)) {
                                  await markAsRead(n.id);
                                }
                              }}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              تحديد الكل كمقروء
                            </button>
                          )}
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{unreadCount} جديدة</span>
                        </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              markAsRead(notif.id);
                              if (notif.link) {
                                navigate(notif.link);
                                setIsNotificationsOpen(false);
                              }
                            }}
                            className={cn(
                              "p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer",
                              !notif.read && "bg-blue-50/30"
                            )}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-gray-900">{notif.title}</p>
                              {!notif.read && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{notif.description}</p>
                            <p className="text-[10px] font-bold text-gray-400">{notif.time}</p>
                          </div>
                        )) : (
                          <div className="p-8 text-center text-gray-400 font-bold">لا توجد إشعارات</div>
                        )}
                      </div>
                      <div className="flex border-t border-gray-50">
                        <button 
                          onClick={async () => {
                            for (const n of notifications) {
                              await deleteDoc(doc(db, 'notifications', n.id));
                            }
                          }}
                          className="flex-1 p-3 text-center text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          مسح الكل
                        </button>
                        <button 
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            navigate('/notifications');
                          }}
                          className="flex-1 p-3 text-center text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors border-r border-gray-50"
                        >
                          عرض جميع الإشعارات
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div 
              className="flex items-center gap-3 pl-2 border-r border-gray-100 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-all"
              onClick={() => navigate('/profile')}
            >
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900 leading-tight">{profile?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{profile?.jobTitle || profile?.role}</p>
              </div>
              <img 
                src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.name}&background=random`} 
                alt="Profile" 
                className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

// --- Pages ---

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error: any) {
      console.error("Auth failed", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (error.code === 'auth/email-already-in-use') {
        setError("البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول.");
      } else {
        setError("حدث خطأ. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetAllUsers = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع الحسابات من قاعدة البيانات؟ لا يمكن التراجع عن هذه الخطوة.')) return;
    
    setResetLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, 'users', d.id)));
      await Promise.all(deletePromises);
      alert('تم حذف جميع الحسابات بنجاح. يمكنك الآن إنشاء حساب الأدمن الجديد.');
      setIsRegistering(true);
    } catch (err) {
      console.error("Error resetting users:", err);
      alert('حدث خطأ أثناء حذف الحسابات.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-blue-100 p-10 border border-white">
        <div className="text-center mb-10">
          <div className="mb-6 flex justify-center">
            <LogoFull />
          </div>
          <p className="text-gray-500 font-medium">
            {isRegistering ? 'إنشاء حساب جديد (للأدمن أول مرة)' : 'مرحباً بك مجدداً! يرجى تسجيل الدخول للمتابعة'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {isRegistering && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الاسم الكامل</label>
              <div className="relative">
                <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  placeholder="الاسم الكامل"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                required
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-12 pl-12 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="كلمة المرور"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              isRegistering ? "إنشاء الحساب" : "تسجيل الدخول"
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-blue-600 font-bold py-2 hover:underline transition-all"
          >
            {isRegistering ? "لديك حساب بالفعل؟ سجل دخولك" : "ليس لديك حساب؟ أنشئ حساباً جديداً"}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center space-y-4">
          <button
            onClick={resetAllUsers}
            disabled={resetLoading}
            className="text-xs text-red-500 font-bold hover:text-red-700 flex items-center justify-center gap-2 mx-auto"
          >
            <AlertTriangle size={14} />
            {resetLoading ? 'جاري الحذف...' : 'حذف جميع الحسابات والبدء من جديد'}
          </button>
          
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            {isRegistering ? 'تنبيه: هذا الخيار متاح مؤقتاً لإنشاء حساب الأدمن.' : 'من خلال تسجيل الدخول، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا'}
          </p>
        </div>
      </div>
    </div>
  );
};

import { Notifications } from './components/Notifications';
import { Dashboard } from './components/Dashboard';
import { Clients } from './components/Clients';
import { Projects } from './components/Projects';
import { Tasks } from './components/Tasks';
import { Teams } from './components/Teams';
import { Financials } from './components/Financials';
import { Invoices } from './components/Invoices';
import { Expenses } from './components/Expenses';
import { Team } from './components/Team';
import { Reports } from './components/Reports';
import { Messages } from './components/Messages';
import { Analytics } from './components/Analytics';
import { Profile } from './components/Profile';

// --- Main App Component ---

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <Routes>
      {!user ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={hasPermission('dashboard') ? <Layout><Dashboard /></Layout> : <Navigate to="/messages" replace />} />
          <Route path="/clients" element={hasPermission('clients') ? <Layout><Clients /></Layout> : <Navigate to="/" replace />} />
          <Route path="/projects" element={hasPermission('projects') ? <Layout><Projects /></Layout> : <Navigate to="/" replace />} />
          <Route path="/tasks" element={hasPermission('tasks') ? <Layout><Tasks /></Layout> : <Navigate to="/" replace />} />
          <Route path="/messages" element={hasPermission('messages') ? <Layout><Messages /></Layout> : <Navigate to="/" replace />} />
          
          <Route path="/team" element={hasPermission('team') ? <Layout><Team /></Layout> : <Navigate to="/" replace />} />
          
          <Route path="/financials" element={hasPermission('financials') ? <Layout><Financials /></Layout> : <Navigate to="/" replace />} />
          <Route path="/invoices" element={hasPermission('financials') ? <Layout><Invoices /></Layout> : <Navigate to="/" replace />} />
          <Route path="/expenses" element={hasPermission('financials') ? <Layout><Expenses /></Layout> : <Navigate to="/" replace />} />
          
          <Route path="/reports" element={hasPermission('settings') ? <Layout><Reports /></Layout> : <Navigate to="/" replace />} />
          <Route path="/analytics" element={hasPermission('settings') ? <Layout><Analytics /></Layout> : <Navigate to="/" replace />} />
          <Route path="/notifications" element={<Layout><Notifications /></Layout>} />
          <Route path="/profile" element={<Layout><Profile /></Layout>} />
          
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}
