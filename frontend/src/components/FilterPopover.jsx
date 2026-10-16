import { useState, useRef, useEffect } from 'react';
import { Filter, X, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const CATEGORY_OPTIONS = ['software', 'hardware', 'network', 'payroll', 'access', 'operations', 'other'];

export const DEFAULT_FILTERS = {
  status:    'all',
  priority:  'all',
  category:  'all',
  dateFrom:  '',
  dateTo:    '',
};

/** Count how many non-default filter values are active */
export function countActiveFilters(filters) {
  return Object.entries(filters).filter(([, v]) => v && v !== 'all').length;
}

/**
 * Apply filters client-side to a ticket array.
 * status/priority/category are already filtered server-side when passed as query params,
 * so this only needs to handle dateFrom/dateTo (and is also safe to run on the full set).
 */
export function applyFilters(tickets, filters, search = '') {
  return tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.title?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);

    const matchStatus   = !filters.status   || filters.status   === 'all' || t.status   === filters.status;
    const matchPriority = !filters.priority || filters.priority === 'all' || t.priority === filters.priority;
    const matchCategory = !filters.category || filters.category === 'all' || t.category === filters.category;

    const createdAt = t.created_at ? new Date(t.created_at) : null;
    const matchFrom = !filters.dateFrom || (createdAt && createdAt >= new Date(filters.dateFrom));
    const matchTo   = !filters.dateTo   || (createdAt && createdAt <= new Date(filters.dateTo + 'T23:59:59'));

    return matchSearch && matchStatus && matchPriority && matchCategory && matchFrom && matchTo;
  });
}

// ── FilterPopover ─────────────────────────────────────────────────────────────

/**
 * Props:
 *   filters     — current filter state (DEFAULT_FILTERS shape)
 *   onChange    — (newFilters) => void
 *   onClear     — () => void
 */
export default function FilterPopover({ filters, onChange, onClear }) {
  const [open, setOpen]   = useState(false);
  const panelRef          = useRef(null);
  const buttonRef         = useRef(null);
  const activeCount       = countActiveFilters(filters);

  // Click-outside
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (
        panelRef.current  && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-semibold
          transition-colors cursor-pointer
          ${activeCount > 0
            ? 'border-[#1A9F52] text-[#1A9F52] bg-emerald-50'
            : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}
        aria-label="Open filters"
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] bg-[#1A9F52]
            text-white text-[10px] font-bold rounded-full px-1 ml-0.5">
            {activeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200
            rounded-xl shadow-xl z-40 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Filter tickets</span>
            {activeCount > 0 && (
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700
                  font-semibold cursor-pointer transition-colors"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <Select value={filters.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="w-full h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize cursor-pointer">
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
            <Select value={filters.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger className="w-full h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">All priorities</SelectItem>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize cursor-pointer">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
            <Select value={filters.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger className="w-full h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">All categories</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize cursor-pointer">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Date range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">From</p>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => set('dateFrom', e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-[#1A9F52] focus:border-transparent"
                />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">To</p>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => set('dateTo', e.target.value)}
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-[#1A9F52] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setOpen(false)}
            className="w-full bg-[#1A9F52] hover:bg-[#158a45] text-white font-semibold cursor-pointer"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
