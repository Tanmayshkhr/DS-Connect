import { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, RefreshCw, CheckCircle, XCircle, UserCheck, MessageSquare, Lock, Globe, Send, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  listTickets, listResolvers, assignTicket,
  listFaqs, reviewFaq, rejectFaq, updateTicketStatus,
  listComments, addComment,
} from '../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import TicketActionMenu from '../components/TicketActionMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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

// ── Ticket Detail Sheet ───────────────────────────────────────────────────────

function TicketDetailSheet({ ticket, resolvers, open, onOpenChange, onTicketUpdated, showToast, initialSection }) {
  const [comments, setComments]         = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment]     = useState('');
  const [isInternal, setIsInternal]     = useState(false);
  const [posting, setPosting]           = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const commentInputRef                 = useRef(null);
  const commentsEndRef                  = useRef(null);

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
      // If opened via "Add Comment", auto-focus the textarea
      if (initialSection === 'comment') {
        setTimeout(() => commentInputRef.current?.focus(), 200);
      }
    }
  }, [open, ticket, fetchComments, initialSection]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  async function handleStatusChange(newStatus) {
    if (!ticket || newStatus === ticket.status) return;
    setUpdatingStatus(true);
    try {
      await updateTicketStatus(ticket.id, newStatus);
      onTicketUpdated();
      showToast('Status updated');
    } catch { showToast('Failed to update status', 'error'); }
    finally { setUpdatingStatus(false); }
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
    } catch { showToast('Failed to post comment', 'error'); }
    finally { setPosting(false); }
  }

  if (!ticket) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg flex flex-col overflow-hidden">
        <SheetHeader>
          <div className="pr-6">
            <SheetTitle className="text-base font-bold text-slate-900 leading-snug">
              {ticket.title}
            </SheetTitle>
            <SheetDescription className="mt-1">Raised on {formatDate(ticket.created_at)}</SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs font-semibold border-0 capitalize ${PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</Badge>
            <Badge className={`text-xs font-semibold border-0 capitalize ${STATUS_STYLES[ticket.status]}`}>{ticket.status?.replace('_', ' ')}</Badge>
            <Badge className="text-xs font-semibold border-0 bg-slate-100 text-slate-500 capitalize">{ticket.category}</Badge>
          </div>

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
                  <SelectItem key={s} value={s} className="capitalize cursor-pointer">{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reassign */}
          {resolvers.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reassign To</p>
              <Select
                value={ticket.assigned_resolver_id || ''}
                onValueChange={async (v) => {
                  try {
                    await assignTicket(ticket.id, v);
                    onTicketUpdated();
                    showToast('Ticket reassigned');
                  } catch { showToast('Failed to reassign', 'error'); }
                }}
              >
                <SelectTrigger className="w-full cursor-pointer"><SelectValue placeholder="Select resolver…" /></SelectTrigger>
                <SelectContent>
                  {resolvers.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="cursor-pointer">{r.name || r.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Comment thread */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {commentsLoading ? (
              <p className="text-sm text-slate-400 animate-pulse">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className={`rounded-lg px-3 py-2.5 text-sm ${
                    c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {c.is_internal
                        ? <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                        : <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                      }
                      <span className="text-[11px] font-semibold text-slate-400">
                        {c.is_internal ? 'Internal note' : 'Public comment'} · {formatDateTime(c.created_at)}
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
                placeholder="Write a comment…"
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant={isInternal ? 'secondary' : 'outline'} size="sm"
                  onClick={() => setIsInternal(!isInternal)}
                  className={`gap-1.5 cursor-pointer font-semibold text-xs transition-colors ${
                    isInternal ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {isInternal ? <><Lock className="h-3 w-3" /> Internal Note</> : <><Globe className="h-3 w-3" /> Public</>}
                </Button>
                <Button type="submit" size="sm" disabled={posting || !newComment.trim()}
                  className="bg-[#1A9F52] hover:bg-[#158a45] text-white gap-1.5 font-semibold cursor-pointer disabled:cursor-not-allowed">
                  <Send className="h-3.5 w-3.5" />
                  {posting ? 'Posting…' : 'Post'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── All Tickets Tab ───────────────────────────────────────────────────────────

function AllTicketsTab({ deptId, showToast }) {
  const [tickets, setTickets]     = useState([]);
  const [resolvers, setResolvers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Sheet state
  const [sheetTicket, setSheetTicket]       = useState(null);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [sheetInitialSection, setSheetInitialSection] = useState('detail');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tkts, resolverUsers] = await Promise.all([
        listTickets(),
        deptId ? listResolvers(deptId) : Promise.resolve([]),
      ]);
      setTickets(tkts);
      setResolvers(resolverUsers);
    } catch {
      setTickets([]);
      setResolvers([]);
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openSheet(ticket, section = 'detail') {
    setSheetTicket(ticket);
    setSheetInitialSection(section);
    setSheetOpen(true);
  }

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)) &&
      (statusFilter === 'all'   || t.status === statusFilter) &&
      (priorityFilter === 'all' || t.priority === priorityFilter)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="pl-9 focus-visible:ring-[#1A9F52]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 cursor-pointer"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize cursor-pointer">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 cursor-pointer"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Priorities</SelectItem>
            {['low', 'medium', 'high', 'critical'].map((p) => (
              <SelectItem key={p} value={p} className="capitalize cursor-pointer">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}
          className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900 ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs text-slate-400 font-medium">
          {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm animate-pulse">Loading tickets…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No tickets match your filters.</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Title</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Raised On</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assign To</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}
                  onClick={() => openSheet(t, 'detail')}
                  className="border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer group">
                  <TableCell className="font-medium text-slate-800 max-w-[200px] truncate">{t.title}</TableCell>
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
                  <TableCell className="min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                    {resolvers.length === 0 ? (
                      <span className="text-xs text-slate-400">No resolvers</span>
                    ) : (
                      <Select value={t.assigned_resolver_id || ''}
                        onValueChange={async (v) => {
                          try { await assignTicket(t.id, v); showToast('Assigned'); fetchAll(); }
                          catch { showToast('Failed to assign', 'error'); }
                        }}>
                        <SelectTrigger className="w-40 h-8 text-xs cursor-pointer">
                          <UserCheck className="h-3.5 w-3.5 text-slate-400 mr-1 shrink-0" />
                          <SelectValue placeholder="Assign…" />
                        </SelectTrigger>
                        <SelectContent>
                          {resolvers.map((r) => (
                            <SelectItem key={r.id} value={r.id} className="text-xs cursor-pointer">{r.name || r.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TicketActionMenu
                      ticket={t}
                      role="dept_admin"
                      onOpenDetail={(ticket, section) => openSheet(ticket, section || 'detail')}
                      onReassign={(ticket) => openSheet(ticket, 'detail')}
                      onViewHistory={() => {}}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TicketDetailSheet
        ticket={sheetTicket}
        resolvers={resolvers}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onTicketUpdated={fetchAll}
        showToast={showToast}
        initialSection={sheetInitialSection}
      />
    </div>
  );
}

// ── FAQ Review Tab ────────────────────────────────────────────────────────────

function FaqReviewTab({ showToast }) {
  const [faqs, setFaqs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [acting, setActing]             = useState({});
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes]   = useState('');
  const [rejecting, setRejecting]       = useState(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFaqs();
      setFaqs(data.filter((f) => f.status === 'suggested'));
    } catch { setFaqs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  async function handleReview(faqId) {
    setActing((p) => ({ ...p, [faqId]: 'reviewing' }));
    try {
      await reviewFaq(faqId);
      showToast('FAQ marked as reviewed — awaiting system admin approval');
      fetchFaqs();
    } catch { showToast('Failed to review FAQ', 'error'); }
    finally { setActing((p) => ({ ...p, [faqId]: null })); }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await rejectFaq(rejectTarget, { reason: rejectNotes });
      showToast('FAQ rejected');
      setRejectTarget(null);
      setRejectNotes('');
      fetchFaqs();
    } catch { showToast('Failed to reject FAQ', 'error'); }
    finally { setRejecting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchFaqs} disabled={loading}
          className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm animate-pulse">
          Loading FAQs…
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">
          No pending FAQs to review.
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Question</p>
                <p className="text-sm font-semibold text-slate-800">{faq.question}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Answer</p>
                <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
              {faq.created_by && (
                <p className="text-xs text-slate-400">
                  Suggested by <span className="font-semibold text-slate-500">{faq.created_by}</span>
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={() => handleReview(faq.id)} disabled={acting[faq.id] === 'reviewing'}
                  className="bg-[#1A9F52] hover:bg-[#158a45] text-white gap-1.5 cursor-pointer font-semibold disabled:cursor-not-allowed">
                  <CheckCircle className="h-4 w-4" />
                  {acting[faq.id] === 'reviewing' ? 'Reviewing…' : 'Mark Reviewed'}
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { setRejectTarget(faq.id); setRejectNotes(''); }}
                  className="gap-1.5 cursor-pointer font-semibold text-rose-600 border-rose-200 hover:bg-rose-50">
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reject FAQ</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-500">Optionally provide a reason for rejection.</p>
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for rejection (optional)…" rows={3} className="resize-none text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} className="cursor-pointer font-semibold">Cancel</Button>
            <Button onClick={handleRejectConfirm} disabled={rejecting}
              className="bg-rose-500 hover:bg-rose-600 text-white gap-1.5 cursor-pointer font-semibold disabled:cursor-not-allowed">
              <XCircle className="h-4 w-4" />
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── DeptAdminDashboard ────────────────────────────────────────────────────────

export default function DeptAdminDashboard() {
  const { user, logout } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F7F5]">
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Dept Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium hidden sm:block">{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1.5 cursor-pointer font-semibold">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tickets" className="cursor-pointer">All Tickets</TabsTrigger>
            <TabsTrigger value="faqs" className="cursor-pointer">FAQ Review</TabsTrigger>
          </TabsList>
          <TabsContent value="tickets">
            <AllTicketsTab deptId={user?.department_id} showToast={showToast} />
          </TabsContent>
          <TabsContent value="faqs">
            <FaqReviewTab deptId={user?.department_id} showToast={showToast} />
          </TabsContent>
        </Tabs>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
