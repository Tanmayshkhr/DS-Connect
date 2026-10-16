import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Building2, Plus, ArrowLeft, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listDepartments, createDepartment, deleteDepartment, updateProfile } from '../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100
        rounded-lg px-3 py-2.5 min-h-[38px]">
        {value || <span className="text-slate-400 italic">Not set</span>}
      </p>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ user, departments, logout, isSysAdmin, showToast }) {
  const deptName = departments.find((d) => d.id === user?.department_id)?.name;

  const [editName, setEditName]       = useState(user?.name || '');
  const [editDeptId, setEditDeptId]   = useState(user?.department_id || '');
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');

  const ROLE_LABELS = {
    employee:     'Employee',
    resolver:     'Resolver',
    dept_admin:   'Department Admin',
    system_admin: 'System Admin',
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!editName.trim()) { setSaveError('Name cannot be empty.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = { name: editName.trim() };
      if (isSysAdmin) payload.department_id = editDeptId || null;
      await updateProfile(payload);
      showToast('Profile updated');
    } catch (err) {
      setSaveError(err?.response?.data?.detail || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm px-6 py-5 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
          <div className="h-10 w-10 rounded-full bg-[#1A9F52] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{user?.name || 'No name set'}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        {isSysAdmin ? (
          /* ── Editable form for system admin ── */
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                htmlFor="profile-name">Full Name</label>
              <Input
                id="profile-name"
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setSaveError(''); }}
                placeholder="Your full name"
                className="focus-visible:ring-[#1A9F52]"
              />
            </div>

            <Field label="Email" value={user?.email} />

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                htmlFor="profile-dept">Department</label>
              <select
                id="profile-dept"
                value={editDeptId}
                onChange={(e) => setEditDeptId(e.target.value)}
                className="w-full text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200
                  rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A9F52]
                  focus:border-transparent transition-shadow"
              >
                <option value="">— Not set —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</p>
              <div>
                <Badge className="bg-emerald-100 text-emerald-800 border-0 font-semibold capitalize">
                  {ROLE_LABELS[user?.role] || user?.role}
                </Badge>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-rose-500 font-medium">{saveError}</p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 cursor-pointer font-semibold bg-[#1A9F52] hover:bg-[#158a45]
                  text-white disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={logout}
                className="gap-2 cursor-pointer font-semibold text-rose-600 border-rose-200
                  hover:bg-rose-50 hover:border-rose-300 ml-auto"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </form>
        ) : (
          /* ── Editable name + read-only dept/role for all other users ── */
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                htmlFor="profile-name">Full Name</label>
              <Input
                id="profile-name"
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setSaveError(''); }}
                placeholder="Your full name"
                className="focus-visible:ring-[#1A9F52]"
              />
            </div>

            <Field label="Email"      value={user?.email} />
            <Field label="Department" value={deptName} />

            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</p>
              <div>
                <Badge className="bg-emerald-100 text-emerald-800 border-0 font-semibold capitalize">
                  {ROLE_LABELS[user?.role] || user?.role}
                </Badge>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-rose-500 font-medium">{saveError}</p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 cursor-pointer font-semibold bg-[#1A9F52] hover:bg-[#158a45]
                  text-white disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save name'}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={logout}
                className="gap-2 cursor-pointer font-semibold text-rose-600 border-rose-200
                  hover:bg-rose-50 hover:border-rose-300 ml-auto"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Departments Tab (system_admin only) ───────────────────────────────────────

function DepartmentsTab({ showToast }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [name, setName]               = useState('');
  const [adding, setAdding]           = useState(false);
  const [error, setError]             = useState('');
  // confirmId: the dept id currently pending deletion (null = no dialog open)
  const [confirmId, setConfirmId]     = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try { setDepartments(await listDepartments()); }
    catch { setDepartments([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Department name is required.'); return; }
    setAdding(true);
    setError('');
    try {
      await createDepartment({ name: name.trim() });
      setName('');
      showToast('Department created');
      fetchDepts();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create department.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDepartment(confirmId);
      setConfirmId(null);
      showToast('Department deleted');
      fetchDepts();
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || 'Failed to delete department.');
    } finally {
      setDeleting(false);
    }
  }

  const confirmTarget = departments.find((d) => d.id === confirmId);

  return (
    <div className="max-w-xl space-y-6">
      {/* Add form */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm px-6 py-5">
        <p className="text-sm font-bold text-slate-800 mb-4">Add Department</p>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Department name"
            className="flex-1 focus-visible:ring-[#1A9F52]"
          />
          <Button
            type="submit"
            disabled={adding}
            className="bg-[#1A9F52] hover:bg-[#158a45] active:bg-[#126e38] text-white
              font-semibold gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </form>
        {error && (
          <p className="text-xs text-rose-500 mt-2 font-medium">{error}</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            All Departments
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : departments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No departments yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    id={`delete-dept-${d.id}`}
                    onClick={() => { setConfirmId(d.id); setDeleteError(''); }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50
                      transition-colors cursor-pointer"
                    title={`Delete ${d.name}`}
                    aria-label={`Delete department ${d.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Delete department?</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{confirmTarget?.name}</span> will be
                  permanently removed. This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg
                px-3 py-2 font-medium leading-snug">
                {deleteError}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button
                id="cancel-delete-dept"
                variant="outline"
                size="sm"
                onClick={() => { setConfirmId(null); setDeleteError(''); }}
                disabled={deleting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                id="confirm-delete-dept"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold
                  cursor-pointer disabled:cursor-not-allowed gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3
      rounded-xl shadow-lg text-sm font-medium bg-[#1A9F52] text-white">
      {message}
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 cursor-pointer">\u2715</button>
    </div>
  );
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [toast, setToast]             = useState(null);

  const isSysAdmin = user?.role === 'system_admin';

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  function showToast(message) {
    setToast(message);
  }

  return (
    <div className="min-h-screen bg-[#F4F7F5]">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Settings
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 cursor-pointer font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {isSysAdmin ? (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="profile" className="cursor-pointer flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="departments" className="cursor-pointer flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Departments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <ProfileTab user={user} departments={departments} logout={logout} isSysAdmin={true} showToast={showToast} />
            </TabsContent>

            <TabsContent value="departments">
              <DepartmentsTab showToast={showToast} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-5 w-5 text-slate-400" />
              <h1 className="text-lg font-bold text-slate-800">Profile</h1>
            </div>
            <ProfileTab user={user} departments={departments} logout={logout} isSysAdmin={false} showToast={showToast} />
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
