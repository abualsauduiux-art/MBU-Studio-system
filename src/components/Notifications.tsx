import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  CheckCircle2, 
  Trash2, 
  Clock, 
  AlertCircle,
  CheckCheck,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

export const Notifications = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().createdAt ? new Date(doc.data().createdAt).toLocaleString('ar-EG') : 'الآن'
      }));
      setNotifications(notifs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      for (const n of unreadNotifs) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;
    try {
      for (const n of notifications) {
        await deleteDoc(doc(db, 'notifications', n.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">الإشعارات</h2>
          <p className="text-gray-500 mt-1 font-medium">تابع آخر التحديثات والنشاطات في حسابك</p>
        </div>
        <div className="flex gap-3">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={markAllAsRead}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
              <CheckCheck size={20} />
              <span>تحديد الكل كمقروء</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearAll}
              className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-bold hover:bg-rose-100 transition-all"
            >
              <Trash2 size={20} />
              <span>مسح الكل</span>
            </button>
          )}
        </div>
      </div>

      {notifications.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={clsx(
                  "p-6 flex items-start gap-4 transition-all group",
                  !notif.read ? "bg-blue-50/30" : "hover:bg-gray-50"
                )}
              >
                <div className={clsx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                  !notif.read ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                )}>
                  <Bell size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <h3 className={clsx("text-lg font-bold truncate", !notif.read ? "text-gray-900" : "text-gray-600")}>
                      {notif.title}
                    </h3>
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{notif.time}</span>
                  </div>
                  <p className="text-gray-500 font-medium leading-relaxed mb-4">{notif.description}</p>
                  <div className="flex items-center gap-3">
                    {!notif.read && (
                      <button 
                        onClick={() => markAsRead(notif.id)}
                        className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all"
                      >
                        تحديد كمقروء
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(notif.id)}
                      className="text-xs font-bold text-gray-400 hover:text-rose-600 transition-all"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <Bell size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد إشعارات</h3>
          <p className="text-gray-500 font-medium">ستظهر هنا آخر التحديثات والنشاطات الخاصة بك</p>
        </div>
      )}
    </div>
  );
};
