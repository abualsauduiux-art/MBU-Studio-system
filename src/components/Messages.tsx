import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  Send, 
  User,
  MoreVertical,
  Phone,
  Video,
  Plus,
  Users as UsersIcon,
  Check,
  CheckCheck,
  X
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
import Peer from 'simple-peer';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp;
}

interface Call {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  callerSignal?: string;
  receiverSignal?: string;
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

  // Call states
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callData = { 
          id: snapshot.docs[0].id, 
          ...snapshot.docs[0].data() 
        } as Call;
        // Only show if it's recent (within last 30 seconds)
        const now = Timestamp.now().toMillis();
        const callTime = callData.createdAt.toMillis();
        if (now - callTime < 30000) {
          setIncomingCall(callData);
          // Play ringtone
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
          audio.play().catch(() => {});
        }
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for call updates (for caller)
  useEffect(() => {
    if (!activeCall || activeCall.callerId !== user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', activeCall.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Call;
        if (data.status === 'accepted' && data.receiverSignal && !peerRef.current?.connected) {
          try {
            peerRef.current?.signal(JSON.parse(data.receiverSignal));
          } catch (e) {
            console.error("Signal error", e);
          }
        } else if (data.status === 'rejected' || data.status === 'ended') {
          cleanupCall();
        }
      }
    });

    return () => unsubscribe();
  }, [activeCall, user]);

  // Listen for call updates (for receiver)
  useEffect(() => {
    if (!activeCall || activeCall.receiverId !== user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', activeCall.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Call;
        if (data.status === 'ended') {
          cleanupCall();
        }
      }
    });

    return () => unsubscribe();
  }, [activeCall, user]);

  const cleanupCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedChatId || !user || !profile) return;
    const otherParticipantId = selectedChat?.participants.find(p => p !== user.uid);
    if (!otherParticipantId) return;

    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support media devices');
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video'
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // If video failed, try audio only as fallback if it was a video call
        if (type === 'video' && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
          console.warn("Camera not found, falling back to audio only");
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          // Update call type to audio if we fell back
          type = 'audio'; 
        } else {
          throw err;
        }
      }

      setLocalStream(stream);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream
      });

      peer.on('signal', async (data) => {
        const callPayload = {
          callerId: user.uid,
          callerName: profile.name,
          receiverId: otherParticipantId,
          type,
          status: 'ringing',
          callerSignal: JSON.stringify(data),
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'calls'), callPayload);
        setActiveCall({ 
          ...callPayload, 
          id: docRef.id, 
          createdAt: Timestamp.now(),
          status: 'ringing' 
        });
      });

      peer.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
      });

      peer.on('close', () => cleanupCall());
      peer.on('error', (err) => {
        console.error("Peer error", err);
        cleanupCall();
      });

      peerRef.current = peer;
    } catch (err: any) {
      console.error("Media error", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert("لم يتم العثور على الكاميرا أو الميكروفون. يرجى التأكد من توصيل الأجهزة.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert("تم رفض الوصول إلى الكاميرا أو الميكروفون. يرجى تفعيل الأذونات من إعدادات المتصفح.");
      } else {
        alert("حدث خطأ أثناء محاولة الوصول إلى الكاميرا أو الميكروفون.");
      }
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !user) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: incomingCall.type === 'video'
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (incomingCall.type === 'video' && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else {
          throw err;
        }
      }
      
      setLocalStream(stream);

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream
      });

      peer.on('signal', async (data) => {
        await updateDoc(doc(db, 'calls', incomingCall.id), {
          status: 'accepted',
          receiverSignal: JSON.stringify(data)
        });
        setActiveCall({ ...incomingCall, status: 'accepted' });
        setIncomingCall(null);
      });

      peer.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
      });

      peer.on('close', () => cleanupCall());
      peer.on('error', (err) => {
        console.error("Peer error", err);
        cleanupCall();
      });

      if (incomingCall.callerSignal) {
        peer.signal(JSON.parse(incomingCall.callerSignal));
      }
      
      peerRef.current = peer;
    } catch (err: any) {
      console.error("Media error", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert("لم يتم العثور على الكاميرا أو الميكروفون.");
      } else {
        alert("يرجى تفعيل الكاميرا والميكروفون للمتابعة");
      }
      cleanupCall();
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, 'calls', incomingCall.id), {
      status: 'rejected'
    });
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), {
      status: 'ended'
    });
    cleanupCall();
  };

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
            link: '/messages',
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
    <div className="h-[calc(100vh-160px)] flex gap-6">
      {/* Chat List */}
      <div className="w-80 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-gray-900">الرسائل</h2>
            <div className="flex items-center gap-2">
              {notificationPermission !== 'granted' && (
                <button 
                  onClick={requestNotificationPermission}
                  className="p-2 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all"
                  title="تفعيل الإشعارات"
                >
                  <Phone size={20} />
                </button>
              )}
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="البحث عن محادثة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
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
                  "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-right group",
                  selectedChatId === chat.id ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <div className="relative">
                  <img 
                    src={getChatAvatar(chat)} 
                    alt="" 
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  {chat.type === 'group' && (
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white">
                      <UsersIcon size={10} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-gray-900 truncate">{getChatName(chat)}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{formatTime(chat.lastMessageAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={clsx(
                      "text-xs truncate",
                      (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-gray-900 font-bold" : "text-gray-400 font-medium"
                    )}>
                      {chat.lastMessage}
                    </p>
                    {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
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
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        {selectedChatId ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src={getChatAvatar(selectedChat!)} 
                  alt="" 
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-black text-gray-900">{getChatName(selectedChat!)}</h3>
                  <p className="text-xs text-emerald-500 font-bold">
                    {selectedChat?.type === 'group' ? `${selectedChat.participants.length} عضو` : 'متصل الآن'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => startCall('audio')}
                  className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Phone size={20} />
                </button>
                <button 
                  onClick={() => startCall('video')}
                  className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Video size={20} />
                </button>
                <button className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={clsx(
                      "flex flex-col max-w-[70%]",
                      isMe ? "mr-auto items-end" : "ml-auto items-start"
                    )}
                  >
                    {!isMe && selectedChat?.type === 'group' && (
                      <span className="text-[10px] text-gray-400 font-bold mb-1 mr-2">{msg.senderName}</span>
                    )}
                    <div className={clsx(
                      "px-6 py-3 rounded-2xl text-sm font-medium shadow-sm",
                      isMe 
                        ? "bg-blue-600 text-white rounded-tl-none" 
                        : "bg-white text-gray-700 rounded-tr-none border border-gray-100"
                    )}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 mt-2 px-1">
                      <span className="text-[10px] text-gray-400 font-bold">{formatTime(msg.createdAt)}</span>
                      {isMe && (
                        <CheckCheck size={12} className="text-blue-400" />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 border-t border-gray-50">
              <form 
                onSubmit={handleSendMessage}
                className="flex items-center gap-4"
              >
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالتك هنا..." 
                    className="w-full pr-6 pl-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                  <button 
                    type="button"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={!messageText.trim()}
                  className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={24} className="rotate-180" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
              <MessageSquare size={48} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">محادثاتك</h3>
            <p className="text-gray-500 font-medium max-w-xs">اختر محادثة من القائمة الجانبية للبدء في التواصل مع فريقك</p>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
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

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <div className="bg-white w-full max-w-sm rounded-[40px] p-10 text-center shadow-2xl">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20" />
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName)}&background=random&size=128`} 
                  alt="" 
                  className="w-32 h-32 rounded-full mx-auto relative z-10 border-4 border-white shadow-xl"
                />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">{incomingCall.callerName}</h3>
              <p className="text-blue-600 font-bold mb-10 animate-pulse">
                {incomingCall.type === 'video' ? 'مكالمة فيديو واردة...' : 'مكالمة صوتية واردة...'}
              </p>
              <div className="flex justify-center gap-6">
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-200 hover:bg-red-600 transition-all"
                >
                  <X size={32} />
                </button>
                <button 
                  onClick={acceptCall}
                  className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all"
                >
                  {incomingCall.type === 'video' ? <Video size={32} /> : <Phone size={32} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {activeCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gray-900 flex flex-col"
          >
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              {activeCall.type === 'video' ? (
                <>
                  {remoteStream ? (
                    <video 
                      ref={el => { if (el) el.srcObject = remoteStream; }} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.callerId === user?.uid ? (selectedChat ? getChatName(selectedChat) : '...') : activeCall.callerName)}&background=random&size=200`} 
                        alt="" 
                        className="w-48 h-48 rounded-full mx-auto mb-6 border-4 border-white/20 shadow-2xl"
                      />
                      <p className="text-white/60 font-bold animate-pulse">جاري الاتصال...</p>
                    </div>
                  )}
                  
                  {/* Local Video Preview */}
                  <div className="absolute bottom-24 right-8 w-48 h-64 bg-black rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                    <video 
                      ref={el => { if (el) el.srcObject = localStream; }} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover mirror"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20" />
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.callerId === user?.uid ? (selectedChat ? getChatName(selectedChat) : '...') : activeCall.callerName)}&background=random&size=200`} 
                      alt="" 
                      className="w-48 h-48 rounded-full mx-auto relative z-10 border-4 border-white/20 shadow-2xl"
                    />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2">
                    {activeCall.callerId === user?.uid ? (selectedChat ? getChatName(selectedChat) : 'جاري الاتصال...') : activeCall.callerName}
                  </h3>
                  <p className="text-blue-400 font-bold">
                    {remoteStream ? 'مكالمة نشطة' : 'يرن...'}
                  </p>
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="h-32 bg-black/40 backdrop-blur-xl flex items-center justify-center gap-8 px-8">
              <button className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                <Phone size={24} className="opacity-60" />
              </button>
              <button 
                onClick={endCall}
                className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all transform hover:scale-110"
              >
                <X size={36} />
              </button>
              <button className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                <Video size={24} className="opacity-60" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
