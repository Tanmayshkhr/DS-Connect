import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
// Skip Authorization on public auth endpoints so a stale token never
// contaminates the OTP flow or causes misleading CORS errors in devtools.
const PUBLIC_AUTH_PATHS = ["/auth/request-otp", "/auth/verify-otp"];

api.interceptors.request.use((config) => {
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) =>
    config.url?.startsWith(path)
  );
  const token = localStorage.getItem("access_token");
  if (token && !isPublicAuthPath) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth (do NOT touch) ───────────────────────────────────────────────────────
export async function requestOtp(email) {
  const response = await api.post("/auth/request-otp", { email });
  return response.data;
}

export async function verifyOtp(email, otp) {
  const response = await api.post("/auth/verify-otp", { email, otp });
  return response.data;
}

// ── Users ─────────────────────────────────────────────────────────────────────

/** GET /users/me — returns the current authenticated user */
export async function getMe() {
  const response = await api.get("/users/me");
  return response.data;
}

/**
 * PATCH /users/me — update the current user's own name and/or department
 * @param {{ name?: string, department_id?: string|null }} body
 */
export async function updateProfile(body) {
  const response = await api.patch("/users/me", body);
  return response.data;
}

/**
 * GET /users/ — list all users (system_admin only)
 * @param {{ role?: string, department_id?: string }} [params]
 */
export async function listUsers(params = {}) {
  const response = await api.get("/users/", { params });
  return response.data;
}

export async function listResolvers(departmentId) {
  const response = await api.get("/users/resolvers", {
    params: { department_id: departmentId },
  });
  return response.data;
}

/**
 * PATCH /users/{user_id}/role — update a user's role (system_admin only)
 * @param {string} userId
 * @param {{ role: string, department_id?: string }} body
 */
export async function updateUserRole(userId, body) {
  const response = await api.patch(`/users/${userId}/role`, body);
  return response.data;
}

/**
 * PATCH /users/{user_id}/deactivate — deactivate a user (system_admin only)
 * @param {string} userId
 */
export async function deactivateUser(userId) {
  const response = await api.patch(`/users/${userId}/deactivate`);
  return response.data;
}

/**
 * PATCH /users/{user_id}/onboard — assign role + department to a new user (system_admin only)
 * @param {string} userId
 * @param {{ role: string, department_id: string }} body
 */
export async function onboardUser(userId, body) {
  const response = await api.patch(`/users/${userId}/onboard`, body);
  return response.data;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

/**
 * POST /tickets/ — raise a new ticket (any authenticated user)
 * @param {{ title: string, description: string, category: string, priority: string, department_id: string }} body
 */
export async function createTicket(body) {
  const response = await api.post("/tickets/", body);
  return response.data;
}

/**
 * GET /tickets/ — list tickets (role-filtered by backend)
 * @param {{ status?: string, priority?: string, category?: string }} [params]
 */
export async function listTickets(params = {}) {
  const response = await api.get("/tickets/", { params });
  return response.data;
}

/**
 * GET /tickets/{ticket_id} — get a single ticket (role-checked)
 * @param {string} ticketId
 */
export async function getTicket(ticketId) {
  const response = await api.get(`/tickets/${ticketId}`);
  return response.data;
}

/**
 * PATCH /tickets/{ticket_id}/status — update ticket status
 * (resolver, dept_admin, system_admin)
 * @param {string} ticketId
 * @param {string} status — one of: open | assigned | in_progress | resolved | closed
 */
export async function updateTicketStatus(ticketId, status) {
  const response = await api.patch(`/tickets/${ticketId}/status`, { status });
  return response.data;
}

/**
 * PATCH /tickets/{ticket_id}/assign — assign a resolver to a ticket
 * (dept_admin, system_admin)
 * @param {string} ticketId
 * @param {string} resolverId
 */
export async function assignTicket(ticketId, resolverId) {
  const response = await api.patch(`/tickets/${ticketId}/assign`, {
    resolver_id: resolverId,
  });
  return response.data;
}

/**
 * POST /tickets/{ticket_id}/comments — add a comment to a ticket
 * @param {string} ticketId
 * @param {{ body: string, is_internal?: boolean }} commentBody
 */
export async function addComment(ticketId, commentBody) {
  const response = await api.post(`/tickets/${ticketId}/comments`, commentBody);
  return response.data;
}

/**
 * GET /tickets/{ticket_id}/comments — list comments for a ticket
 * @param {string} ticketId
 */
export async function listComments(ticketId) {
  const response = await api.get(`/tickets/${ticketId}/comments`);
  return response.data;
}

/**
 * PATCH /tickets/{ticket_id}/delay — flag (or un-flag) a ticket as delayed
 * (resolver only, must be assigned to the ticket)
 * @param {string} ticketId
 * @param {{ is_delayed?: boolean, delay_reason: string }} body
 */
export async function flagTicketDelayed(ticketId, body) {
  const response = await api.patch(`/tickets/${ticketId}/delay`, body);
  return response.data;
}

// ── FAQs ──────────────────────────────────────────────────────────────────────

/**
 * POST /faqs/ — suggest a new FAQ (resolver only)
 * @param {{ question: string, answer: string, department_id: string, keywords?: string[] }} body
 */
export async function suggestFaq(body) {
  const response = await api.post("/faqs/", body);
  return response.data;
}

/**
 * GET /faqs/ — list FAQs (role-filtered by backend)
 */
export async function listFaqs() {
  const response = await api.get("/faqs/");
  return response.data;
}

/**
 * PATCH /faqs/{faq_id}/review — review a FAQ (dept_admin only)
 * @param {string} faqId
 * @param {{ notes?: string }} body
 */
export async function reviewFaq(faqId, body = {}) {
  const response = await api.patch(`/faqs/${faqId}/review`, body);
  return response.data;
}

/**
 * PATCH /faqs/{faq_id}/approve — approve/publish a FAQ (system_admin only)
 * @param {string} faqId
 */
export async function approveFaq(faqId) {
  const response = await api.patch(`/faqs/${faqId}/approve`);
  return response.data;
}

/**
 * PATCH /faqs/{faq_id}/reject — reject a FAQ (dept_admin or system_admin)
 * @param {string} faqId
 * @param {{ reason?: string }} body
 */
export async function rejectFaq(faqId, body = {}) {
  const response = await api.patch(`/faqs/${faqId}/reject`, body);
  return response.data;
}

// ── Departments ───────────────────────────────────────────────────────────────

/**
 * GET /departments/ — list all departments (all authenticated roles)
 */
export async function listDepartments() {
  const response = await api.get("/departments/");
  return response.data;
}

/**
 * POST /departments/ — create a department (system_admin only)
 * @param {{ name: string }} body
 */
export async function createDepartment(body) {
  const response = await api.post("/departments/", body);
  return response.data;
}

/**
 * PATCH /departments/{dept_id} — update a department (system_admin only)
 * @param {string} deptId
 * @param {{ name?: string, admin_id?: string }} body
 */
export async function updateDepartment(deptId, body) {
  const response = await api.patch(`/departments/${deptId}`, body);
  return response.data;
}

/**
 * DELETE /departments/{dept_id} — delete a department (system_admin only)
 * Returns 204 No Content on success.
 * Throws HTTP 400 if the department still has users or tickets assigned to it.
 * @param {string} deptId
 */
export async function deleteDepartment(deptId) {
  await api.delete(`/departments/${deptId}`);
}

/**
 * GET /departments/{dept_id}/stats — department ticket stats
 * (dept_admin, system_admin)
 * @param {string} deptId
 */
export async function getDepartmentStats(deptId) {
  const response = await api.get(`/departments/${deptId}/stats`);
  return response.data;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * GET /analytics/summary — high-level counts
 * (dept_admin, system_admin)
 */
export async function getAnalyticsSummary() {
  const response = await api.get("/analytics/summary");
  return response.data;
}

/**
 * GET /analytics/by-category — ticket counts grouped by category
 * (dept_admin, system_admin)
 */
export async function getAnalyticsByCategory() {
  const response = await api.get("/analytics/by-category");
  return response.data;
}

/**
 * GET /analytics/by-priority — ticket counts grouped by priority
 * (dept_admin, system_admin)
 */
export async function getAnalyticsByPriority() {
  const response = await api.get("/analytics/by-priority");
  return response.data;
}

/**
 * GET /analytics/by-department — ticket counts per department
 * (system_admin only)
 */
export async function getAnalyticsByDepartment() {
  const response = await api.get("/analytics/by-department");
  return response.data;
}

/**
 * GET /analytics/resolver-performance — per-resolver resolved/in-progress counts
 * (dept_admin, system_admin)
 */
export async function getResolverPerformance() {
  const response = await api.get("/analytics/resolver-performance");
  return response.data;
}

/**
 * GET /analytics/trend — tickets created & resolved per day for the last N days
 * (dept_admin, system_admin)
 * @param {number} [days=7]
 */
export async function getAnalyticsTrend(days = 7) {
  const response = await api.get("/analytics/trend", { params: { days } });
  return response.data;
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

/**
 * GET /audit-logs/ — list recent audit log entries (role-scoped by backend)
 * @param {{ entity_id?: string, limit?: number }} [params]
 */
export async function listAuditLogs(params = {}) {
  const response = await api.get("/audit-logs/", { params });
  return response.data;
}

/**
 * GET /audit-logs/?entity_id={ticketId} — all audit entries for a specific ticket
 * @param {string} ticketId
 */
export async function getTicketAuditLogs(ticketId) {
  const response = await api.get("/audit-logs/", { params: { entity_id: ticketId, limit: 100 } });
  return response.data;
}

export default api;
