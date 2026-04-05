import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Task, Project, UserProfile, Client, TaskComment } from '../types';
import { Modal } from './ui/Modal';
import { 
  Plus, 
  Search, 
  Filter, 
  CheckSquare, 
  Calendar, 
  User, 
  Trash2, 
  Edit2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  Flag, 
  Briefcase,
  MessageSquare,
  Paperclip,
  Send,
  ChevronRight,
  Users,
  Download
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { sendEmailNotification } from '../lib/email';

export const Tasks = () => {
  const { user: currentUser, profile, isAdmin, isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdParam = searchParams.get('id');
  
  const statusLabels = {
    todo: "للتنفيذ",
    in_progress: "قيد العمل",
    review: "للمراجعة",
    done: "مكتملة"
  };

  const statusColors = {
    todo: "bg-gray-100 text-gray-500",
    in_progress: "bg-blue-50 text-blue-600",
    review: "bg-amber-50 text-amber-600",
    done: "bg-emerald-50 text-emerald-600"
  };

  const priorityLabels = {
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية"
  };

  const priorityColors = {
    low: "text-emerald-600 bg-emerald-50",
    medium: "text-amber-600 bg-amber-50",
    high: "text-rose-600 bg-rose-50"
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  
  // Comments state
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    projectId: '',
    clientId: '',
    assignedTo: [] as string[],
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    status: 'todo' as Task['status'],
    deadline: '',
    reminderAt: '',
    files: [] as string[]
  });

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tasksData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tasks');
      setLoading(false);
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
    });

    const unsubscribeTeam = onSnapshot(collection(db, 'users'), (snapshot) => {
      const teamData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setTeam(teamData);
    });

    return () => {
      unsubscribe();
      unsubscribeProjects();
      unsubscribeClients();
      unsubscribeTeam();
    };
  }, []);

  // Handle task ID from query param
  useEffect(() => {
    if (taskIdParam && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskIdParam);
      if (task) {
        // We need to find the openEditModal function or implement the logic
        setEditingTask(task);
        setFormData({
          projectId: task.projectId || '',
          clientId: task.clientId || '',
          assignedTo: task.assignedTo || [],
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          deadline: task.deadline || '',
          reminderAt: task.reminderAt || '',
          files: task.files || []
        });
        setIsModalOpen(true);
        // Clear the param
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('id');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [taskIdParam, tasks, searchParams, setSearchParams]);

  // Reminder Checker
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const dueTasks = tasks.filter(task => 
        task.reminderAt && 
        !task.reminderNotified && 
        new Date(task.reminderAt) <= now
      );

      for (const task of dueTasks) {
        try {
          // Update task to prevent duplicate notifications
          await updateDoc(doc(db, 'tasks', task.id), {
            reminderNotified: true
          });

          // Create notification for all assigned users
          if (Array.isArray(task.assignedTo)) {
            for (const userId of task.assignedTo) {
              await addDoc(collection(db, 'notifications'), {
                userId,
                title: 'تذكير بمهمة',
                description: `تذكير: المهمة "${task.title}" حان موعد تذكيرها.`,
                type: 'task',
                read: false,
                link: `/tasks?id=${task.id}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error('Error triggering reminder:', err);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [tasks]);

  // Fetch comments when a task is selected for editing
  useEffect(() => {
    if (editingTask) {
      const q = query(
        collection(db, 'tasks', editingTask.id, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TaskComment[];
        setComments(commentsData);
      });
      return () => unsubscribe();
    } else {
      setComments([]);
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask) {
        const isReminderChanged = formData.reminderAt !== editingTask.reminderAt;
        const updateData = {
          ...formData,
          reminderNotified: isReminderChanged ? false : (editingTask.reminderNotified || false)
        };
        await updateDoc(doc(db, 'tasks', editingTask.id), updateData);
        
        // Notify newly assigned users if any
        const newAssignees = formData.assignedTo.filter(id => !editingTask.assignedTo?.includes(id));
        for (const userId of newAssignees) {
          if (userId !== profile?.uid) {
            await addDoc(collection(db, 'notifications'), {
              userId,
              title: 'تحديث مهمة',
              description: `تم تعيينك في المهمة: ${formData.title}`,
              type: 'task',
              read: false,
              link: `/tasks?id=${editingTask.id}`,
              createdAt: new Date().toISOString()
            });

            // Send Email Notification
            const assignedUser = team.find(u => u.uid === userId);
            if (assignedUser?.email) {
              await sendEmailNotification({
                to: assignedUser.email,
                subject: `تحديث مهمة: ${formData.title}`,
                text: `مرحباً ${assignedUser.name}، تم تعيينك في المهمة: ${formData.title}. يمكنك مراجعة التفاصيل في لوحة التحكم.`,
                html: `
                  <div style="font-family: sans-serif; direction: rtl; text-align: right;">
                    <h2>تحديث مهمة</h2>
                    <p>مرحباً <b>${assignedUser.name}</b>،</p>
                    <p>تم تعيينك في المهمة: <b>${formData.title}</b></p>
                    <p>الأولوية: ${priorityLabels[formData.priority]}</p>
                    <p>الموعد النهائي: ${formData.deadline || 'غير محدد'}</p>
                    <br/>
                    <a href="${window.location.origin}/tasks" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">فتح لوحة التحكم</a>
                  </div>
                `
              });
            }
          }
        }

        // Notify about status change
        if (formData.status !== editingTask.status) {
          for (const userId of formData.assignedTo) {
            if (userId !== profile?.uid) {
              await addDoc(collection(db, 'notifications'), {
                userId,
                title: 'تغيير حالة المهمة',
                description: `تم تغيير حالة المهمة "${formData.title}" إلى: ${statusLabels[formData.status]} بواسطة ${profile?.name}`,
                type: 'task',
                read: false,
                link: `/tasks?id=${editingTask.id}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        }
      } else {
        const taskRef = await addDoc(collection(db, 'tasks'), {
          ...formData,
          reminderNotified: false,
          createdAt: new Date().toISOString(),
          commentsCount: 0
        });

        // Notify assigned users
        for (const userId of formData.assignedTo) {
          if (userId !== profile?.uid) {
            await addDoc(collection(db, 'notifications'), {
              userId,
              title: 'مهمة جديدة',
              description: `تم تعيينك في مهمة جديدة: ${formData.title}`,
              type: 'task',
              read: false,
              link: `/tasks?id=${taskRef.id}`,
              createdAt: new Date().toISOString()
            });

            // Send Email Notification
            const assignedUser = team.find(u => u.uid === userId);
            if (assignedUser?.email) {
              await sendEmailNotification({
                to: assignedUser.email,
                subject: `مهمة جديدة: ${formData.title}`,
                text: `مرحباً ${assignedUser.name}، تم تعيينك في مهمة جديدة: ${formData.title}. يمكنك مراجعة التفاصيل في لوحة التحكم.`,
                html: `
                  <div style="font-family: sans-serif; direction: rtl; text-align: right;">
                    <h2>مهمة جديدة</h2>
                    <p>مرحباً <b>${assignedUser.name}</b>،</p>
                    <p>تم تعيينك في مهمة جديدة: <b>${formData.title}</b></p>
                    <p>الأولوية: ${priorityLabels[formData.priority]}</p>
                    <p>الموعد النهائي: ${formData.deadline || 'غير محدد'}</p>
                    <br/>
                    <a href="${window.location.origin}/tasks" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">فتح لوحة التحكم</a>
                  </div>
                `
              });
            }
          }
        }
      }
      setIsModalOpen(false);
      setEditingTask(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingTask ? OperationType.UPDATE : OperationType.CREATE, 'tasks');
    }
  };

  const resetForm = () => {
    setFormData({ 
      projectId: '', 
      clientId: '',
      assignedTo: [], 
      title: '', 
      description: '', 
      priority: 'medium', 
      status: 'todo', 
      deadline: '',
      reminderAt: '',
      files: []
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !newComment.trim() || !currentUser) return;

    try {
      await addDoc(collection(db, 'tasks', editingTask.id, 'comments'), {
        taskId: editingTask.id,
        userId: profile?.uid,
        userName: profile?.name || 'مجهول',
        userPhoto: profile?.photoURL || '',
        text: newComment,
        createdAt: new Date().toISOString()
      });
      
      // Notify assigned users about the new comment
      if (Array.isArray(editingTask.assignedTo)) {
        for (const userId of editingTask.assignedTo) {
          if (userId !== profile?.uid) {
            await addDoc(collection(db, 'notifications'), {
              userId,
              title: 'تعليق جديد',
              description: `${profile?.name} علق على المهمة: ${editingTask.title}`,
              type: 'task',
              read: false,
              link: '/tasks',
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      
      // Update comments count on task
      await updateDoc(doc(db, 'tasks', editingTask.id), {
        commentsCount: (editingTask.commentsCount || 0) + 1
      });
      
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'comments');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'tasks');
      }
    }
  };

  const toggleStatus = async (task: Task) => {
    const workflow: Task['status'][] = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = workflow.indexOf(task.status);
    const nextStatus = workflow[(currentIndex + 1) % workflow.length];
    
    try {
      await updateDoc(doc(db, 'tasks', task.id), { status: nextStatus });

      // Notify assigned users about status change
      if (Array.isArray(task.assignedTo)) {
        for (const userId of task.assignedTo) {
          if (userId !== profile?.uid) {
            await addDoc(collection(db, 'notifications'), {
              userId,
              title: 'تغيير حالة المهمة',
              description: `تم تغيير حالة المهمة "${task.title}" إلى: ${statusLabels[nextStatus]} بواسطة ${profile?.name}`,
              type: 'task',
              read: false,
              link: '/tasks',
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'tasks');
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      projectId: task.projectId,
      clientId: task.clientId || '',
      assignedTo: task.assignedTo || [],
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline || '',
      reminderAt: task.reminderAt || '',
      files: task.files || []
    });
    setIsModalOpen(true);
  };

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'مشروع غير معروف';
  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'عميل غير معروف';
  const getAssigneeNames = (uids: string[]) => {
    if (!Array.isArray(uids) || uids.length === 0) return 'غير معين';
    const names = uids.map(uid => team.find(u => u.uid === uid)?.name).filter(Boolean);
    if (names.length === 0) return 'غير معين';
    if (names.length <= 2) return names.join('، ');
    return `${names[0]} و ${names.length - 1} آخرين`;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = (task.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesClient = clientFilter === 'all' || task.clientId === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });


  const exportToCSV = () => {
    const headers = [
      "المهمة", 
      "المشروع", 
      "العميل", 
      "المعينين", 
      "الأولوية", 
      "الحالة", 
      "الموعد النهائي", 
      "تاريخ الإنشاء"
    ];
    
    const rows = filteredTasks.map(task => [
      task.title,
      getProjectName(task.projectId),
      getClientName(task.clientId || ''),
      (task.assignedTo || []).map(uid => team.find(u => u.uid === uid)?.name).filter(Boolean).join(' - '),
      priorityLabels[task.priority],
      statusLabels[task.status],
      task.deadline || 'بدون موعد',
      new Date(task.createdAt).toLocaleDateString('ar-EG')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">إدارة المهام</h2>
          <p className="text-gray-500 mt-1 font-medium">تعيين المهام، تتبع التقدم، والمواعيد النهائية</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-100 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={20} />
            <span>تصدير CSV</span>
          </button>
          <button 
            onClick={() => {
              setEditingTask(null);
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            <span>إضافة مهمة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن مهمة..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl font-bold text-sm bg-gray-50 text-gray-500 hover:bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="all">كل العملاء</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          {['all', 'todo', 'in_progress', 'review', 'done'].map((status) => (
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
              {status === 'all' ? 'الكل' : statusLabels[status as keyof typeof statusLabels]}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row sm:items-center gap-6">
              <button 
                onClick={() => toggleStatus(task)}
                className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                  task.status === 'done' ? "bg-emerald-500 text-white" : 
                  task.status === 'review' ? "bg-amber-500 text-white" :
                  task.status === 'in_progress' ? "bg-blue-500 text-white" :
                  "bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-400"
                )}
                title={`تغيير الحالة: ${statusLabels[task.status]}`}
              >
                {task.status === 'done' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className={clsx("text-lg font-black text-gray-900 truncate", task.status === 'done' && "line-through text-gray-400")}>
                    {task.title}
                  </h3>
                  <span className={clsx("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase", priorityColors[task.priority])}>
                    {priorityLabels[task.priority]}
                  </span>
                  <span className={clsx("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase", statusColors[task.status])}>
                    {statusLabels[task.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-gray-400">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <Briefcase size={14} />
                    {getProjectName(task.projectId)}
                  </span>
                  {task.clientId && (
                    <span className="flex items-center gap-1.5 text-purple-600">
                      <Users size={14} />
                      {getClientName(task.clientId)}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    {getAssigneeNames(task.assignedTo || [])}
                  </span>
                  {task.deadline && (
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <Calendar size={14} />
                      {task.deadline}
                    </span>
                  )}
                  {task.reminderAt && (
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <Clock size={14} />
                      {new Date(task.reminderAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {task.commentsCount && task.commentsCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <MessageSquare size={14} />
                      {task.commentsCount}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:border-r sm:pr-6 sm:mr-auto border-gray-50">
                <button onClick={() => openEditModal(task)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => handleDelete(task.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <CheckSquare size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد مهام</h3>
          <p className="text-gray-500 font-medium">ابدأ بتنظيم عملك وإضافة أول مهمة الآن</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTask ? 'تفاصيل المهمة' : 'إضافة مهمة جديدة'}
        maxWidth="4xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">عنوان المهمة</label>
              <input 
                required
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="مثال: تصميم شعار العميل"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">العميل</label>
                <select 
                  value={formData.clientId}
                  onChange={(e) => {
                    const newClientId = e.target.value;
                    setFormData({
                      ...formData, 
                      clientId: newClientId,
                      projectId: '' // Reset project when client changes
                    });
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="">اختر العميل...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">المشروع</label>
                <select 
                  required
                  value={formData.projectId}
                  onChange={(e) => {
                    const newProjectId = e.target.value;
                    const project = projects.find(p => p.id === newProjectId);
                    setFormData({
                      ...formData, 
                      projectId: newProjectId,
                      clientId: project ? project.clientId : formData.clientId
                    });
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="">اختر المشروع...</option>
                  {projects
                    .filter(p => !formData.clientId || p.clientId === formData.clientId)
                    .map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">تعيين إلى (يمكنك اختيار أكثر من عضو)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-3 bg-gray-50 rounded-2xl">
                {team.map(member => (
                  <label key={member.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-all cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.assignedTo.includes(member.uid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, assignedTo: [...formData.assignedTo, member.uid]});
                        } else {
                          setFormData({...formData, assignedTo: formData.assignedTo.filter(id => id !== member.uid)});
                        }
                      }}
                      className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-gray-700">{member.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الأولوية</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value as Task['priority']})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="low">منخفضة</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الحالة</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as Task['status']})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="todo">للتنفيذ</option>
                  <option value="in_progress">قيد العمل</option>
                  <option value="review">للمراجعة</option>
                  <option value="done">مكتملة</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الموعد النهائي</label>
                <input 
                  type="date" 
                  value={formData.deadline}
                  onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">تذكير في (اختياري)</label>
                <input 
                  type="datetime-local" 
                  value={formData.reminderAt}
                  onChange={(e) => setFormData({...formData, reminderAt: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">وصف المهمة</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[80px]"
                placeholder="تفاصيل إضافية عن المهمة..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">روابط الملفات</label>
              <div className="space-y-2">
                {formData.files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                    <Paperclip size={14} className="text-gray-400" />
                    <span className="text-xs font-medium truncate flex-1">{file}</span>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, files: formData.files.filter((_, i) => i !== index)})}
                      className="text-red-500 hover:bg-red-50 p-1 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="أضف رابط ملف..."
                    className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          setFormData({...formData, files: [...formData.files, val]});
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="submit"
                className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                {editingTask ? 'حفظ التعديلات' : 'إضافة المهمة'}
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

          {/* Comments Section */}
          <div className="border-t lg:border-t-0 lg:border-r border-gray-100 lg:pr-8 pt-8 lg:pt-0 flex flex-col h-full">
            <h4 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              التعليقات والمناقشة
            </h4>
            
            <div className="flex-1 space-y-4 mb-6 overflow-y-auto max-h-[400px]">
              {editingTask ? (
                comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-4 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600">
                          {comment.userName?.[0] || '?'}
                        </div>
                        <span className="text-xs font-black text-gray-900">{comment.userName}</span>
                        <span className="text-[10px] font-bold text-gray-400 mr-auto">
                          {new Date(comment.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed font-medium">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-gray-400 text-sm font-bold">لا يوجد تعليقات بعد</p>
                  </div>
                )
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-400 text-sm font-bold">احفظ المهمة أولاً لتتمكن من إضافة تعليقات</p>
                </div>
              )}
            </div>

            {editingTask && (
              <form onSubmit={handleAddComment} className="relative">
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="اكتب تعليقك هنا..."
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px] pr-12"
                />
                <button 
                  type="submit"
                  disabled={!newComment.trim()}
                  className="absolute bottom-3 left-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
