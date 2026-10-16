import { useState, useEffect, useCallback } from 'react';
import { LogOut, RefreshCw, Search, Filter, ShieldOff, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  listUsers, updateUserRole, deactivateUser,
  listTickets, listFaqs, approveFaq, rejectFaq,
  listDepartments, assignTicket, updateTicketStatus,
} from '../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import TicketDetailSheet from '../components/TicketDetailSheet';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = ['employee', 'resolver', 'dept_admin', 'system_admin'];

const ROLE_LABELS = {
  employee:     'Employee',
  resolver:     'Resolver',
  dept_admin:   'Dept Admin',
  system_admin: 'System Admin',
};

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

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

const FAQ_STATUS_STYLES = {
  published: 'bg-emerald-100 text-emerald-800',
  suggested: 'bg-amber-100 text-amber-700',
  reviewed:  'bg-blue-100 text-blue-700',
  rejected:  'bg-rose-100 text-rose-700',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
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

// ── Role Assign Dialog ────────────────────────────────────────────────────────

function RoleAssignDialog({ target, departments, open, onOpenChange, showToast, onDone }) {
  const [role, setRole]     = useState('');
  const [deptId, setDeptId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const needsDept = ['resolver', 'dept_admin'].includes(role);

  useEffect(() => {
    if (open && target) {
      setRole(target.role || 'employee');
      setDeptId(target.department_id || '');
      setErr('');
    }
  }, [open, target]);

  async function handleSave() {
    if (needsDept && !deptId) { setErr('A department is required for this role.'); return; }
    setSaving(true);
    setErr('');
    try {
      await updateUserRole(target.id, { role, department_id: deptId || null });
      showToast(`Role updated to ${ROLE_LABELS[role] || role}`);
      onOpenChange(false);
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to update role.');
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {target && (
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{target.name || target.email}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</label>
            <Select value={role} onValueChange={(v) => { setRole(v); setErr(''); }}>
              <SelectTrigger className="cursor-pointer w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="cursor-pointer">
                    {ROLE_LABELS[r] || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Department {needsDept && <span className="text-rose-400">*</span>}
            </label>
            <Select value={deptId || '__none__'} onValueChange={(v) => { setDeptId(v === '__none__' ? '' : v); setErr(''); }}>
              <SelectTrigger className="cursor-pointer w-full"><SelectValue placeholder="— Not set —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="cursor-pointer text-slate-400">— Not set —</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {err && <p className="text-xs text-rose-500 font-medium">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer font-semibold">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || (needsDept && !deptId)}
            className="bg-[#1A9F52] hover:bg-[#158a45] text-white font-semibold cursor-pointer disabled:cursor-not-allowed">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── All Users Tab ─────────────────────────────────────────────────────────────

function AllUsersTab({ departments, showToast }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState({});
  const [search, setSearch]         = useState('');
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try { setUsers(await listUsers()); }
    catch { setUsers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleDeactivate(userId) {
    setActing((p) => ({ ...p, [userId]: 'deactivate' }));
    try {
      await deactivateUser(userId);
      showToast('User deactivated');
      fetchUsers();
    } catch { showToast('Failed to deactivate', 'error'); }
    finally { setActing((p) => ({ ...p, [userId]: null })); }
  }

  const deptName = (id) => departments.find((d) => d.id === id)?.name || '—';

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…" className="pl-9 focus-visible:ring-[#1A9F52]" />
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}
          className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900 ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm animate-pulse">Loading users…</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                {['Name', 'Email', 'Role', 'Department', 'Status', 'Actions'].map((h) => (
                  <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium text-slate-800">{u.name || '—'}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{u.email}</TableCell>
                  <TableCell>
                    {u.id === currentUser?.id ? (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    ) : (
                      <button
                        onClick={() => { setRoleTarget(u); setRoleDialogOpen(true); }}
                        className="text-xs font-semibold text-[#1A9F52] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        title="Click to change role"
                      >
                        {ROLE_LABELS[u.role] || u.role}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{deptName(u.department_id)}</TableCell>
                  <TableCell>
                    {!u.department_id && u.role === 'employee' ? (
                      <Badge className="text-[11px] font-semibold border-0 bg-amber-100 text-amber-700">
                        Pending Setup
                      </Badge>
                    ) : (
                      <Badge className={`text-[11px] font-semibold border-0 ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_active && u.id !== currentUser?.id && (
                      <Button size="sm" variant="outline" onClick={() => handleDeactivate(u.id)}
                        disabled={acting[u.id] === 'deactivate'}
                        className="gap-1.5 cursor-pointer font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 disabled:cursor-not-allowed">
                        <ShieldOff className="h-3.5 w-3.5" />
                        {acting[u.id] === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <RoleAssignDialog
        target={roleTarget}
        departments={departments}
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        showToast={showToast}
        onDone={fetchUsers}
      />
    </div>
  );
}

// ── All Tickets Tab ───────────────────────────────────────────────────────────

function AllTicketsTab({ departments, showToast }) {
  const [tickets, setTickets]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter]     = useState('all');
  const [sheetTicket, setSheetTicket]   = useState(null);
  const [sheetOpen, setSheetOpen]       = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try { setTickets(await listTickets()); }
    catch { setTickets([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const deptName = (id) => departments.find((d) => d.id === id)?.name || id || '—';

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)) &&
      (statusFilter === 'all'   || t.status === statusFilter) &&
      (priorityFilter === 'all' || t.priority === priorityFilter) &&
      (deptFilter === 'all'     || t.department_id === deptFilter)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…" className="pl-9 focus-visible:ring-[#1A9F52]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 cursor-pointer">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize cursor-pointer">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 cursor-pointer">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Priorities</SelectItem>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize cursor-pointer">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-40 cursor-pointer">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}
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
                {['Title', 'Category', 'Department', 'Priority', 'Status', 'Raised On'].map((h) => (
                  <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}
                  onClick={() => { setSheetTicket(t); setSheetOpen(true); }}
                  className="border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer">
                  <TableCell className="font-medium text-slate-800 max-w-[200px] truncate">{t.title}</TableCell>
                  <TableCell className="capitalize text-slate-500 text-sm">{t.category}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{deptName(t.department_id)}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TicketDetailSheet
        ticket={sheetTicket}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canComment={true}
        canPostInternal={true}
        showToast={showToast}
      />
    </div>
  );
}

// ── All FAQs Tab ──────────────────────────────────────────────────────────────

function AllFaqsTab({ departments, showToast }) {
  const [faqs, setFaqs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [acting, setActing]             = useState({});
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes]   = useState('');
  const [rejecting, setRejecting]       = useState(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try { setFaqs(await listFaqs()); }
    catch { setFaqs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  const deptName = (id) => departments.find((d) => d.id === id)?.name || '—';

  async function handleApprove(faqId) {
    setActing((p) => ({ ...p, [faqId]: 'approving' }));
    try {
      await approveFaq(faqId);
      showToast('FAQ approved and published');
      fetchFaqs();
    } catch { showToast('Failed to approve FAQ', 'error'); }
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm animate-pulse">Loading FAQs…</div>
        ) : faqs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No FAQs found.</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                {['Question', 'Department', 'Status', 'Suggested By', 'Approved By', 'Actions'].map((h) => (
                  <TableHead key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqs.map((f) => {
                const actionable = f.status === 'suggested' || f.status === 'reviewed';
                return (
                  <TableRow key={f.id} className="border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-medium text-slate-800 max-w-[260px] truncate">{f.question}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{deptName(f.department_id)}</TableCell>
                    <TableCell>
                      <Badge className={`text-[11px] font-semibold border-0 capitalize ${FAQ_STATUS_STYLES[f.status] || 'bg-slate-100 text-slate-500'}`}>
                        {f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{f.created_by || '—'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{f.approved_by || '—'}</TableCell>
                    <TableCell>
                      {actionable && (
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" onClick={() => handleApprove(f.id)}
                            disabled={acting[f.id] === 'approving'}
                            className="bg-[#1A9F52] hover:bg-[#158a45] text-white gap-1 h-8 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {acting[f.id] === 'approving' ? 'Publishing…' : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => { setRejectTarget(f.id); setRejectNotes(''); }}
                            className="gap-1 h-8 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer">
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reject FAQ</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-500">Provide an optional reason for rejection.</p>
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason (optional)…" rows={3} className="resize-none text-sm" />
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

// ── SystemAdminDashboard ──────────────────────────────────────────────────────

export default function SystemAdminDashboard() {
  const { user, logout } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F7F5]">
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">System Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium hidden sm:block">
            {user?.name || user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={logout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 gap-1.5 cursor-pointer font-semibold">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="cursor-pointer">All Users</TabsTrigger>
            <TabsTrigger value="tickets" className="cursor-pointer">All Tickets</TabsTrigger>
            <TabsTrigger value="faqs" className="cursor-pointer">All FAQs</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AllUsersTab departments={departments} showToast={showToast} />
          </TabsContent>

          <TabsContent value="tickets">
            <AllTicketsTab departments={departments} showToast={showToast} />
          </TabsContent>

          <TabsContent value="faqs">
            <AllFaqsTab departments={departments} showToast={showToast} />
          </TabsContent>
        </Tabs>
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
