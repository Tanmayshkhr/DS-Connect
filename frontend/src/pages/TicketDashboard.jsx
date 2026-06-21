import React, { useState, useMemo } from 'react';
import { Agentation } from "agentation";
import {
  Search, Bell, LayoutDashboard, Ticket,
  Settings, Filter, MoreHorizontal, MessageSquare, Clock, AlertCircle, X
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialTickets = [
  { id: "TKT-042", subject: "SAP Transaction execution delay", requester: "Zaheer Khan", dept: "Finance", priority: "High", status: "Open", time: "2 hours ago", type: "unassigned" },
  { id: "TKT-043", subject: "Unable to access VPN from home network", requester: "Abhishek Singh", dept: "IT", priority: "Medium", status: "Open", time: "3 hours ago", type: "mine" },
  { id: "TKT-044", subject: "Request for Adobe CC License Allocation", requester: "Deepika Padukone", dept: "IT", priority: "Low", status: "Resolved", time: "1 day ago", type: "mine" },
  { id: "TKT-045", subject: "Payroll portal showing 502 error", requester: "Navdeep Saini", dept: "HR", priority: "High", status: "Overdue", time: "2 days ago", type: "unassigned" },
  { id: "TKT-046", subject: "Hardware Access: Broken laptop screen", requester: "Manish Pandey", dept: "Operations", priority: "High", status: "Open", time: "5 hours ago", type: "unassigned" },
  { id: "TKT-047", subject: "Need access strings for IT security console", requester: "Suryakumar Yadav", dept: "Operations", priority: "Medium", status: "Resolved", time: "3 days ago", type: "mine" },
];

export default function TicketDashboard() {
  const [activeMenu, setActiveMenu] = useState('tickets');
  const [currentTab, setCurrentTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState(initialTickets);
  const [newTicket, setNewTicket] = useState({ subject: '', requester: '', dept: '', priority: 'Medium' });

  const handleCreateTicket = (e) => {
    e.preventDefault();
    const created = {
      id: `TKT-0${tickets.length + 42}`,
      subject: newTicket.subject || "General IT Support Request",
      requester: newTicket.requester || "Current User",
      dept: newTicket.dept || "General",
      priority: newTicket.priority,
      status: "Open",
      time: "Just now",
      type: "mine"
    };
    setTickets([created, ...tickets]);
    setIsModalOpen(false);
    setNewTicket({ subject: '', requester: '', dept: '', priority: 'Medium' });
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch =
        ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.requester.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab =
        currentTab === 'all' ||
        (currentTab === 'unassigned' && ticket.type === 'unassigned') ||
        (currentTab === 'mine' && ticket.type === 'mine');

      return matchesSearch && matchesTab;
    });
  }, [tickets, searchQuery, currentTab]);

  return (
    <div className="flex h-screen bg-[#F4F7F5] font-sans overflow-hidden text-slate-800">

      <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <img src="/ds-logo.png" alt="DS Group Logo" className="h-9 w-9 object-contain" />
            <div className="ml-3 flex flex-col">
              <span className="font-bold text-slate-950 tracking-tight text-base leading-tight">DS CONNECT</span>
              <span className="text-[10px] font-semibold text-emerald-700 tracking-widest uppercase">Group Portal</span>
            </div>
          </div>

          <div className="px-4 py-6 space-y-1">
            <p className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Workspace Menu</p>

            <button onClick={() => setActiveMenu('dashboard')} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeMenu === 'dashboard' ? 'bg-secondary text-secondary-foreground' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              <LayoutDashboard className="h-4 w-4 mr-3 text-emerald-700" /> Dashboard
            </button>

            <button onClick={() => setActiveMenu('tickets')} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeMenu === 'tickets' ? 'bg-primary text-primary-foreground shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Ticket className="h-4 w-4 mr-3" /> Ticket Queue
              <span className={`ml-auto py-0.5 px-2 rounded-full text-[10px] font-bold ${activeMenu === 'tickets' ? 'bg-emerald-900 text-emerald-50' : 'bg-slate-100 text-slate-600'}`}>60</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
            <Settings className="h-4 w-4 mr-3 text-slate-400" /> Settings
          </button>
          <div className="mt-4 flex items-center px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div className="h-9 w-9 rounded-full bg-emerald-900 text-emerald-50 flex items-center justify-center font-bold text-sm">
              TS
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">Tanmay Shekhar</p>
              <p className="text-xs text-emerald-700 font-medium truncate">System Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        <header className="h-16 bg-white border-b border-emerald-100 flex items-center justify-between px-8 shrink-0">
          <div className="text-lg font-bold text-emerald-900 tracking-tight uppercase">
            {activeMenu === 'tickets' ? 'Ticket Management' : 'Analytics Overview'}
          </div>

          <div className="flex items-center space-x-6">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, issue or employee..."
                className="pl-9 bg-slate-50/80 border-slate-200 h-9 text-sm focus-visible:ring-emerald-600 focus-visible:bg-white transition-all"
              />
            </div>
            <button className="relative p-1.5 text-slate-400 hover:text-emerald-800 transition-colors rounded-full hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <Card className="border-emerald-100/60 shadow-sm rounded-xl bg-white">
              <CardContent className="p-5 flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Active</p>
                  <h3 className="text-2xl font-bold text-slate-900">{tickets.length}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100/60 shadow-sm rounded-xl bg-white">
              <CardContent className="p-5 flex items-center space-x-4">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unassigned</p>
                  <h3 className="text-2xl font-bold text-slate-900">{tickets.filter(t => t.type === 'unassigned').length}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100/60 shadow-sm rounded-xl bg-white">
              <CardContent className="p-5 flex items-center space-x-4">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SLA Breaches</p>
                  <h3 className="text-2xl font-bold text-rose-600">2</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100/60 shadow-sm rounded-xl bg-white">
              <CardContent className="p-5 flex items-center space-x-4">
                <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Response</p>
                  <h3 className="text-2xl font-bold text-slate-900">1.8h</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-emerald-100/80 shadow-sm rounded-xl overflow-hidden bg-white">
            <div className="border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white">

              <div className="flex border-b sm:border-0 border-slate-100 pb-2 sm:pb-0 space-x-6">
                {['all', 'unassigned', 'mine'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCurrentTab(tab)}
                    className={`text-sm font-semibold tracking-tight pb-2 capitalize transition-all border-b-2 ${
                      currentTab === tab
                        ? 'border-emerald-800 text-emerald-900 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab === 'all' ? 'All Tickets' : tab === 'mine' ? 'Assigned to Me' : 'Unassigned'}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" className="h-8 text-slate-600 border-slate-200 hover:bg-slate-50">
                  <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /> Filter View
                </Button>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  size="sm"
                  className="h-8 bg-emerald-800 text-white hover:bg-emerald-900 shadow-sm transition-all"
                >
                  + Create Ticket
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="w-[110px] font-bold text-slate-400 uppercase text-[11px] tracking-wider">ID</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[11px] tracking-wider">Issue Description</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[11px] tracking-wider">Requester</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[11px] tracking-wider">Dept</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[11px] tracking-wider">Priority</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[11px] tracking-wider text-right">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-emerald-50/30 border-slate-100 transition-colors group">
                        <TableCell className="font-semibold text-emerald-900">{ticket.id}</TableCell>
                        <TableCell>
                          <p className="text-slate-900 font-medium truncate max-w-[280px]">{ticket.subject}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ticket.time}</p>
                        </TableCell>
                        <TableCell className="text-slate-600 font-medium text-sm">{ticket.requester}</TableCell>
                        <TableCell className="text-slate-500 text-sm">{ticket.dept}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-bold border-0 shadow-none px-2 py-0.5 rounded ${
                            ticket.priority === 'High' ? 'bg-rose-50 text-rose-700' :
                            ticket.priority === 'Medium' ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={`font-bold border-0 shadow-none px-2 py-0.5 rounded ${
                            ticket.status === 'Open' ? 'bg-emerald-100 text-emerald-800' :
                            ticket.status === 'Overdue' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-400 font-medium">
                        No operational records match your current query or filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-xl border border-emerald-100 w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base tracking-tight">File Corporate Ticket</h3>
                <p className="text-xs text-emerald-100">DS Group Internal Ticketing Pipeline</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-100 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Issue / Subject</label>
                <Input
                  required
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  placeholder="e.g. Printer connection error on 3rd floor"
                  className="focus-visible:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Name</label>
                  <Input
                    required
                    value={newTicket.requester}
                    onChange={(e) => setNewTicket({...newTicket, requester: e.target.value})}
                    placeholder="e.g. Rohit Sharma"
                    className="focus-visible:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
                  <Input
                    required
                    value={newTicket.dept}
                    onChange={(e) => setNewTicket({...newTicket, dept: e.target.value})}
                    placeholder="e.g. Production"
                    className="focus-visible:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Severity / Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-all"
                >
                  <option value="Low">Low - Informational</option>
                  <option value="Medium">Medium - Standard Operations</option>
                  <option value="High">High - Production Critical</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="h-9">Cancel</Button>
                <Button type="submit" className="h-9 bg-emerald-800 text-white hover:bg-emerald-900 px-5">Submit Ticket</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === "development" && <Agentation />}
    </div>
  );
}
