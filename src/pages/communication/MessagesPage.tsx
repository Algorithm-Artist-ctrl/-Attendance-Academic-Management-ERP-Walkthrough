import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Send, 
  Paperclip, 
  Check, 
  CheckCheck, 
  ArrowLeft, 
  Plus, 
  ChevronDown, 
  Clock, 
  Calendar, 
  GraduationCap, 
  User, 
  BookOpen, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  X, 
  AlertCircle,
  Loader2,
  Tag,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { 
  Conversation, 
  ConversationStatus, 
  ConversationCategory, 
  Message 
} from '../../types/database.types';
import { supabaseService } from '../../lib/services/supabaseService';
import { NewConversationModal } from '../../components/communication/NewConversationModal';

interface MessagesPageProps {
  initialConversationId?: string;
}

type StatusFilter = 'ALL' | 'UNREAD' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const MessagesPage: React.FC<MessagesPageProps> = ({ initialConversationId }) => {
  const { user } = useAuth();
  const { 
    conversations, 
    refreshConversations, 
    markConversationRead, 
    updateConversationStatus, 
    sendMessage,
    setActiveConversationId
  } = useAcademic();

  const role = user?.role;
  const isStudent = role === 'student';
  const isFacultyOrAdmin = role === 'faculty' || role === 'hod' || role === 'super_admin';

  // Selection & modal states
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Active conversation message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Composer state
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  // Status updating state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set active conversation in AcademicContext to suppress notification toasts for current thread
  useEffect(() => {
    setActiveConversationId(selectedConvId);
    return () => {
      setActiveConversationId(null);
    };
  }, [selectedConvId, setActiveConversationId]);

  // Sync initialConversationId prop if provided
  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
    }
  }, [initialConversationId]);

  // Load messages whenever selected conversation changes
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setMessagesError(null);
      try {
        const msgs = await supabaseService.fetchConversationMessages(selectedConvId);
        if (isMounted) {
          setMessages(msgs);
          // Mark conversation as read
          markConversationRead(selectedConvId);
        }
      } catch (err: any) {
        if (isMounted) {
          setMessagesError(err.message || 'Failed to load conversation messages');
        }
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [selectedConvId, markConversationRead]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMessages]);

  // Periodically refresh active conversation messages in case of incoming realtime event
  useEffect(() => {
    if (!selectedConvId) return;

    const interval = setInterval(async () => {
      const msgs = await supabaseService.fetchConversationMessages(selectedConvId);
      setMessages(msgs);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConvId]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const studentName = conv.student?.full_name?.toLowerCase() || '';
        const rollNum = conv.student?.roll_number?.toLowerCase() || '';
        const facultyName = conv.faculty?.full_name?.toLowerCase() || '';
        const subjectName = conv.subject?.subject_name?.toLowerCase() || '';
        const topic = conv.subject_topic?.toLowerCase() || '';
        const lastMsg = conv.last_message_preview?.toLowerCase() || '';

        const match = 
          studentName.includes(q) ||
          rollNum.includes(q) ||
          facultyName.includes(q) ||
          subjectName.includes(q) ||
          topic.includes(q) ||
          lastMsg.includes(q);

        if (!match) return false;
      }

      // Status filter
      if (statusFilter === 'UNREAD') {
        if (!conv.unread_count || conv.unread_count === 0) return false;
      } else if (statusFilter !== 'ALL') {
        if (conv.status !== statusFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        if (conv.category !== categoryFilter) return false;
      }

      return true;
    });
  }, [conversations, searchQuery, statusFilter, categoryFilter]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConvId || (!inputMessage.trim() && !attachment)) return;

    setSending(true);
    try {
      const res = await sendMessage({
        conversationId: selectedConvId,
        message: inputMessage.trim() || '(Attachment)',
        attachmentUrl: attachment?.dataUrl,
        attachmentName: attachment?.file.name,
        attachmentType: attachment?.file.type,
        attachmentSize: attachment?.file.size,
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to send message');
      }

      setInputMessage('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Immediately append message to thread
      if (res.data) {
        setMessages(prev => [...prev, res.data as Message]);
      }
    } catch (err: any) {
      alert(err.message || 'Error sending message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        file,
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleStatusChange = async (newStatus: ConversationStatus) => {
    if (!selectedConvId || updatingStatus) return;
    setUpdatingStatus(true);
    setStatusDropdownOpen(false);
    try {
      const res = await updateConversationStatus(selectedConvId, newStatus);
      if (res.error) {
        alert(res.error.message || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: ConversationStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            OPEN
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            IN PROGRESS
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-[#00ff88] border border-emerald-500/20">
            RESOLVED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            CLOSED
          </span>
        );
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatListDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden bg-[#0a0f18] text-white">
      {/* Top Banner / Header */}
      <div className="px-6 py-3.5 border-b border-white/10 bg-[#0e1726]/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88]">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">Communication Center</h1>
            <p className="text-[11px] text-slate-400">
              {isStudent 
                ? 'Two-way discussions with your assigned course faculty' 
                : 'Direct student inquiries and issue tracking for assigned classes'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#00ff88] text-black font-semibold text-xs tracking-wide shadow-lg shadow-[#00ff88]/20 hover:bg-[#00ff88]/90 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Discussion</span>
        </button>
      </div>

      {/* Main Container: Split-pane on desktop, full-width on mobile */}
      <div className="flex-1 flex overflow-hidden">
        {/* ==================================================== */}
        {/* LEFT PANE: CONVERSATION LIST */}
        {/* ==================================================== */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-white/10 bg-[#0e1726]/40 flex flex-col shrink-0 ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search & Filters Header */}
          <div className="p-3.5 border-b border-white/10 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher, student, subject..."
                className="w-full pl-9 pr-8 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              {(['ALL', 'UNREAD', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as StatusFilter[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 font-semibold'
                      : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {st === 'IN_PROGRESS' ? 'In Progress' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 text-slate-400">
                <MessageSquare className="w-10 h-10 text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-medium">No conversations found</p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Try clearing your filters or search term'
                    : 'Click "New Discussion" to send your first message'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const otherPartyName = isStudent
                  ? conv.faculty?.full_name || 'Faculty'
                  : conv.student?.full_name || 'Student';
                const hasUnread = (conv.unread_count || 0) > 0;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 cursor-pointer transition-colors relative ${
                      isSelected
                        ? 'bg-white/[0.08] border-l-2 border-[#00ff88]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00ff88]/20 to-blue-500/20 border border-white/10 flex items-center justify-center font-bold text-xs text-[#00ff88] shrink-0">
                          {otherPartyName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-xs font-semibold text-white truncate">
                              {otherPartyName}
                            </h3>
                            {hasUnread && (
                              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {conv.subject?.subject_name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                        <span className="text-[10px] text-slate-500">
                          {formatListDate(conv.last_message_at)}
                        </span>
                        {getStatusBadge(conv.status)}
                      </div>
                    </div>

                    {/* Topic / Preview */}
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <p className="text-slate-300 truncate pr-2">
                        {conv.subject_topic ? (
                          <span className="text-slate-400 font-medium">
                            [{conv.category}] {conv.subject_topic}:{' '}
                          </span>
                        ) : null}
                        {conv.last_message_preview || 'No messages yet'}
                      </p>

                      {hasUnread && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#00ff88] text-black font-bold text-[10px] shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT PANE: ACTIVE THREAD & COMPOSER */}
        {/* ==================================================== */}
        <div
          className={`flex-1 flex flex-col bg-[#0a0f18] ${
            !selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div className="px-6 py-3.5 border-b border-white/10 bg-[#0e1726]/80 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="md:hidden p-1.5 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center font-bold text-sm text-[#00ff88] shrink-0">
                    {isStudent
                      ? activeConversation.faculty?.full_name?.charAt(0) || 'F'
                      : activeConversation.student?.full_name?.charAt(0) || 'S'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-bold text-white truncate">
                        {isStudent
                          ? activeConversation.faculty?.full_name
                          : activeConversation.student?.full_name}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                        {activeConversation.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 flex items-center space-x-2">
                      <span className="truncate">{activeConversation.subject?.subject_name}</span>
                      <span>•</span>
                      <span>Sec {activeConversation.section?.name}</span>
                      {activeConversation.subject_topic && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300 font-medium truncate">
                            {activeConversation.subject_topic}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Status Dropdown / Pill */}
                <div className="relative shrink-0">
                  {isFacultyOrAdmin ? (
                    <div>
                      <button
                        onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                        disabled={updatingStatus}
                        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs font-medium cursor-pointer"
                      >
                        {updatingStatus ? (
                          <Loader2 className="w-3.5 h-3.5 text-[#00ff88] animate-spin" />
                        ) : (
                          getStatusBadge(activeConversation.status)
                        )}
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      {statusDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-44 bg-[#0e1726] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/5">
                            Update Issue Status
                          </div>
                          {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as ConversationStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => handleStatusChange(st)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between transition-colors"
                            >
                              <span>{st === 'IN_PROGRESS' ? 'In Progress' : st}</span>
                              {activeConversation.status === st && (
                                <Check className="w-3.5 h-3.5 text-[#00ff88]" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{getStatusBadge(activeConversation.status)}</div>
                  )}
                </div>
              </div>

              {/* Context Information Card for Faculty */}
              {!isStudent && activeConversation.student && (
                <div className="px-6 py-2.5 bg-[#0e1726]/30 border-b border-white/5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Roll No:</span>
                    <span className="font-semibold text-white">
                      {activeConversation.student.roll_number || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span>Admission:</span>
                    <span className="font-semibold text-white">
                      {activeConversation.student.admission_type || 'Regular'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span>Section:</span>
                    <span className="font-semibold text-white">
                      {activeConversation.section?.name || 'A'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span>Year:</span>
                    <span className="font-semibold text-white">
                      {activeConversation.academic_year?.name || 'Academic Year'}
                    </span>
                  </div>
                </div>
              )}

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-7 h-7 text-[#00ff88] animate-spin" />
                    <p className="text-xs text-slate-400">Loading messages...</p>
                  </div>
                ) : messagesError ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{messagesError}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center space-y-2 text-slate-500">
                    <MessageSquare className="w-10 h-10 text-slate-600 stroke-[1.5]" />
                    <p className="text-xs">No messages in this conversation yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwnMessage = msg.sender_user_id === user?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-md rounded-2xl p-4 space-y-2 ${
                            isOwnMessage
                              ? 'bg-[#00ff88]/10 border border-[#00ff88]/20 text-white rounded-tr-none'
                              : 'bg-white/[0.05] border border-white/10 text-white rounded-tl-none'
                          }`}
                        >
                          {/* Sender identity badge */}
                          <div className="flex items-center justify-between space-x-2 text-[10px] text-slate-400">
                            <span className="font-semibold uppercase tracking-wider text-slate-300">
                              {isOwnMessage ? 'You' : msg.sender_role}
                            </span>
                            <span>{formatMessageTime(msg.created_at)}</span>
                          </div>

                          {/* Message Body */}
                          <p className="text-xs leading-relaxed whitespace-pre-wrap select-text">
                            {msg.message}
                          </p>

                          {/* Attachment (if any) */}
                          {msg.attachment_url && (
                            <div className="pt-2 border-t border-white/10">
                              {msg.attachment_type?.startsWith('image/') ? (
                                <div className="space-y-1.5">
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_name || 'Attachment'}
                                    className="max-h-60 rounded-lg object-contain border border-white/10 bg-black/40"
                                  />
                                  <a
                                    href={msg.attachment_url}
                                    download={msg.attachment_name || 'image'}
                                    className="inline-flex items-center space-x-1.5 text-[11px] text-[#00ff88] hover:underline"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download Image</span>
                                  </a>
                                </div>
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  download={msg.attachment_name || 'document'}
                                  className="flex items-center space-x-2.5 p-2.5 bg-black/30 rounded-xl border border-white/10 hover:border-[#00ff88]/50 transition-colors"
                                >
                                  <FileText className="w-5 h-5 text-[#00ff88] shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-white truncate font-medium">
                                      {msg.attachment_name || 'Attachment Document'}
                                    </p>
                                    {msg.attachment_size && (
                                      <p className="text-[10px] text-slate-400">
                                        {(msg.attachment_size / 1024).toFixed(1)} KB
                                      </p>
                                    )}
                                  </div>
                                  <Download className="w-4 h-4 text-slate-400 hover:text-white shrink-0" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Read indicator */}
                          {isOwnMessage && (
                            <div className="flex items-center justify-end space-x-1 pt-1 text-[10px] text-slate-400">
                              {msg.read_at ? (
                                <>
                                  <span className="text-[#00ff88]">Read</span>
                                  <CheckCheck className="w-3.5 h-3.5 text-[#00ff88]" />
                                </>
                              ) : (
                                <>
                                  <span>Sent</span>
                                  <Check className="w-3.5 h-3.5 text-slate-400" />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-4 border-t border-white/10 bg-[#0e1726]/60 backdrop-blur-md">
                {/* Attachment Chip Preview */}
                {attachment && (
                  <div className="mb-2.5 inline-flex items-center space-x-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs">
                    <Paperclip className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-slate-200 truncate max-w-xs">{attachment.file.name}</span>
                    <button
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-red-400 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end space-x-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                    title="Attach file or screenshot"
                  >
                    <Paperclip className="w-4 h-4 text-[#00ff88]" />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                      rows={1}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors resize-none max-h-32"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending || (!inputMessage.trim() && !attachment)}
                    className="p-2.5 rounded-xl bg-[#00ff88] text-black font-semibold shadow-lg shadow-[#00ff88]/20 hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* No conversation selected empty state */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-[#00ff88]/5 border border-[#00ff88]/10 flex items-center justify-center text-[#00ff88]">
                <MessageSquare className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-semibold text-white">Select a Discussion</h3>
                <p className="text-xs text-slate-400">
                  Choose a conversation from the left pane or start a new discussion with your teacher or student.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#00ff88] text-black font-semibold text-xs tracking-wide shadow-lg shadow-[#00ff88]/20 hover:bg-[#00ff88]/90 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Discussion</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onConversationCreated={(newConv) => {
          setSelectedConvId(newConv.id);
          refreshConversations();
        }}
      />
    </div>
  );
};
