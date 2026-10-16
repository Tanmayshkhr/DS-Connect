import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, UserPlus, CheckCircle2 } from 'lucide-react';
import { listAuditLogs, onboardUser, listDepartments } from '../lib/api';
import { relativeTime, parseUTCDate } from '../lib/dateUtils';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LS_KEY          = 'ds_notif_last_seen';
// Resolved onboarding IDs are persisted so they don't re-appear on refresh.
const LS_RESOLVED_KEY = 'ds_onboard_resolved';

function getLastSeen() {
  const v = localStorage.getItem(LS_KEY);
  return v ? new Date(v) : new Date(0);
}
function setLastSeen() {
  localStorage.setItem(LS_KEY, new Date().toISOString());
}
function getResolved() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_RESOLVED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markResolved(logId) {
  const s = getResolved();
  s.add(logId);
  localStorage.setItem(LS_RESOLVED_KEY, JSON.stringify([...s]));
}

/** Maps raw ActionEnum values to a readable label */
const ACTION_LABELS = {
  ticket_created:          'Ticket created',
  ticket_assigned:         'Ticket assigned',
  ticket_status_changed:   'Ticket status changed',
  comment_added:           'Comment added',
  faq_suggested:           'FAQ suggested',
  faq_reviewed:            'FAQ reviewed',
  faq_approved:            'FAQ approved',
  faq_rejected:            'FAQ rejected',
  user_role_updated:       'User role updated',
  user_deactivated:        'User deactivated',
  department_created:      'Department created',
  department_updated:      'Department updated',
  new_user_pending_setup:  'New user — setup required',
  user_onboarded:          'User onboarded',
};

const ROLES = ['employee', 'resolver', 'dept_admin', 'system_admin'];

// ── OnboardCard ───────────────────────────────────────────────────────────────

/**
 * Inline actionable card shown only to system_admin for new_user_pending_setup entries.
 * On success it marks the log id as resolved locally (no re-fetch needed).
 */
function OnboardCard({ log, departments, onResolved }) {
  const [role, setRole]       = useState('employee');
  const [deptId, setDeptId]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [done, setDone]       = useState(() => getResolved().has(log.id));

  // Pre-select the first department if only one exists
  useEffect(() => {
    if (departments.length === 1 && !deptId) setDeptId(departments[0].id);
  }, [departments, deptId]);

  const userId = log.metadata?.user_id;
  const email  = log.metadata?.email;

  async function handleAssign() {
    if (!deptId || !role || !userId) return;
    setBusy(true);
    setErr('');
    try {
      await onboardUser(userId, { role, department_id: deptId });
      markResolved(log.id);
      setDone(true);
      onResolved();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to onboard user.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-600 font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Setup complete
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Role select */}
      <select
        id={`onboard-role-${log.id}`}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5
          bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1A9F52] cursor-pointer"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {/* Department select */}
      <select
        id={`onboard-dept-${log.id}`}
        value={deptId}
        onChange={(e) => setDeptId(e.target.value)}
        className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5
          bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1A9F52] cursor-pointer"
      >
        <option value="">Select department…</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      {err && (
        <p className="text-[10px] text-rose-500 font-medium leading-snug">{err}</p>
      )}

      <button
        id={`onboard-assign-${log.id}`}
        onClick={handleAssign}
        disabled={!deptId || busy}
        className="w-full text-[11px] font-bold py-1.5 rounded-md bg-[#1A9F52]
          text-white hover:bg-[#158a45] disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors cursor-pointer"
      >
        {busy ? 'Assigning…' : `Assign & Activate`}
      </button>
    </div>
  );
}

// ── NotificationBell ─────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { user }              = useAuth();
  const isSysAdmin            = user?.role === 'system_admin';

  const [logs, setLogs]       = useState([]);
  const [open, setOpen]       = useState(false);
  const [unread, setUnread]   = useState(0);
  const [departments, setDepts] = useState([]);
  const panelRef              = useRef(null);
  const buttonRef             = useRef(null);

  // Fetch departments once for the onboard card dropdowns (only needed for sys admin)
  useEffect(() => {
    if (!isSysAdmin) return;
    listDepartments().then(setDepts).catch(() => {});
  }, [isSysAdmin]);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await listAuditLogs({ limit: 20 });
      setLogs(data);
      const lastSeen = getLastSeen();
      const resolved = getResolved();
      const newCount = data.filter(
        (l) => l.created_at &&
               parseUTCDate(l.created_at) > lastSeen &&
               !resolved.has(l.id)
      ).length;
      setUnread(newCount);
    } catch {
      // silently fail — notifications are non-critical
    }
  }, []);

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 30_000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleOpen() {
    if (!open) {
      setOpen(true);
      setUnread(0);
      setLastSeen();
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
            bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 max-h-[480px] overflow-y-auto
            bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-sm font-bold text-slate-800">Notifications</span>
            <button
              onClick={fetchLogs}
              className="text-[11px] text-[#1A9F52] hover:underline font-semibold cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {/* Log entries */}
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No recent activity.
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {logs.map((log) => {
                const isPending = log.action === 'new_user_pending_setup';
                const isResolved = getResolved().has(log.id);

                return (
                  <li
                    key={log.id}
                    className={`px-4 py-3 transition-colors ${
                      isPending && !isResolved
                        ? 'bg-amber-50 hover:bg-amber-100/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Action label row */}
                    <div className="flex items-center gap-1.5">
                      {isPending && !isResolved && (
                        <UserPlus className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <p className={`text-sm font-medium leading-snug ${
                        isResolved ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                    </div>

                    {/* Email for pending-setup logs */}
                    {isPending && log.metadata?.email && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">
                        {log.metadata.email}
                      </p>
                    )}

                    {/* Other log metadata */}
                    {!isPending && log.metadata?.title && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {log.metadata.title}
                      </p>
                    )}
                    {!isPending && log.metadata?.question && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {log.metadata.question}
                      </p>
                    )}

                    <p className="text-[11px] text-slate-400 mt-1">
                      {relativeTime(log.created_at)}
                    </p>

                    {/* Inline onboard form — only for system_admin, only for pending logs */}
                    {isPending && isSysAdmin && (
                      <OnboardCard
                        log={log}
                        departments={departments}
                        onResolved={fetchLogs}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
