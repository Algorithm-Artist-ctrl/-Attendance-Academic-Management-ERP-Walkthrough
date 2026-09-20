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
  Eye,
  Users,
  ShieldCheck,
  Megaphone,
  MessageCircle,
  Sparkles,
  Lock,
  Unlock,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { 
  Conversation, 
  ConversationStatus, 
  ConversationCategory, 
  Message,
  MessageGroup,
  GroupMessage 
} from '../../types/database.types';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { NewConversationModal } from '../../components/communication/NewConversationModal';
import { NewGroupMessageModal } from '../../components/communication/NewGroupMessageModal';
import { GroupMembersModal } from '../../components/communication/GroupMembersModal';

interface MessagesPageProps {
  initialConversationId?: string;
  initialGroupId?: string;
}

type TabType = 'GROUPS' | 'DIRECT';
type StatusFilter = 'ALL' | 'UNREAD' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const isImageAttachment = (url?: string | null, type?: string | null, name?: string | null): boolean => {
  if (!url) return false;
  if (type && type.toLowerCase().startsWith('image/')) return true;
  if (url.startsWith('data:image/')) return true;
  const lower = (name || url).toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.svg')
  );
};

export const MessagesPage: React.FC<MessagesPageProps> = ({ 
  initialConversationId,
  initialGroupId 
}) => {
  const { user } = useAuth();
  const { 
    conversations, 
    refreshConversations, 
    markConversationRead, 
    updateConversationStatus, 
    sendMessage,
    setActiveConversationId,
    messageGroups,
    refreshMessageGroups,
    activeGroupId,
    setActiveGroupId,
    sendGroupMessage,
    markGroupRead
  } = useAcademic();

  const role = user?.role;
  const isStudent = role === 'student';
  const isFacultyOrAdmin = role === 'faculty' || role === 'hod' || role === 'super_admin';

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<TabType>(
    initialGroupId ? 'GROUPS' : (initialConversationId ? 'DIRECT' : 'GROUPS')
  );

  // Modal states
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isNewDirectModalOpen, setIsNewDirectModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Group selection & state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || activeGroupId || null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);
  const [groupInputMessage, setGroupInputMessage] = useState('');
  const [groupInputTitle, setGroupInputTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [groupSending, setGroupSending] = useState(false);
  const [groupSendSuccess, setGroupSendSuccess] = useState(false);
  const [groupAttachment, setGroupAttachment] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  // Filters for Groups
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [unreadOnlyGroups, setUnreadOnlyGroups] = useState(false);

  // Direct conversation state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const [directMessages, setDirectMessages] = useState<Message[]>([]);
  const [loadingDirectMessages, setLoadingDirectMessages] = useState(false);
  const [directSearchQuery, setDirectSearchQuery] = useState('');
  const [directStatusFilter, setDirectStatusFilter] = useState<StatusFilter>('ALL');
  const [directCategoryFilter, setDirectCategoryFilter] = useState<string>('ALL');
  const [directInputMessage, setDirectInputMessage] = useState('');
  const [directSending, setDirectSending] = useState(false);
  const [directSendSuccess, setDirectSendSuccess] = useState(false);
  const [directAttachment, setDirectAttachment] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [messageSendError, setMessageSendError] = useState<string | null>(null);

  // Mobile layout state
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  // Deep linking effects for external navigation or notification clicks
  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
      setActiveTab('GROUPS');
      setMobileThreadOpen(true);
    }
  }, [initialGroupId]);

  useEffect(() => {
    if (activeGroupId && activeGroupId !== selectedGroupId) {
      setSelectedGroupId(activeGroupId);
      setActiveTab('GROUPS');
      setMobileThreadOpen(true);
    }
  }, [activeGroupId, selectedGroupId]);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
      setActiveTab('DIRECT');
      setMobileThreadOpen(true);
    }
  }, [initialConversationId]);

  // Sync activeGroupId with AcademicContext to suppress notification toasts for current thread
  useEffect(() => {
    setActiveGroupId(selectedGroupId);
    return () => {
      setActiveGroupId(null);
    };
  }, [selectedGroupId, setActiveGroupId]);

  // Sync activeConversationId with AcademicContext
  useEffect(() => {
    setActiveConversationId(selectedConvId);
    return () => {
      setActiveConversationId(null);
    };
  }, [selectedConvId, setActiveConversationId]);

  // Auto-select first group if none selected
  useEffect(() => {
    if (activeTab === 'GROUPS' && !selectedGroupId && messageGroups.length > 0) {
      setSelectedGroupId(messageGroups[0].id);
    }
  }, [activeTab, selectedGroupId, messageGroups]);

  // Load group messages when selectedGroupId changes (with Scoped Realtime)
  useEffect(() => {
    if (!selectedGroupId) {
      setGroupMessages([]);
      return;
    }

    let isMounted = true;
    const loadGroupMessages = async () => {
      setLoadingGroupMessages(true);
      try {
        const msgs = await supabaseService.fetchGroupMessages(selectedGroupId);
        if (isMounted) {
          setGroupMessages(msgs);
          markGroupRead(selectedGroupId);
        }
      } catch (err) {
        console.error('Error loading group messages:', err);
      } finally {
        if (isMounted) {
          setLoadingGroupMessages(false);
        }
      }
    };

    loadGroupMessages();

    // Scoped Realtime channel for currently active group thread
    const channel = supabase
      .channel(`active_group_${selectedGroupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${selectedGroupId}` },
        async (payload) => {
          if (!isMounted) return;
          const newMsg = payload.new as GroupMessage;
          if (newMsg && newMsg.id) {
            setGroupMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            markGroupRead(selectedGroupId);
          } else {
            const freshMsgs = await supabaseService.fetchGroupMessages(selectedGroupId);
            if (isMounted) {
              setGroupMessages(freshMsgs);
              markGroupRead(selectedGroupId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedGroupId, markGroupRead]);

  // Auto-scroll on new group messages
  useEffect(() => {
    if (activeTab === 'GROUPS') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages, activeTab]);

  // Load direct messages when selectedConvId changes (with Scoped Realtime)
  useEffect(() => {
    if (!selectedConvId) {
      setDirectMessages([]);
      return;
    }

    let isMounted = true;
    const loadDirect = async () => {
      setLoadingDirectMessages(true);
      try {
        const msgs = await supabaseService.fetchConversationMessages(selectedConvId);
        if (isMounted) {
          setDirectMessages(msgs);
          markConversationRead(selectedConvId);
        }
      } catch (err) {
        console.error('Error loading direct messages:', err);
      } finally {
        if (isMounted) {
          setLoadingDirectMessages(false);
        }
      }
    };

    loadDirect();

    // Scoped Realtime channel for currently active direct conversation thread
    const channel = supabase
      .channel(`active_direct_${selectedConvId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConvId}` },
        async (payload) => {
          if (!isMounted) return;
          const newMsg = payload.new as Message;
          if (newMsg && newMsg.id) {
            setDirectMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            markConversationRead(selectedConvId);
          } else {
            const freshMsgs = await supabaseService.fetchConversationMessages(selectedConvId);
            if (isMounted) {
              setDirectMessages(freshMsgs);
              markConversationRead(selectedConvId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, markConversationRead]);

  // Auto-scroll on direct messages
  useEffect(() => {
    if (activeTab === 'DIRECT') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [directMessages, activeTab]);

  // Selected Group Object
  const selectedGroup = useMemo(() => {
    return messageGroups.find(g => g.id === selectedGroupId) || null;
  }, [messageGroups, selectedGroupId]);

  // Selected Direct Conversation Object
  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return messageGroups.filter(g => {
      const q = groupSearchQuery.toLowerCase();
      const matchSearch = 
        !q ||
        g.subject?.subject_name.toLowerCase().includes(q) ||
        g.subject?.subject_code.toLowerCase().includes(q) ||
        g.section?.name.toLowerCase().includes(q) ||
        g.academic_year?.name.toLowerCase().includes(q) ||
        g.faculty?.full_name.toLowerCase().includes(q) ||
        (g.last_message_preview && g.last_message_preview.toLowerCase().includes(q));

      const matchYear = 
        selectedYearFilter === 'ALL' || 
        g.academic_year?.id === selectedYearFilter ||
        String(g.academic_year?.year_number) === selectedYearFilter;

      const matchUnread = !unreadOnlyGroups || (g.unread_count && g.unread_count > 0);

      return matchSearch && matchYear && matchUnread;
    });
  }, [messageGroups, groupSearchQuery, selectedYearFilter, unreadOnlyGroups]);

  // Filtered Direct Conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const q = directSearchQuery.toLowerCase();
      const otherPersonName = isStudent ? c.faculty?.full_name : c.student?.full_name;
      const matchSearch = 
        !q || 
        (otherPersonName && otherPersonName.toLowerCase().includes(q)) ||
        c.subject?.subject_name.toLowerCase().includes(q) ||
        (c.student?.roll_number && c.student.roll_number.toLowerCase().includes(q)) ||
        (c.subject_topic && c.subject_topic.toLowerCase().includes(q));

      const matchStatus = 
        directStatusFilter === 'ALL' || 
        (directStatusFilter === 'UNREAD' ? (c.unread_count && c.unread_count > 0) : c.status === directStatusFilter);

      const matchCategory = directCategoryFilter === 'ALL' || c.category === directCategoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [conversations, directSearchQuery, directStatusFilter, directCategoryFilter, isStudent]);

  // Total Unread Counters
  const totalGroupUnread = useMemo(() => {
    return messageGroups.reduce((acc, g) => acc + (g.unread_count || 0), 0);
  }, [messageGroups]);

  const totalDirectUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  // Handle Send Group Message
  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !groupInputMessage.trim() || groupSending) return;

    setGroupSending(true);
    setMessageSendError(null);
    try {
      const res = await sendGroupMessage({
        academicYearId: selectedGroup.academic_year_id,
        sectionId: selectedGroup.section_id,
        subjectId: selectedGroup.subject_id || undefined,
        message: groupInputMessage.trim(),
        title: groupInputTitle.trim() || undefined,
        attachmentUrl: groupAttachment?.dataUrl,
        attachmentName: groupAttachment?.file.name,
        attachmentType: groupAttachment?.file.type,
        attachmentSize: groupAttachment?.file.size,
      });

      if (res.success) {
        setGroupInputMessage('');
        setGroupInputTitle('');
        setShowTitleInput(false);
        setGroupAttachment(null);
        setMessageSendError(null);
        setGroupSendSuccess(true);
        setTimeout(() => setGroupSendSuccess(false), 1200);
        // Refresh local group messages
        const updatedMsgs = await supabaseService.fetchGroupMessages(selectedGroup.id);
        setGroupMessages(updatedMsgs);
      } else {
        setMessageSendError(res.error?.message || 'Failed to send group message. Please check connection and retry.');
      }
    } catch (err: any) {
      setMessageSendError(err.message || 'Error sending message. Your text has been preserved.');
    } finally {
      setGroupSending(false);
    }
  };

  // Handle Send Direct Message
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !directInputMessage.trim() || directSending) return;

    setDirectSending(true);
    setMessageSendError(null);
    try {
      const res = await sendMessage({
        conversationId: selectedConvId,
        message: directInputMessage.trim(),
        attachmentUrl: directAttachment?.dataUrl,
        attachmentName: directAttachment?.file.name,
        attachmentType: directAttachment?.file.type,
        attachmentSize: directAttachment?.file.size,
      });

      if (!res.error) {
        setDirectInputMessage('');
        setDirectAttachment(null);
        setMessageSendError(null);
        setDirectSendSuccess(true);
        setTimeout(() => setDirectSendSuccess(false), 1200);
        const updated = await supabaseService.fetchConversationMessages(selectedConvId);
        setDirectMessages(updated);
      } else {
        setMessageSendError(res.error?.message || 'Failed to send direct message. Please check connection and retry.');
      }
    } catch (err: any) {
      setMessageSendError(err.message || 'Error sending message. Your text has been preserved.');
    } finally {
      setDirectSending(false);
    }
  };

  // Handle Direct Attachment
  const handleDirectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDirectAttachment({ file, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Handle Group Attachment
  const handleGroupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setGroupAttachment({ file, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto p-2 sm:p-4 gap-3">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Communication Center</h1>
            <p className="text-xs text-slate-500">
              Official Class/Subject Groups & Direct Academic Conversations
            </p>
          </div>
        </div>

        {/* Top Action Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex items-center gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('GROUPS');
                setMobileThreadOpen(false);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'GROUPS'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Class Groups</span>
              {totalGroupUnread > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#0f172a] text-white rounded-full">
                  {totalGroupUnread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('DIRECT');
                setMobileThreadOpen(false);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'DIRECT'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Direct Messages</span>
              {totalDirectUnread > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#0f172a] text-white rounded-full">
                  {totalDirectUnread}
                </span>
              )}
            </button>
          </div>

          {/* New Message / Announcement Button */}
          {activeTab === 'GROUPS' && isFacultyOrAdmin && (
            <button
              type="button"
              onClick={() => setIsNewGroupModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-black rounded-xl shadow-xs flex items-center gap-1.5 transition-all shrink-0 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Group Announcement</span>
              <span className="sm:hidden">New</span>
            </button>
          )}

          {activeTab === 'DIRECT' && (
            <button
              type="button"
              onClick={() => setIsNewDirectModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-black rounded-xl shadow-xs flex items-center gap-1.5 transition-all shrink-0 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Direct Message</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Groups or Direct Conversations List */}
        {/* ========================================================================= */}
        <div className={`md:col-span-4 border-r border-slate-200 flex flex-col min-h-0 bg-slate-50/50 ${
          mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Filter / Search Bar */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={activeTab === 'GROUPS' ? 'Search subject, year, section...' : 'Search student or faculty...'}
                value={activeTab === 'GROUPS' ? groupSearchQuery : directSearchQuery}
                onChange={(e) => {
                  if (activeTab === 'GROUPS') setGroupSearchQuery(e.target.value);
                  else setDirectSearchQuery(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-xs font-medium"
              />
            </div>

            {/* Sub-filters for Groups */}
            {activeTab === 'GROUPS' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnlyGroups(!unreadOnlyGroups)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1 ${
                    unreadOnlyGroups
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Unread Only</span>
                  {unreadOnlyGroups && <Check className="w-3 h-3 text-white" />}
                </button>
              </div>
            ) : (
              /* Sub-filters for Direct Messages */
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {(['ALL', 'UNREAD', 'OPEN', 'RESOLVED'] as StatusFilter[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDirectStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      directStatusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'UNREAD' ? 'Unread' : st === 'OPEN' ? 'Open' : 'Resolved'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0 bg-white">
            {activeTab === 'GROUPS' ? (
              /* GROUPS LIST */
              filteredGroups.length === 0 ? (
                <div className="py-16 px-4 text-center text-xs text-[#475569] space-y-2">
                  <Users className="w-8 h-8 text-[#475569] mx-auto opacity-70" />
                  <p className="font-bold text-sm text-[#0f172a]">No class groups found</p>
                  <p className="text-[#475569] max-w-xs mx-auto font-medium">
                    {groupSearchQuery 
                      ? 'No groups match your search query.' 
                      : 'You will see class groups for subjects and sections assigned to you.'}
                  </p>
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = group.id === selectedGroupId;
                  const hasUnread = (group.unread_count || 0) > 0;
                  return (
                    <div
                      key={group.id}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setMobileThreadOpen(true);
                        markGroupRead(group.id);
                      }}
                      className={`p-3.5 px-4 cursor-pointer transition-all flex items-start gap-3 border-l-4 ${
                        isSelected 
                          ? 'bg-slate-100/90 border-[#0f172a]' 
                          : 'border-transparent hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a] shrink-0 font-bold text-xs shadow-xs">
                        {group.section?.name || 'G'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-[#0f172a] truncate">
                            {group.subject?.subject_name || 'Class Announcement'}
                          </h4>
                          {group.last_message_at && (
                            <span className="text-[10px] text-[#475569] shrink-0 font-mono font-medium">
                              {new Date(group.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#334155] font-semibold truncate mb-0.5">
                          {group.academic_year?.name || `${group.academic_year?.year_number || '1'} Year`} • Section {group.section?.name || 'A'}
                        </p>
                        <p className="text-[11px] text-[#475569] font-medium truncate mb-1">
                          Faculty: {group.faculty?.full_name || 'Assigned Instructor'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#475569] font-medium truncate max-w-[150px]">
                            {group.last_message_preview || 'No messages yet'}
                          </span>
                          {hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* DIRECT CONVERSATIONS LIST */
              filteredConversations.length === 0 ? (
                <div className="py-16 px-4 text-center text-xs text-[#475569] space-y-2">
                  <MessageCircle className="w-8 h-8 text-[#475569] mx-auto opacity-70" />
                  <p className="font-bold text-sm text-[#0f172a]">No direct messages found</p>
                  <p className="text-[#475569] max-w-xs mx-auto font-medium">
                    Start a private discussion with an authorized student or faculty member.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === selectedConvId;
                  const hasUnread = (conv.unread_count || 0) > 0;
                  const otherPerson = isStudent ? conv.faculty : conv.student;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setSelectedConvId(conv.id);
                        setMobileThreadOpen(true);
                      }}
                      className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? 'bg-slate-50 border-slate-900'
                          : hasUnread
                          ? 'bg-emerald-50/40 border-emerald-500 hover:bg-emerald-50/70'
                          : 'bg-white border-transparent hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-xs truncate ${isSelected || hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                            {otherPerson?.full_name || 'User'}
                          </h3>

                          {!isStudent && conv.student?.roll_number && (
                            <p className="text-[10px] font-mono text-slate-500">
                              Roll: {conv.student.roll_number}
                            </p>
                          )}

                          <p className="text-[11px] font-semibold text-slate-600 mt-0.5 truncate">
                            {conv.subject?.subject_name}
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            conv.status === 'OPEN' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                            conv.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                            conv.status === 'RESOLVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                            'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            {conv.status}
                          </span>

                          {hasUnread && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#0f172a] text-white rounded-full shadow-xs">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      {conv.last_message_preview && (
                        <p className={`text-[11px] mt-1.5 line-clamp-1 ${hasUnread ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Active Thread (Group or Direct) */}
        {/* ========================================================================= */}
        <div className={`md:col-span-8 flex flex-col min-h-0 bg-slate-50/30 ${
          !mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {activeTab === 'GROUPS' ? (
            /* GROUP THREAD VIEW */
            !selectedGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#475569]">
                <Users className="w-12 h-12 text-[#475569] mb-3 opacity-60" />
                <h3 className="text-base font-bold text-[#0f172a]">No Class Group Selected</h3>
                <p className="text-sm text-[#475569] mt-1 max-w-sm font-medium">
                  Select an academic class group from the left panel to inspect messages, announcements, and student rosters.
                </p>
              </div>
            ) : (
              <>
                {/* Group Header */}
                <div className="p-3.5 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="md:hidden p-1.5 -ml-1 text-[#334155] hover:text-[#0f172a] rounded-lg hover:bg-slate-100"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-[#0f172a] flex items-center justify-center shrink-0 font-bold text-sm">
                      <GraduationCap className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-[#0f172a] truncate">
                          {selectedGroup.subject?.subject_name || 'Class Announcement'}
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 border border-slate-300 text-[#0f172a] rounded-full shrink-0">
                          {selectedGroup.academic_year?.name || `${selectedGroup.academic_year?.year_number || '1'} Year`} • Sec {selectedGroup.section?.name}
                        </span>
                      </div>

                      <p className="text-xs text-[#475569] truncate mt-0.5 font-medium">
                        Faculty: <span className="font-bold text-[#0f172a]">{selectedGroup.faculty?.full_name || 'Assigned Instructor'}</span>
                        {selectedGroup.section?.room_number && ` • Room ${selectedGroup.section.room_number}`}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {loadingGroupMessages && (
                      <div className="flex items-center gap-1 text-[11px] text-[#475569] animate-pulse mr-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    )}
                    <span className="hidden sm:inline px-2.5 py-1 text-xs font-bold bg-slate-100 border border-slate-300 text-[#0f172a] rounded-lg">
                      {selectedGroup.members_count || 0} Members
                    </span>
                  </div>
                </div>

                {/* Announcement-only Policy Banner if student */}
                {isStudent && !selectedGroup.allow_student_replies && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-bold">
                    <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Official Announcements Only — Student replies are disabled for this group.</span>
                  </div>
                )}

                {/* Group Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#f8fafc]">
                  {loadingGroupMessages && groupMessages.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#475569] animate-spin" />
                      <span className="text-xs text-[#475569] font-medium">Loading group communication thread...</span>
                    </div>
                  ) : groupMessages.length === 0 ? (
                    <div className="py-20 text-center text-xs text-[#475569] space-y-2">
                      <Megaphone className="w-8 h-8 text-[#475569] mx-auto opacity-70" />
                      <p className="font-bold text-sm text-[#0f172a]">No announcements yet</p>
                      <p className="max-w-xs mx-auto text-[#475569] font-medium">
                        {isFacultyOrAdmin 
                          ? 'Send an announcement to broadcast it to all enrolled students in this class.' 
                          : 'Announcements posted by your faculty will appear here.'}
                      </p>
                    </div>
                  ) : (
                    groupMessages.map((msg) => {
                      const isMe = msg.sender_user_id === user?.id;
                      const isFacultySender = msg.sender_role === 'faculty' || msg.sender_role === 'hod';

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-2 mb-1 px-1 text-[11px]">
                            <span className="font-bold text-[#0f172a]">{msg.sender_name}</span>
                            <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md border ${
                              isFacultySender 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                                : 'bg-slate-100 border-slate-300 text-[#0f172a]'
                            }`}>
                              {msg.sender_role.toUpperCase()}
                            </span>
                            <span className="text-[#475569] text-[11px] font-mono font-medium">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className={`max-w-[85%] sm:max-w-xl p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#0f172a] text-white font-normal rounded-tr-none'
                              : isFacultySender
                              ? 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-none'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                          }`}>
                            {msg.title && (
                              <h4 className={`text-xs font-bold mb-1.5 pb-1 border-b ${
                                isMe ? 'border-slate-700 text-white' : 'border-slate-100 text-slate-900'
                              }`}>
                                {msg.title}
                              </h4>
                            )}

                            <p className="whitespace-pre-wrap">{msg.message}</p>

                            {msg.attachment_url && (() => {
                              const isImg = isImageAttachment(msg.attachment_url, msg.attachment_type, msg.attachment_name);
                              return (
                                <div className="mt-2.5 space-y-1.5">
                                  {isImg && (
                                    <div
                                      onClick={() => setPreviewImageUrl(msg.attachment_url || null)}
                                      className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 max-w-sm hover:opacity-95 transition-opacity bg-slate-100 group relative"
                                    >
                                      <img
                                        src={msg.attachment_url}
                                        alt={msg.attachment_name || 'Attachment'}
                                        className="w-full max-h-60 object-cover object-center rounded-xl"
                                      />
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                        <span className="px-2.5 py-1 bg-white/95 text-slate-900 rounded-lg text-[11px] flex items-center gap-1 font-semibold shadow-md">
                                          <Eye className="w-3.5 h-3.5 text-slate-700" /> View Image
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <div className={`p-2 rounded-xl flex items-center justify-between gap-2 text-[11px] ${
                                    isMe ? 'bg-white/10 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800'
                                  }`}>
                                    <div className="flex items-center gap-2 truncate">
                                      {isImg ? <ImageIcon className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                                      <span className="truncate">{msg.attachment_name || (isImg ? 'Image attachment' : 'Attachment')}</span>
                                    </div>
                                    <a
                                      href={msg.attachment_url}
                                      download={msg.attachment_name || 'download'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 hover:bg-black/5 rounded transition-colors shrink-0"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Group Message Composer */}
                {(isFacultyOrAdmin || selectedGroup.allow_student_replies) ? (
                  <form onSubmit={handleSendGroupMessage} className="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
                    {/* Error Alert if send fails */}
                    {messageSendError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                        <span className="flex-1 font-medium">{messageSendError}</span>
                        <button
                          type="button"
                          onClick={() => setMessageSendError(null)}
                          className="text-rose-600 hover:text-rose-900 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {/* Optional Title input for Faculty */}
                    {isFacultyOrAdmin && showTitleInput && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Announcement Title (Optional)..."
                          value={groupInputTitle}
                          onChange={(e) => setGroupInputTitle(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-medium shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowTitleInput(false);
                            setGroupInputTitle('');
                          }}
                          className="text-slate-400 hover:text-slate-700 text-xs p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Attachment preview */}
                    {groupAttachment && (
                      <div className="flex items-center gap-2 bg-slate-100 text-slate-800 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 w-fit">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                        <span className="truncate max-w-[200px] font-medium">{groupAttachment.file.name}</span>
                        <button
                          type="button"
                          onClick={() => setGroupAttachment(null)}
                          className="hover:text-rose-600 transition-colors ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleGroupFileChange}
                        className="hidden"
                      />

                      {/* Attachment trigger */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                        title="Add attachment"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* Optional title toggle for faculty */}
                      {isFacultyOrAdmin && !showTitleInput && (
                        <button
                          type="button"
                          onClick={() => setShowTitleInput(true)}
                          className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-semibold shrink-0 border border-slate-200"
                        >
                          + Title
                        </button>
                      )}

                      <input
                        type="text"
                        placeholder={
                          isFacultyOrAdmin
                            ? `Message all ${selectedGroup.members_count || 0} students in Section ${selectedGroup.section?.name}...`
                            : 'Reply to class discussion...'
                        }
                        value={groupInputMessage}
                        onChange={(e) => setGroupInputMessage(e.target.value)}
                        className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-xs"
                      />

                      <button
                        type="submit"
                        disabled={groupSending || !groupInputMessage.trim()}
                        className={`p-2 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center ${
                          groupSendSuccess
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[#0f172a] hover:bg-black text-white shadow-xs'
                        }`}
                        title={groupSendSuccess ? 'Sent!' : 'Send Message'}
                      >
                        {groupSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : groupSendSuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    Replies are disabled by faculty for this announcement channel.
                  </div>
                )}
              </>
            )
          ) : (
            /* DIRECT MESSAGE THREAD VIEW */
            !selectedConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#475569]">
                <MessageCircle className="w-12 h-12 text-[#475569] mb-3 opacity-60" />
                <h3 className="text-base font-bold text-[#0f172a]">No Direct Conversation Selected</h3>
                <p className="text-sm text-[#475569] mt-1 max-w-sm font-medium">
                  Select a private academic inquiry from the left panel to message directly.
                </p>
              </div>
            ) : (
              <>
                {/* Direct Header */}
                <div className="p-3.5 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {isStudent ? selectedConversation.faculty?.full_name : selectedConversation.student?.full_name}
                      </h2>
                      <p className="text-[11px] text-slate-500 truncate">
                        {selectedConversation.subject?.subject_name || 'Academic Discussion'} • Category: <span className="font-semibold text-slate-700">{selectedConversation.category}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    {loadingDirectMessages && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 animate-pulse mr-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="hidden sm:inline">Syncing...</span>
                      </div>
                    )}

                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                      selectedConversation.status === 'OPEN' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      selectedConversation.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                      selectedConversation.status === 'RESOLVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>

                {/* Direct Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-[#f8fafc]">
                  {loadingDirectMessages && directMessages.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                      <span className="text-xs text-slate-500 font-medium">Loading conversation...</span>
                    </div>
                  ) : directMessages.length === 0 ? (
                    <div className="py-20 text-center text-sm font-medium text-[#475569]">
                      No messages yet in this direct conversation.
                    </div>
                  ) : (
                    directMessages.map((m) => {
                      const isMe = m.sender_user_id === user?.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe 
                              ? 'bg-[#0f172a] text-white font-normal rounded-tr-none' 
                              : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            {m.attachment_url && (() => {
                              const isImg = isImageAttachment(m.attachment_url, m.attachment_type, m.attachment_name);
                              return (
                                <div className="mt-2 space-y-1.5">
                                  {isImg && (
                                    <div
                                      onClick={() => setPreviewImageUrl(m.attachment_url || null)}
                                      className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 max-w-xs hover:opacity-95 transition-opacity bg-slate-100 group relative"
                                    >
                                      <img
                                        src={m.attachment_url}
                                        alt={m.attachment_name || 'Attachment'}
                                        className="w-full max-h-52 object-cover object-center rounded-xl"
                                      />
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                        <span className="px-2.5 py-1 bg-white/95 text-slate-900 rounded-lg text-[10px] flex items-center gap-1 font-semibold shadow-md">
                                          <Eye className="w-3 h-3 text-slate-700" /> View Image
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <div className={`p-1.5 rounded flex items-center justify-between gap-2 text-[10px] ${
                                    isMe ? 'bg-white/10 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800'
                                  }`}>
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isImg ? <ImageIcon className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                                      <span className="truncate">{m.attachment_name || (isImg ? 'Image attachment' : 'Attachment')}</span>
                                    </div>
                                    <a href={m.attachment_url} target="_blank" rel="noreferrer" download className="p-1 hover:bg-black/5 rounded transition-colors shrink-0">
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <span className="text-[11px] text-[#475569] font-mono font-medium mt-1 px-1">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Direct Message Composer */}
                <form onSubmit={handleSendDirectMessage} className="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
                  {/* Error Alert if send fails */}
                  {messageSendError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <span className="flex-1 font-medium">{messageSendError}</span>
                      <button
                        type="button"
                        onClick={() => setMessageSendError(null)}
                        className="text-rose-600 hover:text-rose-900 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {directAttachment && (
                    <div className="flex items-center gap-2 bg-slate-100 text-slate-800 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 w-fit">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                      <span className="truncate max-w-[200px] font-medium">{directAttachment.file.name}</span>
                      <button type="button" onClick={() => setDirectAttachment(null)} className="ml-1 text-slate-400 hover:text-rose-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={directFileInputRef}
                      onChange={handleDirectFileChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => directFileInputRef.current?.click()}
                      className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                      title="Add attachment"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      placeholder="Type a direct message..."
                      value={directInputMessage}
                      onChange={(e) => setDirectInputMessage(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                    />

                    <button
                      type="submit"
                      disabled={directSending || !directInputMessage.trim()}
                      className={`p-2 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center ${
                        directSendSuccess
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[#0f172a] hover:bg-black text-white shadow-xs'
                      }`}
                      title={directSendSuccess ? 'Sent!' : 'Send Message'}
                    >
                      {directSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : directSendSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            )
          )}
        </div>
      </div>

      {/* Modals */}
      <NewGroupMessageModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onSuccess={(groupId) => {
          setSelectedGroupId(groupId);
          refreshMessageGroups();
        }}
      />

      <NewConversationModal
        isOpen={isNewDirectModalOpen}
        onClose={() => setIsNewDirectModalOpen(false)}
        onConversationCreated={(conv) => {
          setSelectedConvId(conv.id);
          setActiveTab('DIRECT');
          refreshConversations();
          setIsNewDirectModalOpen(false);
        }}
      />

      <GroupMembersModal
        groupId={selectedGroupId}
        groupTitle={selectedGroup ? `${selectedGroup.subject?.subject_name || 'Class Announcement'} (${selectedGroup.academic_year?.name || `${selectedGroup.academic_year?.year_number} Yr`} Sec ${selectedGroup.section?.name})` : 'Class Group'}
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
      />

      {/* Image Preview Lightbox Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-600" />
                Image Preview
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  download="image_attachment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center max-h-[80vh] bg-slate-100">
              <img
                src={previewImageUrl}
                alt="Enlarged attachment preview"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
