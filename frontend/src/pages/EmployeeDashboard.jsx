import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Search, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listTickets, createTicket, listFaqs, listDepartments } from '../lib/api';
import { formatDate } from '../lib/dateUtils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import NotificationBell from '../components/NotificationBell';
import TicketDetailSheet from '../components/TicketDetailSheet';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  open:        'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  in_progress: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  assigned:    'bg-amber-100 text-amber-800 hover:bg-amber-100',
  resolved:    'bg-slate-100 text-slate-600 hover:bg-slate-100',
  closed:      'bg-slate-200 text-slate-500 hover:bg-slate-200',
};

const PRIORITY_STYLES = {
  low:      'bg-slate-100 text-slate-500 hover:bg-slate-100',
  medium:   'bg-amber-100 text-amber-700 hover:bg-amber-100',
  high:     'bg-orange-100 text-orange-700 hover:bg-orange-100',
  critical: 'bg-rose-100 text-rose-700 hover:bg-rose-100',
};

const CATEGORY_OPTIONS = ['software', 'hardware', 'network', 'payroll', 'access', 'operations', 'other'];

// ── My Tickets Tab ────────────────────────────────────────────────────────────

function MyTicketsTab() {
  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', category: '', priority: '', department_id: '',
  });
  const [sheetTicket, setSheetTicket] = useState(null);
  const [sheetOpen, setSheetOpen]     = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await listTickets());
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { listDepartments().then(setDepartments).catch(() => {}); }, []);

  function resetForm() {
    setForm({ title: '', description: '', category: '', priority: '', department_id: '' });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.category || !form.priority || !form.department_id) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createTicket(form);
      setDialogOpen(false);
      resetForm();
      fetchTickets();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#1A9F52] hover:bg-[#158a45] active:bg-[#126e38] text-white font-semibold gap-1.5 cursor-pointer select-none">
              <Plus className="h-4 w-4" />
              Raise Ticket
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Raise a New Ticket</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Title <span className="text-red-400">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Provide more details..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-[#1A9F52] focus:ring-2 focus:ring-[#1A9F52]/20 resize-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="w-full cursor-pointer">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize cursor-pointer">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Priority <span className="text-red-400">*</span>
                  </label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="w-full cursor-pointer">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {['low', 'medium', 'high', 'critical'].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize cursor-pointer">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Department <span className="text-red-400">*</span>
                </label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger className="w-full cursor-pointer">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1A9F52] hover:bg-[#158a45] active:bg-[#126e38] text-white w-full sm:w-auto font-semibold cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting\u2026' : 'Submit Ticket'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm animate-pulse">
            Loading tickets\u2026
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No tickets yet. Use the button above to raise your first ticket.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Title</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Raised On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}
                  onClick={() => { setSheetTicket(t); setSheetOpen(true); }}
                  className="border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer">
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
        canComment={false}
        canPostInternal={false}
      />
    </div>
  );
}

// ── FAQs Tab ──────────────────────────────────────────────────────────────────

function FaqsTab() {
  const [faqs, setFaqs]       = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId]   = useState(null);

  useEffect(() => {
    listFaqs()
      .then((data) => setFaqs(data.filter((f) => f.status === 'published')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter((f) =>
    f.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FAQs\u2026"
          className="pl-9 focus-visible:ring-[#1A9F52]"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm animate-pulse">
          Loading FAQs\u2026
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">
          {search ? 'No FAQs match your search.' : 'No FAQs available.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filtered.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id}>
                <Button
                  variant="ghost"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between px-5 py-4 h-auto rounded-none text-left font-normal hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-sm font-semibold text-slate-800 pr-4 text-wrap text-left">{faq.question}</span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  }
                </Button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── EmployeeDashboard ─────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();

  return (
    <div className="min-h-screen bg-[#F4F7F5]">
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 gap-1.5 cursor-pointer font-semibold"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tickets" className="cursor-pointer">My Tickets</TabsTrigger>
            <TabsTrigger value="faqs" className="cursor-pointer">FAQs</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            <MyTicketsTab />
          </TabsContent>

          <TabsContent value="faqs">
            <FaqsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
