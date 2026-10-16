import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Globe, Send } from 'lucide-react';
import { listComments, addComment } from '../lib/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

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

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * TicketDetailSheet
 *
 * Props:
 *   ticket         — ticket object or null
 *   open           — boolean
 *   onOpenChange   — (bool) => void
 *   canComment     — boolean (default false) — show comment input
 *   canPostInternal — boolean (default false) — show internal toggle
 *   showToast      — (message, type?) => void
 *   extraActions   — optional JSX rendered below description (e.g. status update)
 */
export default function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
  canComment = false,
  canPostInternal = false,
  showToast,
  extraActions = null,
  focusComment = false,
}) {
  const [comments, setComments]             = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment]         = useState('');
  const [isInternal, setIsInternal]         = useState(false);
  const [posting, setPosting]               = useState(false);
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
    if (open && ticket) fetchComments();
    if (!open) { setNewComment(''); setIsInternal(false); }
  }, [open, ticket, fetchComments]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    if (open && focusComment && canComment) {
      setTimeout(() => commentInputRef.current?.focus(), 200);
    }
  }, [open, focusComment, canComment]);

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
      showToast?.('Failed to post comment', 'error');
    } finally { setPosting(false); }
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
            <Badge className={`text-xs font-semibold border-0 capitalize ${PRIORITY_STYLES[ticket.priority] || 'bg-slate-100 text-slate-500'}`}>
              {ticket.priority}
            </Badge>
            <Badge className={`text-xs font-semibold border-0 capitalize ${STATUS_STYLES[ticket.status] || 'bg-slate-100 text-slate-500'}`}>
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

          {/* Extra actions slot (status update, reassign, etc.) */}
          {extraActions && (
            <>
              <Separator />
              {extraActions}
            </>
          )}

          <Separator />

          {/* Comment thread */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Conversation {comments.length > 0 && `(${comments.length})`}
            </p>

            {commentsLoading ? (
              <p className="text-sm text-slate-400 animate-pulse">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className={`rounded-lg px-3 py-2.5 text-sm ${
                    c.is_internal
                      ? 'bg-amber-50 border border-amber-100'
                      : 'bg-slate-50 border border-slate-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {c.is_internal
                        ? <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                        : <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                      }
                      <span className="text-[11px] font-semibold text-slate-400">
                        {c.author_name
                          ? <><span className="text-slate-600">{c.author_name}</span> · </>
                          : null
                        }
                        {c.is_internal ? 'Internal note' : 'Public message'} · {formatDateTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.body}</p>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}

            {/* Reply form — only shown when canComment=true */}
            {canComment && (
              <form onSubmit={handlePostComment} className="space-y-2 mt-3">
                <Textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a reply…"
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  {canPostInternal ? (
                    <Button type="button" variant={isInternal ? 'secondary' : 'outline'} size="sm"
                      onClick={() => setIsInternal(!isInternal)}
                      className={`gap-1.5 cursor-pointer font-semibold text-xs transition-colors ${
                        isInternal
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {isInternal
                        ? <><Lock className="h-3 w-3" /> Internal Note</>
                        : <><Globe className="h-3 w-3" /> Public</>
                      }
                    </Button>
                  ) : <span />}
                  <Button type="submit" size="sm" disabled={posting || !newComment.trim()}
                    className="bg-[#1A9F52] hover:bg-[#158a45] text-white gap-1.5 font-semibold cursor-pointer disabled:cursor-not-allowed">
                    <Send className="h-3.5 w-3.5" />
                    {posting ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
