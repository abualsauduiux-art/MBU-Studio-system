import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  MessageSquare, 
  Send, 
  User,
  MoreVertical,
  Plus,
  Users as UsersIcon,
  Check,
  CheckCheck,
  X,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  getDocs,
  limit,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { clsx } from 'clsx';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp;
}

interface Chat {
  id: string;
  name: string;
  type: 'individual' | 'group';
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  avatar?: string;
  unreadCount?: Record<string, number>;
}

export const Messages = () => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdParam = searchParams.get('chatId');
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setNotificationPermission);
      }
    }
  }, []);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(setNotificationPermission);
    }
  };

  // Fetch all users for new chat
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData.filter(u => u.uid !== user?.uid));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'chats');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle chatId from query param
  useEffect(() => {
    if (chatIdParam && chats.length > 0) {
      const chat = chats.find(c => c.id === chatIdParam);
      if (chat) {
        setSelectedChatId(chat.id);
        // Clear the param
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('chatId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [chatIdParam, chats, searchParams, setSearchParams]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', selectedChatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      // Show notification for new message if not from me
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.senderId !== user?.uid && msgs.length > messages.length) {
        if (Notification.permission === "granted") {
          new Notification(`رسالة جديدة من ${lastMsg.senderName}`, {
            body: lastMsg.text,
            icon: "/favicon.ico"
          });
        }
      }

      setMessages(msgs);
      
      // Mark as read (reset unread count for me)
      const chatRef = doc(db, 'chats', selectedChatId);
      updateDoc(chatRef, {
        [`unreadCount.${user?.uid}`]: 0
      }).catch(() => {});

    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `chats/${selectedChatId}/messages`);
    });

    return () => unsubscribe();
  }, [selectedChatId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChatId || !user || !profile) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      const chatRef = doc(db, 'chats', selectedChatId);
      const messagesRef = collection(chatRef, 'messages');

      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: profile.name,
        text,
        createdAt: serverTimestamp()
      });

      // Update chat last message and unread counts
      const selectedChat = chats.find(c => c.id === selectedChatId);
      const newUnreadCount = { ...(selectedChat?.unreadCount || {}) };
      
      selectedChat?.participants.forEach(pId => {
        if (pId !== user.uid) {
          newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
        }
      });

      await updateDoc(chatRef, {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        unreadCount: newUnreadCount
      });

      // Notify other participants
      for (const pId of selectedChat?.participants || []) {
        if (pId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: pId,
            title: 'رسالة جديدة',
            description: `${profile.name}: ${text.length > 30 ? text.substring(0, 30) + '...' : text}`,
            type: 'message',
            read: false,
            link: `/messages?chatId=${selectedChatId}`,
            createdAt: new Date().toISOString()
          });
        }
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${selectedChatId}/messages`);
    }
  };

  const startIndividualChat = async (otherUser: UserProfile) => {
    if (!user || !profile) return;

    // Check if chat already exists
    const existingChat = chats.find(c => 
      c.type === 'individual' && 
      c.participants.includes(otherUser.uid)
    );

    if (existingChat) {
      setSelectedChatId(existingChat.id);
      setShowNewChatModal(false);
      return;
    }

    try {
      const chatData = {
        type: 'individual',
        participants: [user.uid, otherUser.uid],
        name: otherUser.name,
        lastMessage: 'بدأ المحادثة',
        lastMessageAt: serverTimestamp(),
        unreadCount: {
          [otherUser.uid]: 0,
          [user.uid]: 0
        }
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setSelectedChatId(docRef.id);
      setShowNewChatModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const startTeamChat = async () => {
    if (!user || !profile) return;

    // Check if team chat already exists
    const existingTeamChat = chats.find(c => c.type === 'group' && c.name === 'فريق الوكالة');
    if (existingTeamChat) {
      setSelectedChatId(existingTeamChat.id);
      setShowNewChatModal(false);
      return;
    }

    try {
      const allUserIds = [user.uid, ...users.map(u => u.uid)];
      const unreadCount: Record<string, number> = {};
      allUserIds.forEach(id => unreadCount[id] = 0);

      const chatData = {
        type: 'group',
        participants: allUserIds,
        name: 'فريق الوكالة',
        lastMessage: 'تم إنشاء مجموعة الفريق',
        lastMessageAt: serverTimestamp(),
        unreadCount
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setSelectedChatId(docRef.id);
      setShowNewChatModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'group') return chat.name;
    // For individual chats, find the other participant's name
    const otherParticipantId = chat.participants.find(p => p !== user?.uid);
    const otherUser = users.find(u => u.uid === otherParticipantId);
    return otherUser?.name || chat.name;
  };

  const getChatAvatar = (chat: Chat) => {
    const name = getChatName(chat);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  const formatTime = (timestamp?: Timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-4 lg:gap-6 relative overflow-hidden">
      {/* Chat List */}
      <div className={clsx(
        "w-full lg:w-80 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden transition-all duration-300",
        isMobile && selectedChatId ? "hidden" : "flex h-full"
      )}>
        <div className="p-4 sm:p-6 border-b border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">الرسائل</h2>
            <div className="flex items-center gap-2">
              {notificationPermission !== 'granted' && (
                <button 
                  onClick={requestNotificationPermission}
                  className="p-2 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all"
                  title="تفعيل الإشعارات"
                >
                  <Bell size={18} />
                </button>
              )}
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="البحث عن محادثة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : chats.length > 0 ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={clsx(
                  "w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl transition-all text-right group",
                  selectedChatId === chat.id ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={getChatAvatar(chat)} 
                    alt="" 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover"
                  />
                  {chat.type === 'group' && (
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-[8px] sm:text-[10px] text-white">
                      <UsersIcon size={8} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5 sm:mb-1">
                    <h3 className="font-bold text-gray-900 truncate text-sm sm:text-base">{getChatName(chat)}</h3>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium whitespace-nowrap">{formatTime(chat.lastMessageAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={clsx(
                      "text-[11px] sm:text-xs truncate",
                      (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-gray-900 font-bold" : "text-gray-400 font-medium"
                    )}>
                      {chat.lastMessage}
                    </p>
                    {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && (
                      <span className="bg-blue-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] sm:min-w-[18px] text-center">
                        {chat.unreadCount?.[user?.uid || '']}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-gray-400 font-medium">لا توجد محادثات بعد. ابدأ محادثة جديدة!</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={clsx(
        "flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden transition-all duration-300",
        isMobile && !selectedChatId ? "hidden" : "flex h-full"
      )}>
        {selectedChatId ? (
          <>
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                {isMobile && (
                  <button 
                    onClick={() => setSelectedChatId(null)}
                    className="p-2 -mr-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                )}
                <img 
                  src={getChatAvatar(selectedChat!)} 
                  alt="" 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover flex-shrink-0"
                />
                <div className="truncate">
                  <h3 className="font-black text-gray-900 truncate text-sm sm:text-base">{getChatName(selectedChat!)}</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-500 font-bold">
                    {selectedChat?.type === 'group' ? `${selectedChat.participants.length} عضو` : 'متصل الآن'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50/30">
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={clsx(
                      "flex flex-col max-w-[85%] sm:max-w-[70%]",
                      isMe ? "mr-auto items-end" : "ml-auto items-start"
                    )}
                  >
                    {!isMe && selectedChat?.type === 'group' && (
                      <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold mb-1 mr-2">{msg.senderName}</span>
                    )}
                    <div className={clsx(
                      "px-4 sm:px-6 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-medium shadow-sm",
                      isMe 
                        ? "bg-blue-600 text-white rounded-tl-none" 
                        : "bg-white text-gray-700 rounded-tr-none border border-gray-100"
                    )}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 mt-1 sm:mt-2 px-1">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">{formatTime(msg.createdAt)}</span>
                      {isMe && (
                        <CheckCheck size={10} className="text-blue-400" />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 sm:p-6 border-t border-gray-50">
              <form 
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 sm:gap-4"
              >
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالتك هنا..." 
                    className="w-full pr-4 sm:pr-6 pl-10 sm:pl-12 py-3 sm:py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                  />
                  <button 
                    type="button"
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={!messageText.trim()}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send size={20} className="rotate-180" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-10">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">محادثاتك</h3>
            <p className="text-sm text-gray-500 font-medium max-w-xs">اختر محادثة من القائمة الجانبية للبدء في التواصل مع فريقك</p>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="mt-6 bg-blue-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              بدء محادثة جديدة
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">بدء محادثة جديدة</h3>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <button 
                onClick={startTeamChat}
                className="w-full flex items-center gap-4 p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all text-right"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <UsersIcon size={24} />
                </div>
                <div>
                  <h4 className="font-black text-blue-900">مجموعة الفريق بالكامل</h4>
                  <p className="text-xs text-blue-600 font-bold">إرسال رسالة لجميع أعضاء الوكالة</p>
                </div>
              </button>

              <div className="pt-4">
                <p className="text-xs text-gray-400 font-black uppercase mb-4 px-2">أعضاء الفريق</p>
                <div className="space-y-2">
                  {users.map(u => (
                    <button 
                      key={u.uid}
                      onClick={() => startIndividualChat(u)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-all text-right"
                    >
                      <img 
                        src={u.photoURL || `https://ui-avatars.com/api/?name=${u.name}&background=random`} 
                        alt="" 
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <h4 className="font-bold text-gray-900">{u.name}</h4>
                        <p className="text-xs text-gray-400 font-medium">{u.jobTitle || 'موظف'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
