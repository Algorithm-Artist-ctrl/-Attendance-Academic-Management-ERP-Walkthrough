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
  Building2
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
import { NewConversationModal } from '../../components/communication/NewConversationModal';
import { NewGroupMessageModal } from '../../components/communication/NewGroupMessageModal';
import { GroupMembersModal } from '../../components/communication/GroupMembersModal';

interface MessagesPageProps {
  initialConversationId?: string;
  initialGroupId?: string;
}

type TabType = 'GROUPS' | 'DIRECT';
type StatusFilter = 'ALL' | 'UNREAD' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

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

  // Group selection & state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || activeGroupId || null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);
  const [groupInputMessage, setGroupInputMessage] = useState('');
  const [groupInputTitle, setGroupInputTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [groupSending, setGroupSending] = useState(false);
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

  // Load group messages when selectedGroupId changes
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
          // Mark group read
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

    return () => {
      isMounted = false;
    };
  }, [selectedGroupId, markGroupRead]);

  // Auto-scroll on new group messages
  useEffect(() => {
    if (activeTab === 'GROUPS') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages, activeTab]);

  // Load direct messages when selectedConvId changes
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

    return () => {
      isMounted = false;
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
        subjectId: selectedGroup.subject_id,
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
      <div className="glass-panel border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.2)]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Communication Center</h1>
            <p className="text-xs text-slate-400">
              Official Class/Subject Groups & Direct Academic Conversations
            </p>
          </div>
        </div>

        {/* Top Action Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-slate-950/80 border border-emerald-500/20 p-1 rounded-xl flex items-center gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('GROUPS');
                setMobileThreadOpen(false);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'GROUPS'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] shadow-sm'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Class Groups</span>
              {totalGroupUnread > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#00ff88] text-slate-950 rounded-full">
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
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] shadow-sm'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Direct Messages</span>
              {totalDirectUnread > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#00ff88] text-slate-950 rounded-full">
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
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-[#00ff88] hover:bg-[#00e67a] rounded-xl shadow-[0_0_15px_rgba(0,255,136,0.25)] flex items-center gap-1.5 transition-all shrink-0"
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
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-[#00ff88] hover:bg-[#00e67a] rounded-xl shadow-[0_0_15px_rgba(0,255,136,0.25)] flex items-center gap-1.5 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Direct Message</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 glass-panel border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Groups or Direct Conversations List */}
        {/* ========================================================================= */}
        <div className={`md:col-span-4 border-r border-emerald-500/15 flex flex-col min-h-0 bg-slate-950/60 ${
          mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Filter / Search Bar */}
          <div className="p-3 border-b border-emerald-500/15 bg-slate-950/80 space-y-2.5">
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
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/90 border border-emerald-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88] focus:border-[#00ff88] transition-all"
              />
            </div>

            {/* Sub-filters for Groups */}
            {activeTab === 'GROUPS' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnlyGroups(!unreadOnlyGroups)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                    unreadOnlyGroups
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88] font-semibold'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>Unread Only</span>
                  {unreadOnlyGroups && <Check className="w-3 h-3 text-[#00ff88]" />}
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
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      directStatusFilter === st
                        ? 'bg-[#00ff88] text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'UNREAD' ? 'Unread' : st === 'OPEN' ? 'Open' : 'Resolved'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-emerald-500/10 min-h-0">
            {activeTab === 'GROUPS' ? (
              /* GROUPS LIST */
              filteredGroups.length === 0 ? (
                <div className="py-16 px-4 text-center text-xs text-slate-400 space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-semibold text-slate-300">No class groups found</p>
                  <p className="text-slate-500 max-w-xs mx-auto">
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
                      }}
                      className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-[#00ff88]'
                          : hasUnread
                          ? 'bg-slate-900/80 border-emerald-400/70 hover:bg-slate-900'
                          : 'bg-transparent border-transparent hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className={`text-xs truncate ${isSelected || hasUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                              {group.subject?.subject_name || 'Academic Subject'}
                            </h3>
                          </div>

                          <p className="text-[11px] font-semibold text-[#00ff88] mt-0.5">
                            {group.academic_year?.year_number || '1'}th Year • Section {group.section?.name || 'A'}
                            {group.section?.room_number ? ` (Room ${group.section.room_number})` : ''}
                          </p>

                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            Faculty: {group.faculty?.full_name || 'Assigned Instructor'}
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          {group.last_message_at && (
                            <span className="text-[10px] text-slate-500">
                              {new Date(group.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-full">
                              {group.members_count || 0} Members
                            </span>

                            {hasUnread && (
                              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#00ff88] text-slate-950 rounded-full shadow-xs">
                                {group.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {group.last_message_preview && (
                        <p className={`text-[11px] mt-1.5 line-clamp-1 ${hasUnread ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
                          {group.last_message_preview}
                        </p>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              /* DIRECT CONVERSATIONS LIST */
              filteredConversations.length === 0 ? (
                <div className="py-16 px-4 text-center text-xs text-slate-400 space-y-2">
                  <MessageCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-semibold text-slate-300">No direct messages found</p>
                  <p className="text-slate-500 max-w-xs mx-auto">
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
                          ? 'bg-emerald-500/10 border-[#00ff88]'
                          : hasUnread
                          ? 'bg-slate-900/80 border-emerald-400/70 hover:bg-slate-900'
                          : 'bg-transparent border-transparent hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-xs truncate ${isSelected || hasUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                            {otherPerson?.full_name || 'User'}
                          </h3>

                          {!isStudent && conv.student?.roll_number && (
                            <p className="text-[10px] font-mono text-slate-400">
                              Roll: {conv.student.roll_number}
                            </p>
                          )}

                          <p className="text-[11px] font-semibold text-[#00ff88] mt-0.5 truncate">
                            {conv.subject?.subject_name}
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            conv.status === 'OPEN' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                            conv.status === 'IN_PROGRESS' ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' :
                            conv.status === 'RESOLVED' ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]' :
                            'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {conv.status}
                          </span>

                          {hasUnread && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#00ff88] text-slate-950 rounded-full shadow-xs">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      {conv.last_message_preview && (
                        <p className={`text-[11px] mt-1.5 line-clamp-1 ${hasUnread ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
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
        <div className={`md:col-span-8 flex flex-col min-h-0 bg-slate-950/40 ${
          !mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {activeTab === 'GROUPS' ? (
            /* GROUP THREAD VIEW */
            !selectedGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Users className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-300">No Class Group Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Select an academic class group from the left panel to inspect messages, announcements, and student rosters.
                </p>
              </div>
            ) : (
              <>
                {/* Group Header */}
                <div className="p-3.5 px-4 border-b border-emerald-500/15 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[#00ff88] flex items-center justify-center shrink-0 font-bold text-sm">
                      <GraduationCap className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white truncate">
                          {selectedGroup.subject?.subject_name}
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] rounded-full shrink-0">
                          {selectedGroup.academic_year?.year_number}th Year • Sec {selectedGroup.section?.name}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Faculty: <span className="font-medium text-slate-200">{selectedGroup.faculty?.full_name || 'Assigned Instructor'}</span>
                        {selectedGroup.section?.room_number && ` • Room ${selectedGroup.section.room_number}`}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsMembersModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/30 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-[#00ff88]" />
                      <span className="hidden sm:inline">View Members</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 border border-slate-700 text-[#00ff88] font-bold rounded-full shadow-xs">
                        {selectedGroup.members_count || 0}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Announcement-only Policy Banner if student */}
                {isStudent && !selectedGroup.allow_student_replies && (
                  <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/25 flex items-center gap-2 text-xs text-amber-300">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Official Announcements Only — Student replies are disabled for this group.</span>
                  </div>
                )}

                {/* Group Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#050b14]/70">
                  {loadingGroupMessages ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#00ff88] animate-spin" />
                      <span className="text-xs text-slate-400 font-medium">Loading group communication thread...</span>
                    </div>
                  ) : groupMessages.length === 0 ? (
                    <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                      <Megaphone className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-semibold text-slate-300">No announcements yet</p>
                      <p className="max-w-xs mx-auto text-slate-500">
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
                            <span className="font-bold text-slate-200">{msg.sender_name}</span>
                            <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md border ${
                              isFacultySender 
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]' 
                                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            }`}>
                              {msg.sender_role.toUpperCase()}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className={`max-w-[85%] sm:max-w-xl p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#00ff88] text-slate-950 font-medium rounded-tr-none shadow-[0_0_20px_rgba(0,255,136,0.15)]'
                              : isFacultySender
                              ? 'bg-slate-900/95 border border-emerald-500/30 text-slate-100 rounded-tl-none shadow-sm'
                              : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}>
                            {msg.title && (
                              <h4 className={`text-xs font-bold mb-1.5 pb-1 border-b ${
                                isMe ? 'border-emerald-700/30 text-slate-950' : 'border-emerald-500/20 text-[#00ff88]'
                              }`}>
                                {msg.title}
                              </h4>
                            )}

                            <p className="whitespace-pre-wrap">{msg.message}</p>

                            {msg.attachment_url && (
                              <div className={`mt-2.5 p-2 rounded-xl flex items-center justify-between gap-2 text-[11px] ${
                                isMe ? 'bg-black/15 text-slate-950 font-semibold' : 'bg-slate-950/80 border border-emerald-500/20 text-[#00ff88]'
                              }`}>
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{msg.attachment_name || 'Attachment'}</span>
                                </div>
                                <a
                                  href={msg.attachment_url}
                                  download={msg.attachment_name || 'download'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:bg-white/10 rounded transition-colors shrink-0"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Group Message Composer */}
                {(isFacultyOrAdmin || selectedGroup.allow_student_replies) ? (
                  <form onSubmit={handleSendGroupMessage} className="p-3 border-t border-emerald-500/15 bg-slate-950/80 space-y-2 shrink-0">
                    {/* Error Alert if send fails */}
                    {messageSendError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                        <span className="flex-1 font-medium">{messageSendError}</span>
                        <button
                          type="button"
                          onClick={() => setMessageSendError(null)}
                          className="text-rose-400 hover:text-white p-1"
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
                          className="w-full text-xs px-3 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88] font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowTitleInput(false);
                            setGroupInputTitle('');
                          }}
                          className="text-slate-400 hover:text-slate-200 text-xs p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Attachment preview */}
                    {groupAttachment && (
                      <div className="flex items-center gap-2 bg-emerald-500/15 text-[#00ff88] text-xs px-2.5 py-1.5 rounded-xl border border-emerald-500/30 w-fit">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[200px] font-medium">{groupAttachment.file.name}</span>
                        <button
                          type="button"
                          onClick={() => setGroupAttachment(null)}
                          className="hover:text-red-400 transition-colors ml-1"
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
                        className="p-2 text-slate-400 hover:text-[#00ff88] rounded-xl hover:bg-emerald-500/10 transition-colors"
                        title="Add attachment"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* Optional title toggle for faculty */}
                      {isFacultyOrAdmin && !showTitleInput && (
                        <button
                          type="button"
                          onClick={() => setShowTitleInput(true)}
                          className="px-2 py-1 text-[11px] text-slate-400 hover:text-[#00ff88] hover:bg-emerald-500/10 rounded-lg transition-colors font-medium shrink-0 border border-transparent hover:border-emerald-500/20"
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
                        className="flex-1 text-xs px-3 py-2 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-all"
                      />

                      <button
                        type="submit"
                        disabled={groupSending || !groupInputMessage.trim()}
                        className="p-2 bg-[#00ff88] hover:bg-[#00e67a] text-slate-950 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,136,0.25)] font-bold disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {groupSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 border-t border-emerald-500/10 bg-slate-950/80 text-center text-xs text-slate-400">
                    Replies are disabled by faculty for this announcement channel.
                  </div>
                )}
              </>
            )
          ) : (
            /* DIRECT MESSAGE THREAD VIEW */
            !selectedConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <MessageCircle className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-300">No Direct Conversation Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Select a private academic inquiry from the left panel to message directly.
                </p>
              </div>
            ) : (
              <>
                {/* Direct Header */}
                <div className="p-3.5 px-4 border-b border-emerald-500/15 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[#00ff88] flex items-center justify-center shrink-0 font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white truncate">
                        {isStudent ? selectedConversation.faculty?.full_name : selectedConversation.student?.full_name}
                      </h2>
                      <p className="text-[11px] text-slate-400 truncate">
                        {selectedConversation.subject?.subject_name} • Category: <span className="font-semibold text-slate-200">{selectedConversation.category}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                      selectedConversation.status === 'OPEN' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                      selectedConversation.status === 'IN_PROGRESS' ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' :
                      selectedConversation.status === 'RESOLVED' ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]' :
                      'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>

                {/* Direct Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-[#050b14]/70">
                  {loadingDirectMessages ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#00ff88] animate-spin" />
                      <span className="text-xs text-slate-400">Loading conversation...</span>
                    </div>
                  ) : directMessages.length === 0 ? (
                    <div className="py-20 text-center text-xs text-slate-500">
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
                          <div className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed ${
                            isMe 
                              ? 'bg-[#00ff88] text-slate-950 font-medium rounded-tr-none shadow-[0_0_20px_rgba(0,255,136,0.15)]' 
                              : 'bg-slate-900/90 border border-emerald-500/20 text-slate-100 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            {m.attachment_url && (
                              <div className={`mt-2 p-1.5 rounded flex items-center justify-between gap-2 text-[10px] ${
                                isMe ? 'bg-black/15 text-slate-950 font-semibold' : 'bg-slate-950/80 border border-emerald-500/20 text-[#00ff88]'
                              }`}>
                                <span className="truncate">{m.attachment_name || 'Attachment'}</span>
                                <a href={m.attachment_url} target="_blank" rel="noreferrer" download className="p-1 hover:bg-white/10 rounded transition-colors shrink-0">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 px-1">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Direct Message Composer */}
                <form onSubmit={handleSendDirectMessage} className="p-3 border-t border-emerald-500/15 bg-slate-950/80 space-y-2 shrink-0">
                  {/* Error Alert if send fails */}
                  {messageSendError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <span className="flex-1 font-medium">{messageSendError}</span>
                      <button
                        type="button"
                        onClick={() => setMessageSendError(null)}
                        className="text-rose-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {directAttachment && (
                    <div className="flex items-center gap-2 bg-emerald-500/15 text-[#00ff88] text-xs px-2.5 py-1.5 rounded-xl border border-emerald-500/30 w-fit">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[200px] font-medium">{directAttachment.file.name}</span>
                      <button type="button" onClick={() => setDirectAttachment(null)} className="ml-1 text-slate-400 hover:text-red-400">
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
                      className="p-2 text-slate-400 hover:text-[#00ff88] rounded-xl hover:bg-emerald-500/10 transition-colors"
                      title="Add attachment"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      placeholder="Type a direct message..."
                      value={directInputMessage}
                      onChange={(e) => setDirectInputMessage(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88]"
                    />

                    <button
                      type="submit"
                      disabled={directSending || !directInputMessage.trim()}
                      className="p-2 bg-[#00ff88] hover:bg-[#00e67a] text-slate-950 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,136,0.25)] font-bold disabled:opacity-50"
                    >
                      {directSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
        groupTitle={selectedGroup ? `${selectedGroup.subject?.subject_name} (${selectedGroup.academic_year?.year_number}th Yr Sec ${selectedGroup.section?.name})` : 'Class Group'}
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
      />
    </div>
  );
};
