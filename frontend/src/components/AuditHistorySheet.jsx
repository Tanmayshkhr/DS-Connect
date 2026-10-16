import { useState, useEffect, useCallback } from 'react';
import { History } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { getTicketAuditLogs } from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  ticket_created:        'Ticket created',
  ticket_assigned:       'Ticket assigned to resolver',
  ticket_status_changed: 'Status changed',
  comment_added:         'Comment added',
  faq_suggested:         'FAQ suggested',
  faq_reviewed:          'FAQ reviewed',
  faq_approved:          'FAQ approved and published',
  faq_rejected:          'FAQ rejected',
  user_role_updated:     'User role updated',
  user_deactivated:      'User deactivated',
  department_created:    'Department created',
  department_updated:    'Department updated',
};


function MetaTag({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100
      text-slate-600 rounded px-1.5 py-0.5">
      {label}: {String(value)}
    </span>
  );
}

// ── AuditHistorySheet ─────────────────────────────────────────────────────────

/**
 * Props:
 *   ticket      — ticket object (uses ticket.id and ticket.title)
 *   open        — boolean
 *   onOpenChange — (v: boolean) => void
 */
export default function AuditHistorySheet({ ticket, open, onOpenChange }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!ticket?.id) return;
    setLoading(true);
    try {
      setLogs(await getTicketAuditLogs(ticket.id));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (open && ticket) fetchHistory();
  }, [open, ticket, fetchHistory]);

  if (!ticket) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md flex flex-col overflow-hidden">
        <SheetHeader>
          <div className="flex items-center gap-2 pr-8">
            <History className="h-5 w-5 text-slate-400 shrink-0" />
            <div>
              <SheetTitle className="text-base font-bold text-slate-900 leading-snug">
                Ticket History
              </SheetTitle>
              <SheetDescription className="mt-0.5 truncate max-w-[300px]">
                {ticket.title}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-slate-400 animate-pulse">Loading history…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-400">No audit history found for this ticket.</p>
          ) : (
            <ol className="relative border-l border-slate-200 space-y-0">
              {logs.map((log, i) => (
                <li key={log.id} className="ml-4 pb-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full
                    bg-[#1A9F52] border-2 border-white" />

                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {ACTION_LABELS[log.action] || log.action}
                  </p>

                  {/* Metadata chips */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <MetaTag label="from" value={log.metadata.old_status} />
                      <MetaTag label="to"   value={log.metadata.new_status} />
                      <MetaTag label="category" value={log.metadata.category} />
                      <MetaTag label="priority" value={log.metadata.priority} />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {formatDateTime(log.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
