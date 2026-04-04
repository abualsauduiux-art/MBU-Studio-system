import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, Project } from '../types';
import { 
  ChevronRight, 
  ChevronLeft, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

export const Calendar = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
      setLoading(false);
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeProjects();
    };
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('ar-EG', { month: 'long' });

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Fill empty slots for previous month
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Fill current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => task.deadline === dateStr || (task.reminderAt && task.reminderAt.startsWith(dateStr)));
  };

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'مشروع غير معروف';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">التقويم التفاعلي</h2>
          <p className="text-gray-500 mt-1 font-medium">متابعة المواعيد النهائية والتذكيرات زمنياً</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-all">
            <ChevronRight size={20} />
          </button>
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-lg font-black text-gray-900">{monthName}</span>
            <span className="text-xs font-bold text-gray-400">{year}</span>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-all">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-black text-gray-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="h-32 bg-gray-50/30 border-b border-l border-gray-50" />;
            
            const dayTasks = getTasksForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div key={idx} className={clsx(
                "h-40 p-3 border-b border-l border-gray-100 transition-all hover:bg-gray-50/50 group",
                isToday && "bg-blue-50/30"
              )}>
                <div className="flex justify-between items-start mb-2">
                  <span className={clsx(
                    "w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black transition-all",
                    isToday ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-400 group-hover:text-gray-900"
                  )}>
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </div>
                
                <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={clsx(
                        "px-2 py-1 rounded-lg text-[10px] font-bold truncate border",
                        task.status === 'done' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        task.priority === 'high' ? "bg-rose-50 text-rose-600 border-rose-100" :
                        "bg-blue-50 text-blue-600 border-blue-100"
                      )}
                      title={`${task.title} - ${getProjectName(task.projectId)}`}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold">مواعيد نهائية اليوم</p>
            <p className="text-2xl font-black text-gray-900">
              {getTasksForDate(new Date()).filter(t => t.deadline === new Date().toISOString().split('T')[0]).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold">تذكيرات اليوم</p>
            <p className="text-2xl font-black text-gray-900">
              {getTasksForDate(new Date()).filter(t => t.reminderAt && t.reminderAt.startsWith(new Date().toISOString().split('T')[0])).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold">مهام مكتملة</p>
            <p className="text-2xl font-black text-gray-900">
              {tasks.filter(t => t.status === 'done').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
