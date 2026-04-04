import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, Project } from '../types';
import { 
  File, 
  Search, 
  Download, 
  ExternalLink, 
  Image as ImageIcon, 
  FileText, 
  MoreVertical,
  Filter,
  FolderOpen
} from 'lucide-react';
import { clsx } from 'clsx';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle: string;
  createdAt: string;
}

export const MediaLibrary = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const allMedia: MediaItem[] = [];
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      
      tasks.forEach(task => {
        if (task.files && task.files.length > 0) {
          task.files.forEach((fileUrl, idx) => {
            const fileName = fileUrl.split('/').pop()?.split('?')[0] || `file-${idx}`;
            allMedia.push({
              id: `${task.id}-${idx}`,
              name: fileName,
              url: fileUrl,
              type: fileName.split('.').pop()?.toLowerCase() || 'unknown',
              taskId: task.id,
              taskTitle: task.title,
              projectId: task.projectId,
              projectTitle: '', // Will fill later
              createdAt: task.createdAt
            });
          });
        }
      });
      setMedia(allMedia);
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

  const getProjectTitle = (id: string) => projects.find(p => p.id === id)?.name || 'مشروع غير معروف';

  const filteredMedia = media.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.taskTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || 
                       (typeFilter === 'image' && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(item.type)) ||
                       (typeFilter === 'pdf' && item.type === 'pdf') ||
                       (typeFilter === 'other' && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(item.type));
    return matchesSearch && matchesType;
  });

  const getFileIcon = (type: string) => {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) return <ImageIcon size={24} className="text-blue-500" />;
    if (type === 'pdf') return <FileText size={24} className="text-rose-500" />;
    return <File size={24} className="text-gray-400" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">مكتبة الملفات المركزية</h2>
          <p className="text-gray-500 mt-1 font-medium">إدارة جميع الملفات والمرفقات المرفوعة في المهام والمشاريع</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl font-bold text-sm">
          <FolderOpen size={18} />
          <span>{media.length} ملف إجمالي</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن ملف أو مهمة..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'image', label: 'صور' },
            { id: 'pdf', label: 'PDF' },
            { id: 'other', label: 'أخرى' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setTypeFilter(type.id)}
              className={clsx(
                "px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap",
                typeFilter === type.id 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredMedia.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredMedia.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(item.type) ? (
                  <img 
                    src={item.url} 
                    alt={item.name} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {getFileIcon(item.type)}
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.type}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white text-gray-900 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                  >
                    <ExternalLink size={20} />
                  </a>
                  <button className="p-3 bg-white text-gray-900 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-lg">
                    <Download size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-bold text-gray-900 text-sm truncate mb-1" title={item.name}>{item.name}</h4>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-blue-500 truncate">
                    المهمة: {item.taskTitle}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 truncate">
                    المشروع: {getProjectTitle(item.projectId)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <File size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد ملفات</h3>
          <p className="text-gray-500 font-medium">الملفات التي يتم رفعها في المهام ستظهر هنا تلقائياً</p>
        </div>
      )}
    </div>
  );
};
