import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Search, Send, Lock, Globe, RefreshCw, Settings, BookOpen, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  listTickets, updateTicketStatus, listComments, addComment, suggestFaq,
  flagTicketDelayed,
} from '../lib/api';
import { formatDate, formatDateTime } from '../lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import NotificationBell from '../components/NotificationBell';
import FilterPopover, { DEFAULT_FILTERS, applyFilters } from '../components/FilterPopover';
import TicketActionMenu from '../components/TicketActionMenu';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  open:        'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-blue-100 text-blue-800',
  assigned:    'bg-amber-100 text-amber-800',
  resolved:    'bg-slate-100 text-slate-600',
  closed:      'bg-slate-200 text-slate-500',
};

const PRIORITY_STYLES = {
  low:      'bg-slate-100 text-slate-500',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
};

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-[#1A9F52] text-white' : 'bg-rose-500 text-white'}`}>
      {message}
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
    </div>
  );
}

// ── Flag Delayed Dialog ──────────────────────────────────────────────────────────────────────────

function FlagDelayedDialog({ ticket, open, onOpenChange, showToast, onDone }) {
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);

  // Pre-fill with existing reason when re-opening
  useEffect(() => {
    if (open) setReason(ticket?.delay_reason || '');
  }, [open, ticket]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await flagTicketDelayed(ticket.id, { is_delayed: true, delay_reason: reason.trim() });
      showToast('Ticket flagged as delayed');
      onOpenChange(false);
      onDone();
    } catch {
      showToast('Failed to flag ticket as delayed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Flag as Delayed
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          {ticket && (
            <p className="text-sm text-slate-500 truncate font-medium">{ticket.title}</p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Reason <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain why this ticket will take longer…"
              rows={3}
              className="resize-none text-sm focus-visible:ring-amber-400"
              required
            />
            <p className="text-[11px] text-slate-400">This note is visible to dept admins and system admins.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}
              className="cursor-pointer font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !reason.trim()}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white
                font-semibold cursor-pointer disabled:cursor-not-allowed gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Flag as Delayed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Ticket Detail Sheet ───────────────────────────────────────────────────────

function TicketSheet({ ticket, open, onOpenChange, onTicketUpdated, showToast, initialSection }) {
  const { user } = useAuth();
  const [comments, setComments]             = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment]         = useState('');
  const [isInternal, setIsInternal]         = useState(false);
  const [posting, setPosting]               = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [faqOpen, setFaqOpen]               = useState(false);
  const [faqForm, setFaqForm]               = useState({ question: '', answer: '' });
  const [faqSubmitting, setFaqSubmitting]   = useState(false);
  const commentsEndRef                      = useRef(null);
  const commentInputRef                     = useRef(null);

  const fetchComments = useCallback(async () => {
    if (!ticket) return;
    setCommentsLoading(true);
    try { setComments(await listComments(ticket.id)); }
    catch { setComments([]); }
    finally { setCommentsLoading(false); }
  }, [ticket]);

  useEffect(() => {
    if (open && ticket) {
      fetchComments();
      setFaqForm({ question: ticket.title || '', answer: ticket.description || '' });
    }
  }, [open, ticket, fetchComments]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Auto-focus the comment box if opened from "Add Comment" action
  useEffect(() => {
    if (open && initialSection === 'comment') {
      setTimeout(() => commentInputRef.current?.focus(), 200);
    }
  }, [open, initialSection]);

  async function handleStatusChange(newStatus) {
    if (!ticket || newStatus === ticket.status) return;
    setUpdatingStatus(true);
    try {
      await updateTicketStatus(ticket.id, newStatus);
      onTicketUpdated();
      showToast('Status updated successfully');
    } catch {
      showToast('Failed to update status', 'error');
    } finally { setUpdatingStatus(false); }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await addComment(ticket.id, { body: newComment.trim(), is_internal: isInternal });
      setNewComment('');
      setIsInternal(false);
      fetchComments();
    } catch {
      showToast('Failed to post comment', 'error');
    } finally { setPosting(false); }
  }

  async function handleFaqSubmit(e) {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;
    setFaqSubmitting(true);
    try {
      await suggestFaq({
        ticket_id: ticket.id,
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        department_id: ticket.department_id,
      });
      setFaqOpen(false);
      showToast('FAQ suggestion submitted successfully');
    } catch {
      showToast('Failed to suggest FAQ', 'error');
    } finally { setFaqSubmitting(false); }
  }

  if (!ticket) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg flex flex-col overflow-hidden">
        <SheetHeader>
          <div className="flex items-start justify-between pr-6">
            <div>
              <SheetTitle className="text-base font-bold text-slate-900 leading-snug pr-2">
                {ticket.title}
              </SheetTitle>
              <SheetDescription className="mt-1">
                Raised on {formatDate(ticket.created_at)}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs font-semibold border-0 capitalize ${PRIORITY_STYLES[ticket.priority]}`}>
              {ticket.priority}
            </Badge>
            <Badge className={`text-xs font-semibold border-0 capitalize ${STATUS_STYLES[ticket.status]}`}>
              {ticket.status?.replace('_', ' ')}
            </Badge>
            <Badge className="text-xs font-semibold border-0 bg-slate-100 text-slate-500 capitalize">
              {ticket.category}
            </Badge>
          </div>

          {/* Description */}
          {ticket.description && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
            </div>
          )}

          <Separator />

          {/* Status update */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Update Status</p>
            <Select value={ticket.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-full cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize cursor-pointer">
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Suggest FAQ */}
          <div className="flex justify-end">
            <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"
                  className="gap-1.5 cursor-pointer border-[#1A9F52] text-[#1A9F52] hover:bg-emerald-50 font-semibold">
                  <BookOpen className="h-4 w-4" />
                  Suggest FAQ
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Suggest a FAQ</DialogTitle></DialogHeader>
                <form onSubmit={handleFaqSubmit} className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Question <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={faqForm.question}
                      onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                      placeholder="FAQ question" required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Answer <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      value={faqForm.answer}
                      onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                      placeholder="FAQ answer" rows={4} required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={faqSubmitting}
                      className="bg-[#1A9F52] hover:bg-[#158a45] text-white font-semibold cursor-pointer disabled:cursor-not-allowed w-full sm:w-auto">
                      {faqSubmitting ? 'Submitting\u2026' : 'Submit Suggestion'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {commentsLoading ? (
              <p className="text-sm text-slate-400 animate-pulse">Loading comments\u2026</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id}
                    className={`rounded-lg px-3 py-2.5 text-sm ${
                      c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {c.is_internal
                        ? <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                        : <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                      }
                      <span className="text-[11px] font-semibold text-slate-400">
                        {c.is_internal ? 'Internal note' : 'Public comment'} \u00b7 {formatDateTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.body}</p>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}

            {/* New comment form */}
            <form onSubmit={handlePostComment} className="space-y-2 mt-3">
              <Textarea
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment\u2026"
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant={isInternal ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsInternal(!isInternal)}
                  className={`gap-1.5 cursor-pointer font-semibold text-xs transition-colors ${
                    isInternal
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {isInternal
                    ? <><Lock className="h-3 w-3" /> Internal Note</>
                    : <><Globe className="h-3 w-3" /> Public</>
                  }
                </Button>
                <Button
                  type="submit" size="sm"
                  disabled={posting || !newComment.trim()}
                  className="bg-[#1A9F52] hover:bg-[#158a45] active:bg-[#126e38] text-white gap-1.5 font-semibold cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                  {posting ? 'Posting\u2026' : 'Post'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── ResolverDashboard ─────────────────────────────────────────────────────────

export default function ResolverDashboard() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const [tickets, setTickets]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filters, setFilters]           = useState(DEFAULT_FILTERS);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [sheetSection, setSheetSection] = useState(null);
  const [toast, setToast]               = useState(null);
  const [delayTicket, setDelayTicket]   = useState(null);
  const [delayOpen, setDelayOpen]       = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Pass server-supported filters as query params
      const params = {};
      if (filters.status   && filters.status   !== 'all') params.status   = filters.status;
      if (filters.priority && filters.priority !== 'all') params.priority = filters.priority;
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      setTickets(await listTickets(params));
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.priority, filters.category]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  function openDetail(ticket, section = null) {
    setSelectedTicket(ticket);
    setSheetSection(section);
    setSheetOpen(true);
  }

  function openFlagDelayed(ticket) {
    setDelayTicket(ticket);
    setDelayOpen(true);
  }

  function handleTicketUpdated() {
    fetchTickets();
  }

  // Client-side: date range only (status/priority/category already server-filtered)
  const displayed = applyFilters(tickets, { ...filters, status: 'all', priority: 'all', category: 'all' }, search);

  return (
    <div className="min-h-screen bg-[#F4F7F5]">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Resolver</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 font-medium hidden sm:block">
            {user?.name || user?.email}
          </span>
          <NotificationBell />
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <Button variant="ghost" size="sm" onClick={logout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 gap-1.5 cursor-pointer font-semibold">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets\u2026"
              className="pl-9 focus-visible:ring-[#1A9F52]"
            />
          </div>

          <FilterPopover
            filters={filters}
            onChange={(f) => setFilters(f)}
            onClear={() => setFilters(DEFAULT_FILTERS)}
          />

          <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}
            className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <span className="text-xs text-slate-400 font-medium ml-auto">
            {displayed.length} ticket{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm animate-pulse">Loading tickets\u2026</div>
          ) : displayed.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No tickets match your filters.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Title</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Raised On</TableHead>
                  <TableHead className="w-24" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => openDetail(t)}
                    className="border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                  >
                    <TableCell className="font-medium text-slate-800 max-w-[220px] truncate">{t.title}</TableCell>
                    <TableCell className="capitalize text-slate-500 text-sm">{t.category}</TableCell>
                    <TableCell>
                      <Badge className={`text-[11px] font-semibold border-0 capitalize ${PRIORITY_STYLES[t.priority] || 'bg-slate-100 text-slate-500'}`}>
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[11px] font-semibold border-0 capitalize ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-500'}`}>
                        {t.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{formatDate(t.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {t.is_delayed && (
                        <Badge className="text-[11px] font-semibold border-0 bg-amber-100 text-amber-700 mr-1">
                          Delayed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <TicketActionMenu
                        ticket={t}
                        role="resolver"
                        onOpenDetail={openDetail}
                        onReassign={() => {}}
                        onViewHistory={() => {}}
                        onFlagDelayed={openFlagDelayed}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* Detail sheet */}
      <TicketSheet
        ticket={selectedTicket}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onTicketUpdated={handleTicketUpdated}
        showToast={showToast}
        initialSection={sheetSection}
      />

      {/* Delay dialog */}
      <FlagDelayedDialog
        ticket={delayTicket}
        open={delayOpen}
        onOpenChange={setDelayOpen}
        showToast={showToast}
        onDone={fetchTickets}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
