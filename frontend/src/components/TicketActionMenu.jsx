import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, RefreshCw, MessageSquare, UserCheck, History, Clock } from 'lucide-react';

/**
 * TicketActionMenu
 *
 * Props:
 *   ticket         — the ticket object
 *   role           — 'resolver' | 'dept_admin' | 'system_admin'
 *   onOpenDetail   — (ticket, section?) => void — opens the detail Sheet
 *   onReassign     — (ticket) => void — opens reassign dialog (dept_admin+)
 *   onViewHistory  — (ticket) => void — opens audit history Sheet (system_admin only)
 *   onFlagDelayed  — (ticket) => void — opens flag-as-delayed dialog (resolver only)
 */
export default function TicketActionMenu({ ticket, role, onOpenDetail, onReassign, onViewHistory, onFlagDelayed }) {
  const [open, setOpen]   = useState(false);
  const menuRef           = useRef(null);
  const triggerRef        = useRef(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (
        menuRef.current    && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function stopProp(e) {
    e.stopPropagation();
  }

  function action(fn) {
    setOpen(false);
    fn();
  }

  const isResolver    = role === 'resolver';
  const isDeptAdmin   = role === 'dept_admin';
  const isSysAdmin    = role === 'system_admin';

  return (
    <div className="relative" onClick={stopProp}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100
          transition-colors cursor-pointer"
        aria-label="Ticket actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Menu */}
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200
            rounded-xl shadow-xl z-50 py-1 overflow-hidden"
        >
          {/* Update Status — resolver, dept_admin, system_admin */}
          <button
            onClick={() => action(() => onOpenDetail(ticket, 'status'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700
              hover:bg-slate-50 cursor-pointer transition-colors text-left"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            Update Status
          </button>

          {/* Add Comment — resolver, dept_admin, system_admin */}
          <button
            onClick={() => action(() => onOpenDetail(ticket, 'comment'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700
              hover:bg-slate-50 cursor-pointer transition-colors text-left"
          >
            <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            Add Comment
          </button>

          {/* Flag as Delayed — resolver only */}
          {isResolver && onFlagDelayed && (
            <button
              onClick={() => action(() => onFlagDelayed(ticket))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer
                transition-colors text-left
                ${ticket.is_delayed
                  ? 'text-amber-700 hover:bg-amber-50'
                  : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              <Clock className={`h-3.5 w-3.5 shrink-0 ${ticket.is_delayed ? 'text-amber-500' : 'text-slate-400'}`} />
              {ticket.is_delayed ? 'Update Delay Reason' : 'Flag as Delayed'}
            </button>
          )}

          {/* Reassign — dept_admin, system_admin only */}
          {(isDeptAdmin || isSysAdmin) && (
            <button
              onClick={() => action(() => onReassign(ticket))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700
                hover:bg-slate-50 cursor-pointer transition-colors text-left"
            >
              <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              Reassign
            </button>
          )}

          {/* View Full History — system_admin only */}
          {isSysAdmin && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => action(() => onViewHistory(ticket))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700
                  hover:bg-slate-50 cursor-pointer transition-colors text-left"
              >
                <History className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                View Full History
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
