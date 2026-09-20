import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ChevronUp,
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
  CheckCircle2,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  CornerUpLeft,
  Copy,
  Mail,
  Eraser
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
    markGroupRead,
    editDirectMessage,
    unsendDirectMessage,
    deleteMessageForMe,
    clearConversationForMe,
    markConversationUnread,
    students,
    faculty,
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

  // Migration 039 Premium messaging controls state
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [unsendModalMsg, setUnsendModalMsg] = useState<Message | null>(null);
  const [isUnsending, setIsUnsending] = useState(false);
  const [deleteForMeModalMsg, setDeleteForMeModalMsg] = useState<Message | null>(null);
  const [isDeletingForMe, setIsDeletingForMe] = useState(false);
  const [isClearConvModalOpen, setIsClearConvModalOpen] = useState(false);
  const [isClearingConv, setIsClearingConv] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Selected Direct Conversation Object
  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Institutional sender name resolution: resolves real names, avoiding generic placeholders
  const resolveSenderName = useCallback((
    msg?: {
      sender_user_id?: string;
      sender_role?: string;
      sender_name?: string;
      student_id?: string;
      faculty_id?: string;
      student?: { id?: string; full_name?: string; roll_number?: string } | null;
      faculty?: { id?: string; full_name?: string; faculty_code?: string } | null;
    } | null,
    isReplyingTarget = false
  ): string => {
    if (!msg) return isReplyingTarget ? 'yourself' : 'You';

    // 1. Current user
    if (msg.sender_user_id && user?.id && msg.sender_user_id === user.id) {
      return isReplyingTarget ? 'yourself' : 'You';
    }

    // 2. Explicit sender_name if not generic placeholder
    if (msg.sender_name && !/^(participant|user|member|unknown participant)$/i.test(msg.sender_name.trim())) {
      return msg.sender_name.trim();
    }

    // 3. Directly joined student or faculty relation
    if (msg.sender_role === 'student' && msg.student?.full_name) {
      return msg.student.full_name;
    }
    if ((msg.sender_role === 'faculty' || msg.sender_role === 'hod') && msg.faculty?.full_name) {
      return msg.faculty.full_name;
    }

    // 4. Selected active conversation details
    if (selectedConversation) {
      if (msg.sender_role === 'student' && selectedConversation.student?.full_name) {
        return selectedConversation.student.full_name;
      }
      if ((msg.sender_role === 'faculty' || msg.sender_role === 'hod') && selectedConversation.faculty?.full_name) {
        return selectedConversation.faculty.full_name;
      }
      if (msg.student_id && selectedConversation.student_id === msg.student_id && selectedConversation.student?.full_name) {
        return selectedConversation.student.full_name;
      }
      if (msg.faculty_id && selectedConversation.faculty_id === msg.faculty_id && selectedConversation.faculty?.full_name) {
        return selectedConversation.faculty.full_name;
      }
    }

    // 5. Lookup in academic directories
    if (msg.student_id && students && students.length > 0) {
      const st = students.find(s => s.id === msg.student_id);
      if (st?.full_name) return st.full_name;
    }
    if (msg.faculty_id && faculty && faculty.length > 0) {
      const fc = faculty.find(f => f.id === msg.faculty_id);
      if (fc?.full_name) return fc.full_name;
    }

    // 6. Institutional role fallback (NEVER 'Participant')
    if (msg.sender_role === 'super_admin') return 'Administrator';
    if (msg.sender_role === 'hod') return 'Head of Department';
    if (msg.sender_role === 'faculty') return 'Faculty Member';
    if (msg.sender_role === 'student') return 'Student';

    // 7. Conversation partner name fallback
    if (selectedConversation) {
      if (user?.role === 'student' && selectedConversation.faculty?.full_name) {
        return selectedConversation.faculty.full_name;
      }
      if (user?.role !== 'student' && selectedConversation.student?.full_name) {
        return selectedConversation.student.full_name;
      }
    }

    return '';
  }, [user?.id, user?.role, selectedConversation, students, faculty]);

  // In-conversation message search
  const [isSearchingConv, setIsSearchingConv] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);

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
            // If deleted for current user, ignore
            if (newMsg.deleted_by_users && user?.id && newMsg.deleted_by_users.includes(user.id)) {
              return;
            }
            setDirectMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              let replyObj = newMsg.reply_to;
              if (!replyObj && newMsg.reply_to_message_id) {
                const parentMsg = prev.find(p => p.id === newMsg.reply_to_message_id);
                if (parentMsg) {
                  replyObj = {
                    id: parentMsg.id,
                    message: parentMsg.is_unsent ? 'Message unsent' : parentMsg.message,
                    sender_user_id: parentMsg.sender_user_id,
                    sender_role: parentMsg.sender_role,
                    sender_name: resolveSenderName(parentMsg),
                    is_unsent: parentMsg.is_unsent,
                    edited_at: parentMsg.edited_at,
                    student: parentMsg.student,
                    faculty: parentMsg.faculty,
                  };
                }
              }
              const enrichedMsg: Message = {
                ...newMsg,
                reply_to: replyObj || newMsg.reply_to,
                status: 'sent'
              };
              const optIndex = prev.findIndex(
                m => m.status === 'sending' && m.message === newMsg.message && m.sender_user_id === newMsg.sender_user_id
              );
              if (optIndex !== -1) {
                const updated = [...prev];
                updated[optIndex] = enrichedMsg;
                return updated;
              }
              return [...prev, enrichedMsg];
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConvId}` },
        async (payload) => {
          if (!isMounted) return;
          const updatedMsg = payload.new as Message;
          if (updatedMsg && updatedMsg.id) {
            // If message was deleted for this user
            if (updatedMsg.deleted_by_users && user?.id && updatedMsg.deleted_by_users.includes(user.id)) {
              setDirectMessages(prev => prev.filter(m => m.id !== updatedMsg.id));
              return;
            }
            setDirectMessages(prev => prev.map(m => {
              if (m.id === updatedMsg.id) {
                return { ...m, ...updatedMsg };
              }
              if (m.reply_to_message_id === updatedMsg.id && m.reply_to) {
                return {
                  ...m,
                  reply_to: {
                    ...m.reply_to,
                    message: updatedMsg.is_unsent ? 'Message unsent' : updatedMsg.message,
                    is_unsent: updatedMsg.is_unsent,
                    edited_at: updatedMsg.edited_at,
                  }
                };
              }
              return m;
            }));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, markConversationRead, user?.id, resolveSenderName]);

  // Auto-scroll on direct messages
  useEffect(() => {
    if (activeTab === 'DIRECT' && !isSearchingConv) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [directMessages, activeTab, isSearchingConv]);

  // Selected Group Object
  const selectedGroup = useMemo(() => {
    return messageGroups.find(g => g.id === selectedGroupId) || null;
  }, [messageGroups, selectedGroupId]);

  // Matching message IDs for In-Conversation Search
  const matchingDirectMsgIds = useMemo(() => {
    if (!convSearchQuery.trim()) return [];
    const q = convSearchQuery.toLowerCase();
    return directMessages
      .filter(m => !m.is_unsent && m.message.toLowerCase().includes(q))
      .map(m => m.id);
  }, [directMessages, convSearchQuery]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [convSearchQuery]);

  const handlePrevMatch = () => {
    if (matchingDirectMsgIds.length === 0) return;
    setCurrentMatchIndex(prev => (prev > 0 ? prev - 1 : matchingDirectMsgIds.length - 1));
  };

  const handleNextMatch = () => {
    if (matchingDirectMsgIds.length === 0) return;
    setCurrentMatchIndex(prev => (prev < matchingDirectMsgIds.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (matchingDirectMsgIds.length > 0 && matchingDirectMsgIds[currentMatchIndex]) {
      const targetId = matchingDirectMsgIds[currentMatchIndex];
      const el = document.getElementById(`msg-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matchingDirectMsgIds]);

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageId);
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 2000);
    }
  };

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
        (directStatusFilter === 'UNREAD' ? ((c.unread_count && c.unread_count > 0) || !!c.marked_unread) : c.status === directStatusFilter);

      const matchCategory = directCategoryFilter === 'ALL' || c.category === directCategoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [conversations, directSearchQuery, directStatusFilter, directCategoryFilter, isStudent]);

  // Total Unread Counters
  const totalGroupUnread = useMemo(() => {
    return messageGroups.reduce((acc, g) => acc + (g.unread_count || 0), 0);
  }, [messageGroups]);

  const totalDirectUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || (c.marked_unread ? 1 : 0)), 0);
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

  // Handle Send Direct Message with Optimistic UI & Reply
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !selectedConversation || !directInputMessage.trim() || directSending) return;

    const messageText = directInputMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const replyId = replyingToMessage?.id || null;
    const replySenderName = replyingToMessage ? resolveSenderName(replyingToMessage) : undefined;
    const replyingSnapshot = replyingToMessage ? {
      id: replyingToMessage.id,
      message: replyingToMessage.message,
      sender_user_id: replyingToMessage.sender_user_id,
      sender_role: replyingToMessage.sender_role,
      sender_name: replySenderName,
      is_unsent: replyingToMessage.is_unsent,
      edited_at: replyingToMessage.edited_at,
    } : null;

    const tempMsg: Message = {
      id: tempId,
      conversation_id: selectedConvId,
      sender_user_id: user?.id || '',
      receiver_user_id: isStudent ? selectedConversation.faculty_id : selectedConversation.student_id,
      student_id: selectedConversation.student_id,
      faculty_id: selectedConversation.faculty_id,
      sender_role: (role as any) || 'faculty',
      message: messageText,
      attachment_url: directAttachment?.dataUrl,
      attachment_name: directAttachment?.file.name,
      attachment_type: directAttachment?.file.type,
      attachment_size: directAttachment?.file.size,
      reply_to_message_id: replyId,
      reply_to: replyingSnapshot,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    // Optimistically add message to thread immediately
    setDirectMessages(prev => [...prev, tempMsg]);
    setDirectInputMessage('');
    setReplyingToMessage(null);
    setDirectAttachment(null);
    setDirectSending(true);
    setMessageSendError(null);

    try {
      const res = await sendMessage({
        conversationId: selectedConvId,
        message: messageText,
        attachmentUrl: tempMsg.attachment_url || undefined,
        attachmentName: tempMsg.attachment_name || undefined,
        attachmentType: tempMsg.attachment_type || undefined,
        attachmentSize: tempMsg.attachment_size || undefined,
        replyToMessageId: replyId,
      });

      if (!res.error && res.data) {
        setDirectSendSuccess(true);
        setTimeout(() => setDirectSendSuccess(false), 1200);
        setDirectMessages(prev => prev.map(m => m.id === tempId ? { ...res.data!, reply_to: replyingSnapshot, status: 'sent' } : m));
      } else {
        setMessageSendError(res.error?.message || 'Failed to send direct message. Your text has been preserved.');
        setDirectInputMessage(messageText);
        setDirectMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (err: any) {
      setMessageSendError(err.message || 'Error sending message. Your text has been preserved.');
      setDirectInputMessage(messageText);
      setDirectMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setDirectSending(false);
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async (msgId: string) => {
    if (!editingText.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    const trimmed = editingText.trim();
    try {
      setDirectMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return { ...m, message: trimmed, edited_at: new Date().toISOString() };
        }
        if (m.reply_to_message_id === msgId && m.reply_to) {
          return {
            ...m,
            reply_to: {
              ...m.reply_to,
              message: trimmed,
              edited_at: new Date().toISOString(),
            }
          };
        }
        return m;
      }));
      setEditingMsgId(null);
      showToast('Message updated');

      const res = await editDirectMessage(msgId, trimmed);
      if (res.error) {
        showToast('Failed to edit message');
        if (selectedConvId) {
          const fresh = await supabaseService.fetchConversationMessages(selectedConvId);
          setDirectMessages(fresh);
        }
      }
    } catch (err) {
      showToast('Failed to update message');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Confirm Unsend
  const handleConfirmUnsend = async () => {
    if (!unsendModalMsg || isUnsending) return;
    setIsUnsending(true);
    const msgId = unsendModalMsg.id;
    try {
      setDirectMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            message: 'Message unsent',
            is_unsent: true,
            unsent_at: new Date().toISOString(),
            attachment_url: null,
            attachment_name: null,
            attachment_type: null,
            attachment_size: null,
          };
        }
        if (m.reply_to_message_id === msgId && m.reply_to) {
          return {
            ...m,
            reply_to: {
              ...m.reply_to,
              message: 'Message unsent',
              is_unsent: true,
            }
          };
        }
        return m;
      }));
      setUnsendModalMsg(null);
      showToast('Message unsent');

      const res = await unsendDirectMessage(msgId);
      if (res.error) {
        showToast('Failed to unsend message');
        if (selectedConvId) {
          const fresh = await supabaseService.fetchConversationMessages(selectedConvId);
          setDirectMessages(fresh);
        }
      }
    } catch (err) {
      showToast('Failed to unsend message');
    } finally {
      setIsUnsending(false);
    }
  };

  // Handle Confirm Delete For Me
  const handleConfirmDeleteForMe = async () => {
    if (!deleteForMeModalMsg || isDeletingForMe) return;
    setIsDeletingForMe(true);
    const msgId = deleteForMeModalMsg.id;
    try {
      setDirectMessages(prev => prev.filter(m => m.id !== msgId));
      setDeleteForMeModalMsg(null);
      showToast('Message deleted for you');

      const res = await deleteMessageForMe(msgId);
      if (!res.success) {
        showToast('Failed to delete message');
        if (selectedConvId) {
          const fresh = await supabaseService.fetchConversationMessages(selectedConvId);
          setDirectMessages(fresh);
        }
      }
    } catch (err) {
      showToast('Failed to delete message');
    } finally {
      setIsDeletingForMe(false);
    }
  };

  // Handle Confirm Clear Conversation
  const handleConfirmClearConversation = async () => {
    if (!selectedConvId || isClearingConv) return;
    setIsClearingConv(true);
    try {
      setDirectMessages([]);
      setIsClearConvModalOpen(false);
      setHeaderMenuOpen(false);
      showToast('Conversation cleared');

      const res = await clearConversationForMe(selectedConvId);
      if (!res.success) {
        showToast('Failed to clear conversation');
        const fresh = await supabaseService.fetchConversationMessages(selectedConvId);
        setDirectMessages(fresh);
      }
    } catch (err) {
      showToast('Failed to clear conversation');
    } finally {
      setIsClearingConv(false);
    }
  };

  // Handle Mark As Unread
  const handleMarkConversationUnread = async (convId?: string) => {
    const targetId = convId || selectedConvId;
    if (!targetId) return;
    setHeaderMenuOpen(false);
    try {
      await markConversationUnread(targetId);
      showToast('Marked conversation as unread');
      refreshConversations();
    } catch (err) {
      showToast('Failed to mark conversation unread');
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

  // Helper to highlight matching text in message body
  const renderHighlightedMessage = (text: string, msgId: string) => {
    if (!convSearchQuery.trim() || !text.toLowerCase().includes(convSearchQuery.toLowerCase())) {
      return text;
    }
    const isCurrentActive = matchingDirectMsgIds[currentMatchIndex] === msgId;
    const escaped = convSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      part.toLowerCase() === convSearchQuery.toLowerCase() ? (
        <mark
          key={idx}
          className={`${
            isCurrentActive ? 'bg-amber-300 text-slate-900 font-bold ring-1 ring-amber-500' : 'bg-yellow-200 text-slate-900'
          } rounded-xs px-0.5`}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div 
      onClick={() => {
        setActiveMenuMsgId(null);
        setHeaderMenuOpen(false);
      }}
      className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto p-2 sm:p-4 gap-3"
    >
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
                  const hasUnread = (conv.unread_count || 0) > 0 || !!conv.marked_unread;
                  const otherPerson = isStudent ? conv.faculty : conv.student;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setSelectedConvId(conv.id);
                        setMobileThreadOpen(true);
                        markConversationRead(conv.id);
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
                              {conv.unread_count && conv.unread_count > 0 ? conv.unread_count : '1'}
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

                  {/* Header Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {loadingDirectMessages && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 animate-pulse mr-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="hidden sm:inline">Syncing...</span>
                      </div>
                    )}

                    {/* Search in conversation toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingConv(!isSearchingConv);
                        if (isSearchingConv) {
                          setConvSearchQuery('');
                        }
                      }}
                      className={`p-2 rounded-xl transition-colors ${
                        isSearchingConv
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="Search in conversation"
                    >
                      <Search className="w-4 h-4" />
                    </button>

                    {/* Status badge */}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                      selectedConversation.status === 'OPEN' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      selectedConversation.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                      selectedConversation.status === 'RESOLVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {selectedConversation.status}
                    </span>

                    {/* Header three-dot menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeaderMenuOpen(!headerMenuOpen);
                        }}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Conversation settings"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {headerMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleMarkConversationUnread(selectedConversation.id)}
                            className="w-full px-3.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            Mark as unread
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              setIsClearConvModalOpen(true);
                            }}
                            className="w-full px-3.5 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                          >
                            <Eraser className="w-3.5 h-3.5 text-rose-500" />
                            Clear conversation
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* In-conversation Search Bar (Collapsible) */}
                {isSearchingConv && (
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 shrink-0">
                    <div className="flex-1 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search in conversation..."
                        value={convSearchQuery}
                        onChange={(e) => setConvSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full text-xs text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none font-medium"
                      />
                      {convSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setConvSearchQuery('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500 font-medium whitespace-nowrap px-1">
                        {convSearchQuery.trim()
                          ? matchingDirectMsgIds.length > 0
                            ? `${currentMatchIndex + 1} of ${matchingDirectMsgIds.length}`
                            : '0 matches'
                          : ''}
                      </span>
                      <button
                        type="button"
                        disabled={matchingDirectMsgIds.length === 0}
                        onClick={handlePrevMatch}
                        className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Previous match"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={matchingDirectMsgIds.length === 0}
                        onClick={handleNextMatch}
                        className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Next match"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchingConv(false);
                          setConvSearchQuery('');
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors ml-1"
                        title="Close search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

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
                      const isHighlighted = highlightedMsgId === m.id;
                      const isSearchMatchActive = matchingDirectMsgIds[currentMatchIndex] === m.id;

                      // Find reply quote data either attached on message or from thread
                      const replyQuote = m.reply_to || (m.reply_to_message_id ? directMessages.find(x => x.id === m.reply_to_message_id) : null);

                      return (
                        <div
                          key={m.id}
                          id={`msg-${m.id}`}
                          className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                            isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 rounded-2xl transition-all duration-300' : ''
                          } ${isSearchMatchActive ? 'ring-2 ring-amber-400 ring-offset-2 rounded-2xl transition-all duration-300' : ''}`}
                        >
                          <div className={`relative flex items-center gap-1.5 max-w-full ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                            {/* Hover Actions Menu Trigger */}
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 ${
                              activeMenuMsgId === m.id ? 'opacity-100' : ''
                            }`}>
                              {!m.is_unsent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingToMessage(m);
                                    directInputRef.current?.focus();
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
                                  title="Reply"
                                >
                                  <CornerUpLeft className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuMsgId(activeMenuMsgId === m.id ? null : m.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
                                  title="More actions"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {/* Popover Menu */}
                                {activeMenuMsgId === m.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute bottom-full mb-1 z-30 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 text-xs animate-in fade-in zoom-in-95 ${
                                      isMe ? 'right-0' : 'left-0'
                                    }`}
                                  >
                                    {!m.is_unsent && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReplyingToMessage(m);
                                            setActiveMenuMsgId(null);
                                            directInputRef.current?.focus();
                                          }}
                                          className="w-full px-3 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                        >
                                          <CornerUpLeft className="w-3.5 h-3.5 text-slate-500" />
                                          Reply
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(m.message);
                                            showToast('Message copied to clipboard');
                                            setActiveMenuMsgId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                        >
                                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                                          Copy text
                                        </button>
                                      </>
                                    )}

                                    {isMe && !m.is_unsent && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMsgId(m.id);
                                            setEditingText(m.message);
                                            setActiveMenuMsgId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setUnsendModalMsg(m);
                                            setActiveMenuMsgId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                          Unsend
                                        </button>
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteForMeModalMsg(m);
                                        setActiveMenuMsgId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      Delete for me
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Message Bubble Body */}
                            <div className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              m.is_unsent
                                ? isMe
                                  ? 'bg-slate-800/70 border border-slate-700 text-slate-400 italic rounded-tr-none'
                                  : 'bg-slate-100 border border-slate-200 text-slate-500 italic rounded-tl-none'
                                : isMe 
                                ? 'bg-[#0f172a] text-white font-normal rounded-tr-none' 
                                : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                            }`}>
                              {/* Replied Message Quote Box */}
                              {m.reply_to_message_id && !m.is_unsent && (() => {
                                const directParent = directMessages.find(x => x.id === m.reply_to_message_id);
                                const rawQuote = directParent || m.reply_to;
                                const isUnavailable = !rawQuote;
                                const isUnsent = Boolean(rawQuote?.is_unsent);
                                const isEdited = Boolean(rawQuote?.edited_at);
                                const quoteSender = resolveSenderName(rawQuote);
                                const quoteText = isUnsent
                                  ? 'Message unsent'
                                  : isUnavailable
                                  ? 'Original message unavailable'
                                  : (rawQuote?.message || 'Message');

                                return (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (m.reply_to_message_id) {
                                        handleScrollToMessage(m.reply_to_message_id);
                                      }
                                    }}
                                    className={`mb-2 p-2 rounded-xl text-[11px] cursor-pointer border-l-[3px] transition-all hover:opacity-90 ${
                                      isMe
                                        ? 'bg-white/10 border-sky-400 text-slate-100 hover:bg-white/15'
                                        : 'bg-slate-50 border-[#0f172a] text-slate-800 hover:bg-slate-100'
                                    }`}
                                    title="Click to jump to original message"
                                  >
                                    <div className={`font-semibold text-[10.5px] mb-0.5 flex items-center gap-1.5 ${
                                      isMe ? 'text-sky-300' : 'text-slate-800'
                                    }`}>
                                      <CornerUpLeft className="w-3 h-3 opacity-80 shrink-0" />
                                      <span className="truncate">{quoteSender || 'Message'}</span>
                                    </div>
                                    <p className={`line-clamp-2 text-[11px] leading-snug break-words ${
                                      isMe ? 'text-slate-200' : 'text-slate-600'
                                    }`}>
                                      {isUnsent ? (
                                        <span className="italic opacity-85 flex items-center gap-1">
                                          <RotateCcw className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                          Message unsent
                                        </span>
                                      ) : isUnavailable ? (
                                        <span className="italic opacity-85">Original message unavailable</span>
                                      ) : (
                                        <>
                                          <span>{quoteText}</span>
                                          {isEdited && (
                                            <span className="text-[9px] opacity-75 font-normal ml-1">(edited)</span>
                                          )}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                );
                              })()}

                              {/* Unsent Message Placeholder */}
                              {m.is_unsent ? (
                                <div className="flex items-center gap-1.5">
                                  <RotateCcw className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                  <span>{isMe ? 'You unsent a message' : 'This message was unsent'}</span>
                                </div>
                              ) : editingMsgId === m.id ? (
                                /* Inline Edit Form */
                                <div className="p-1 space-y-2 w-full min-w-[240px]">
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full text-xs p-2 rounded-xl border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none font-medium"
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMsgId(null);
                                        setEditingText('');
                                      }}
                                      disabled={isSavingEdit}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(m.id)}
                                      disabled={isSavingEdit || !editingText.trim() || editingText.trim() === m.message}
                                      className="px-3 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                                    >
                                      {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Normal Message Body */
                                <>
                                  <p className="whitespace-pre-wrap">
                                    {renderHighlightedMessage(m.message, m.id)}
                                  </p>

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
                                </>
                              )}
                            </div>
                          </div>

                          {/* Message Footer: Timestamp, Edited badge, Delivery / Read Status */}
                          <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] font-mono ${
                            isMe ? 'justify-end text-slate-500' : 'justify-start text-slate-500'
                          }`}>
                            <span>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {m.edited_at && !m.is_unsent && (
                              <span className="text-[10px] italic text-slate-400 font-sans">(edited)</span>
                            )}
                            {isMe && (
                              <span className="inline-flex items-center ml-0.5">
                                {m.status === 'sending' ? (
                                  <span title="Sending...">
                                    <Clock className="w-3 h-3 text-slate-400 animate-pulse" />
                                  </span>
                                ) : m.status === 'failed' ? (
                                  <span title="Failed to send">
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                  </span>
                                ) : m.read_at ? (
                                  <span title={`Read at ${new Date(m.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  </span>
                                ) : (
                                  <span title="Delivered">
                                    <CheckCheck className="w-3.5 h-3.5 text-slate-400 opacity-70" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Direct Message Composer */}
                <form onSubmit={handleSendDirectMessage} className="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
                  {/* Replying-to Preview Banner */}
                  {replyingToMessage && (() => {
                    const replyingTargetName = resolveSenderName(replyingToMessage, true);
                    const snippet = replyingToMessage.is_unsent
                      ? 'Message unsent'
                      : replyingToMessage.message;
                    return (
                      <div className="flex items-center justify-between bg-slate-100/90 border-l-[3px] border-[#0f172a] px-3 py-1.5 rounded-r-xl text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 truncate">
                          <CornerUpLeft className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="font-semibold text-slate-800 shrink-0">
                            {replyingTargetName ? `Replying to ${replyingTargetName}:` : 'Replying to message:'}
                          </span>
                          <span className="text-slate-600 truncate max-w-[260px] sm:max-w-md font-medium italic">
                            "{snippet}"
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingToMessage(null)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition-colors shrink-0"
                          title="Cancel reply"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}

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
                      ref={directInputRef}
                      placeholder={replyingToMessage ? "Type your reply..." : "Type a direct message..."}
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

      {/* Unsend Message Confirmation Modal */}
      {unsendModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95"
          >
            <h3 className="text-sm font-bold text-slate-900">Unsend this message?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Everyone in this conversation will see that this message was removed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                disabled={isUnsending}
                onClick={() => setUnsendModalMsg(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUnsending}
                onClick={handleConfirmUnsend}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isUnsending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Unsend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete For Me Confirmation Modal */}
      {deleteForMeModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95"
          >
            <h3 className="text-sm font-bold text-slate-900">Delete message for you?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              This message will be removed from your view only. The other person will still be able to see it.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                disabled={isDeletingForMe}
                onClick={() => setDeleteForMeModalMsg(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingForMe}
                onClick={handleConfirmDeleteForMe}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isDeletingForMe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Delete for Me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Conversation Confirmation Modal */}
      {isClearConvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95"
          >
            <h3 className="text-sm font-bold text-slate-900">Clear entire conversation?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              This will hide all previous messages in this conversation from your view. The other person will still have their full conversation history.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                disabled={isClearingConv}
                onClick={() => setIsClearConvModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingConv}
                onClick={handleConfirmClearConversation}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isClearingConv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Clear Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
