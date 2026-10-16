import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Clock3,
  CheckCircle2,
  RefreshCw,
  Timer,
  Ticket,
  AlertTriangle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import {
  getAnalyticsByCategory,
  getAnalyticsByDepartment,
  getAnalyticsByPriority,
  getAnalyticsSummary,
  listDepartments,
  listTickets,
} from '../lib/api';
import { formatDate, parseUTCDate, relativeTime } from '../lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const DS_GREEN = '#1A9F52';
const DS_GREEN_DARK = '#158a45';
const PENDING_STATUSES = new Set(['open', 'assigned', 'in_progress', 'overdue']);

const STATUS_STYLES = {
  open: 'bg-emerald-100 text-emerald-800',
  assigned: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  overdue: 'bg-rose-100 text-rose-700',
  resolved: 'bg-slate-100 text-slate-600',
  closed: 'bg-slate-200 text-slate-500',
};

const PRIORITY_STYLES = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
};

function titleCase(value) {
  if (!value) return 'Unassigned';
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hoursBetween(startIso, endIso) {
  const start = parseUTCDate(startIso);
  const end = parseUTCDate(endIso);
  if (!start || !end) return null;
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return hours >= 0 ? hours : null;
}

function formatHours(hours) {
  if (hours == null) return 'No data';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function averageBy(tickets, groupKey, departments = []) {
  const deptName = (id) => departments.find((d) => d.id === id)?.name || id || 'Unassigned';
  const groups = new Map();

  tickets.forEach((ticketItem) => {
    const hours = hoursBetween(ticketItem.created_at, ticketItem.resolved_at || ticketItem.closed_at);
    if (hours == null) return;

    const rawKey = groupKey === 'department'
      ? deptName(ticketItem.department_id)
      : ticketItem[groupKey];
    const name = titleCase(rawKey);
    const existing = groups.get(name) || { name, total: 0, count: 0 };
    groups.set(name, { ...existing, total: existing.total + hours, count: existing.count + 1 });
  });

  return Array.from(groups.values())
    .map((group) => ({
      name: group.name,
      hours: Number((group.total / group.count).toFixed(1)),
      display: formatHours(group.total / group.count),
    }))
    .sort((a, b) => b.hours - a.hours);
}

function KpiCard({ label, value, icon: Icon, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800',
    slate: 'bg-slate-100 text-slate-600',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <Card className="border-slate-100 shadow-sm bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="border-slate-100 shadow-sm bg-white">
      <CardContent className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="h-72">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
      {label}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSystemAdmin = user?.role === 'system_admin';

  const [summary, setSummary] = useState(null);
  const [categoryVolume, setCategoryVolume] = useState([]);
  const [departmentVolume, setDepartmentVolume] = useState([]);
  const [priorityVolume, setPriorityVolume] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        summaryData,
        categoryData,
        priorityData,
        ticketData,
        departmentData,
        departmentsData,
      ] = await Promise.all([
        getAnalyticsSummary(),
        getAnalyticsByCategory(),
        getAnalyticsByPriority(),
        listTickets(),
        isSystemAdmin ? getAnalyticsByDepartment() : Promise.resolve([]),
        isSystemAdmin ? listDepartments() : Promise.resolve([]),
      ]);

      setSummary(summaryData);
      setCategoryVolume(categoryData.map((item) => ({ ...item, name: titleCase(item.name) })));
      setPriorityVolume(priorityData.map((item) => ({ ...item, name: titleCase(item.name) })));
      setTickets(ticketData);
      setDepartmentVolume(departmentData);
      setDepartments(departmentsData);
    } catch {
      setError('Unable to load analytics right now.');
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const pendingTickets = useMemo(() => (
    tickets
      .filter((ticketItem) => PENDING_STATUSES.has(ticketItem.status))
      .sort((a, b) => {
        const aDate = parseUTCDate(a.created_at)?.getTime() || 0;
        const bDate = parseUTCDate(b.created_at)?.getTime() || 0;
        return aDate - bDate;
      })
      .slice(0, 8)
  ), [tickets]);

  const overdueCount = useMemo(() => (
    tickets.filter((ticketItem) => ticketItem.status === 'overdue').length
  ), [tickets]);

  const avgByCategory = useMemo(() => averageBy(tickets, 'category'), [tickets]);
  const avgByPriority = useMemo(() => averageBy(tickets, 'priority'), [tickets]);
  const avgByDepartment = useMemo(() => averageBy(tickets, 'department', departments), [tickets, departments]);
  const avgResolutionHours = useMemo(() => {
    const resolvedHours = tickets
      .map((ticketItem) => hoursBetween(ticketItem.created_at, ticketItem.resolved_at || ticketItem.closed_at))
      .filter((value) => value != null);
    if (!resolvedHours.length) return null;
    return resolvedHours.reduce((sum, value) => sum + value, 0) / resolvedHours.length;
  }, [tickets]);

  const volumeChart = isSystemAdmin ? departmentVolume : categoryVolume;
  const volumeKey = isSystemAdmin ? 'tickets' : 'value';

  return (
    <div className="min-h-screen bg-[#F4F7F5]">
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ds-logo.png" alt="DS Group" className="h-8 w-8 object-contain" />
          <span className="font-bold text-[#1A9F52] tracking-tight text-base">DS CONNECT</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Analytics</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="gap-1.5 cursor-pointer font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ticket volume, resolution speed, and pending work for your access scope.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Open Tickets" value={summary?.open_tickets ?? 0} icon={Ticket} />
          <KpiCard label="Resolved Tickets" value={summary?.resolved_tickets ?? 0} icon={CheckCircle2} tone="slate" />
          <KpiCard label="Overdue Tickets" value={overdueCount} icon={AlertTriangle} tone="rose" />
          <KpiCard label="Avg Resolution" value={formatHours(avgResolutionHours)} icon={Timer} tone="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard
            title={isSystemAdmin ? 'Ticket Volume by Department' : 'Ticket Volume by Category'}
            subtitle={isSystemAdmin ? 'Cross-department ticket distribution' : 'Department-scoped category distribution'}
          >
            {volumeChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeChart} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey={volumeKey} fill={DS_GREEN} radius={[6, 6, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={loading ? 'Loading chart data...' : 'No volume data available.'} />
            )}
          </ChartCard>

          <ChartCard title="Ticket Volume by Priority" subtitle="Priority mix across visible tickets">
            {priorityVolume.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityVolume} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="value" fill={DS_GREEN_DARK} radius={[6, 6, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={loading ? 'Loading chart data...' : 'No priority data available.'} />
            )}
          </ChartCard>
        </div>

        <ChartCard title="Average Resolution Time" subtitle="Resolved and closed tickets grouped by category, priority, and department">
          {avgByCategory.length || avgByPriority.length || avgByDepartment.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                ...avgByCategory.map((item) => ({ ...item, group: `Category: ${item.name}` })),
                ...avgByPriority.map((item) => ({ ...item, group: `Priority: ${item.name}` })),
                ...(isSystemAdmin ? avgByDepartment.map((item) => ({ ...item, group: `Dept: ${item.name}` })) : []),
              ]} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="group" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={72} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [formatHours(value), 'Avg resolution']} cursor={{ fill: '#F1F5F9' }} />
                <Legend />
                <Bar dataKey="hours" fill={DS_GREEN} radius={[6, 6, 0, 0]} name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={loading ? 'Loading resolution data...' : 'No resolved ticket timing available.'} />
          )}
        </ChartCard>

        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#1A9F52]" />
                  Oldest Pending Tickets
                </h2>
                <p className="text-xs text-slate-400 mt-1">Open, assigned, in-progress, and overdue tickets sorted by age.</p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {pendingTickets.length} shown
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm animate-pulse">Loading pending tickets...</div>
            ) : pendingTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">No pending tickets found.</div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    {['Title', 'Category', 'Priority', 'Status', 'Raised On', 'Age'].map((heading) => (
                      <TableHead key={heading} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTickets.map((ticketItem) => (
                    <TableRow key={ticketItem.id} className="border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-medium text-slate-800 max-w-[280px] truncate">{ticketItem.title}</TableCell>
                      <TableCell className="text-slate-500 text-sm capitalize">{ticketItem.category}</TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] font-semibold border-0 capitalize ${PRIORITY_STYLES[ticketItem.priority] || 'bg-slate-100 text-slate-500'}`}>
                          {ticketItem.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] font-semibold border-0 capitalize ${STATUS_STYLES[ticketItem.status] || 'bg-slate-100 text-slate-500'}`}>
                          {ticketItem.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">{formatDate(ticketItem.created_at)}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{relativeTime(ticketItem.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['By Category', avgByCategory],
            ['By Priority', avgByPriority],
            ...(isSystemAdmin ? [['By Department', avgByDepartment]] : []),
          ].map(([title, rows]) => (
            <Card key={title} className="border-slate-100 shadow-sm bg-white">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#1A9F52]" />
                  {title}
                </h2>
                <div className="space-y-2">
                  {rows.length ? rows.slice(0, 5).map((row) => (
                    <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 truncate">{row.name}</span>
                      <span className="font-semibold text-slate-800">{row.display}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-400">No timing data available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
