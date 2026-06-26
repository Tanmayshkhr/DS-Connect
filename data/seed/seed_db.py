"""
seed_db.py — Idempotent seed script for DS Connect.

Drops and recreates: departments, users, tickets, comments, faqs, audit_logs.
Run:  python data/seed/seed_db.py
"""

import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import MongoClient

# ── Connection ───────────────────────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "ds_connect"          # must match database.py exactly

# ── Helpers ──────────────────────────────────────────────────────────────────

def oid(s: str | None = None) -> ObjectId:
    """Return a new ObjectId (or wrap a string if given)."""
    return ObjectId(s) if s else ObjectId()


def dt(days_ago: float, base: datetime | None = None) -> datetime:
    """Return a UTC datetime N days before `base` (default: now)."""
    base = base or datetime.now(timezone.utc)
    return base - timedelta(days=days_ago)


def rand_dt_between(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.uniform(0, delta.total_seconds()))


# ── Static IDs (strings — converted to ObjectId when inserted) ───────────────

DEPT_IT  = oid()
DEPT_HR  = oid()
DEPT_FIN = oid()
DEPT_OPS = oid()

# System admin
SYS_ADMIN = oid()

# Dept admins (one per dept)
DA_IT  = oid()
DA_HR  = oid()
DA_FIN = oid()
DA_OPS = oid()

# Resolvers (two per dept)
RES_IT_1, RES_IT_2   = oid(), oid()
RES_HR_1, RES_HR_2   = oid(), oid()
RES_FIN_1, RES_FIN_2 = oid(), oid()
RES_OPS_1, RES_OPS_2 = oid(), oid()

RESOLVERS_BY_DEPT = {
    DEPT_IT:  [RES_IT_1,  RES_IT_2],
    DEPT_HR:  [RES_HR_1,  RES_HR_2],
    DEPT_FIN: [RES_FIN_1, RES_FIN_2],
    DEPT_OPS: [RES_OPS_1, RES_OPS_2],
}

DEPT_ADMINS = {
    DEPT_IT:  DA_IT,
    DEPT_HR:  DA_HR,
    DEPT_FIN: DA_FIN,
    DEPT_OPS: DA_OPS,
}

ALL_DEPTS = [DEPT_IT, DEPT_HR, DEPT_FIN, DEPT_OPS]

# ── Departments ───────────────────────────────────────────────────────────────

DEPARTMENTS = [
    {"_id": DEPT_IT,  "name": "Information Technology", "code": "IT",  "is_active": True, "created_at": dt(90)},
    {"_id": DEPT_HR,  "name": "Human Resources",        "code": "HR",  "is_active": True, "created_at": dt(90)},
    {"_id": DEPT_FIN, "name": "Finance & Accounts",     "code": "FIN", "is_active": True, "created_at": dt(90)},
    {"_id": DEPT_OPS, "name": "Operations & Logistics", "code": "OPS", "is_active": True, "created_at": dt(90)},
]

# ── Users ─────────────────────────────────────────────────────────────────────

_now = datetime.now(timezone.utc)

USERS = [
    # System admin
    {"_id": SYS_ADMIN, "email": "tanmay.shekhar@dsgroup.com",  "name": "Tanmay Shekhar",     "role": "system_admin", "department_id": DEPT_IT,  "is_active": True, "created_at": dt(90)},
    # Dept admins
    {"_id": DA_IT,  "email": "it.admin@dsgroup.com",           "name": "Aakash Mehta",        "role": "dept_admin",   "department_id": DEPT_IT,  "is_active": True, "created_at": dt(85)},
    {"_id": DA_HR,  "email": "hr.admin@dsgroup.com",           "name": "Vikram Malhotra",     "role": "dept_admin",   "department_id": DEPT_HR,  "is_active": True, "created_at": dt(85)},
    {"_id": DA_FIN, "email": "fin.admin@dsgroup.com",          "name": "Sanjay Kapoor",       "role": "dept_admin",   "department_id": DEPT_FIN, "is_active": True, "created_at": dt(85)},
    {"_id": DA_OPS, "email": "ops.admin@dsgroup.com",          "name": "Rajesh Verma",        "role": "dept_admin",   "department_id": DEPT_OPS, "is_active": True, "created_at": dt(85)},
    # Resolvers
    {"_id": RES_IT_1,  "email": "it.resolver1@dsgroup.com",    "name": "Amit Patel",          "role": "resolver",     "department_id": DEPT_IT,  "is_active": True, "created_at": dt(80)},
    {"_id": RES_IT_2,  "email": "it.resolver2@dsgroup.com",    "name": "Karan Joshi",         "role": "resolver",     "department_id": DEPT_IT,  "is_active": True, "created_at": dt(80)},
    {"_id": RES_HR_1,  "email": "hr.resolver1@dsgroup.com",    "name": "Simran Kaur",         "role": "resolver",     "department_id": DEPT_HR,  "is_active": True, "created_at": dt(80)},
    {"_id": RES_HR_2,  "email": "hr.resolver2@dsgroup.com",    "name": "Rahul Aneja",         "role": "resolver",     "department_id": DEPT_HR,  "is_active": True, "created_at": dt(80)},
    {"_id": RES_FIN_1, "email": "fin.resolver1@dsgroup.com",   "name": "Nitin Goel",          "role": "resolver",     "department_id": DEPT_FIN, "is_active": True, "created_at": dt(80)},
    {"_id": RES_FIN_2, "email": "fin.resolver2@dsgroup.com",   "name": "Preeti Shah",         "role": "resolver",     "department_id": DEPT_FIN, "is_active": True, "created_at": dt(80)},
    {"_id": RES_OPS_1, "email": "ops.resolver1@dsgroup.com",   "name": "Manoj Tiwari",        "role": "resolver",     "department_id": DEPT_OPS, "is_active": True, "created_at": dt(80)},
    {"_id": RES_OPS_2, "email": "ops.resolver2@dsgroup.com",   "name": "Deepak Punia",        "role": "resolver",     "department_id": DEPT_OPS, "is_active": True, "created_at": dt(80)},
]

# 50 employees spread across depts
_EMP_NAMES = [
    ("Abhishek Singh", DEPT_IT), ("Bhavna Gupta", DEPT_IT), ("Chirag Paswan", DEPT_IT),
    ("Deepika Mehra", DEPT_IT), ("Esha Deol", DEPT_IT), ("Farhan Akhtar", DEPT_IT),
    ("Gautam Das", DEPT_IT), ("Hardik Shah", DEPT_IT), ("Ishant Sharma", DEPT_IT),
    ("Jasprit Bumrah", DEPT_IT), ("Krunal Pandya", DEPT_IT), ("Lokesh Rahul", DEPT_IT),
    ("Manish Pandey", DEPT_IT),
    ("Navdeep Saini", DEPT_HR), ("Omprakash Mishra", DEPT_HR), ("Piyush Chawla", DEPT_HR),
    ("Quinton DeKock", DEPT_HR), ("Rishabh Pant", DEPT_HR), ("Shreyas Iyer", DEPT_HR),
    ("T Natarajan", DEPT_HR), ("Umesh Yadav", DEPT_HR), ("Varun Chakravarthy", DEPT_HR),
    ("Washington Sundar", DEPT_HR), ("Yuzvendra Chahal", DEPT_HR), ("Zaheer Khan", DEPT_HR),
    ("Ajinkya Rahane", DEPT_FIN), ("Bhuvneshwar Kumar", DEPT_FIN), ("Cheteshwar Pujara", DEPT_FIN),
    ("Deepak Chahar", DEPT_FIN), ("Hanuma Vihari", DEPT_FIN), ("Kuldeep Yadav", DEPT_FIN),
    ("Mohammed Siraj", DEPT_FIN), ("Ravichandran Ashwin", DEPT_FIN), ("Shardul Thakur", DEPT_FIN),
    ("Wriddhiman Saha", DEPT_FIN), ("Axar Patel", DEPT_FIN), ("Prithvi Shaw", DEPT_FIN),
    ("Suryakumar Yadav", DEPT_FIN),
    ("Ishan Kishan", DEPT_OPS), ("Devdutt Padikkal", DEPT_OPS), ("Harshal Patel", DEPT_OPS),
    ("Avesh Khan", DEPT_OPS), ("Venkatesh Iyer", DEPT_OPS), ("Ravi Bishnoi", DEPT_OPS),
    ("Deepak Hooda", DEPT_OPS), ("Arshdeep Singh", DEPT_OPS), ("Umran Malik", DEPT_OPS),
    ("Ruturaj Gaikwad", DEPT_OPS), ("Rahul Tripathi", DEPT_OPS), ("Sanju Samson", DEPT_OPS),
]

EMPLOYEE_IDS_BY_DEPT: dict[ObjectId, list[ObjectId]] = {d: [] for d in ALL_DEPTS}

for i, (name, dept) in enumerate(_EMP_NAMES, start=1):
    emp_id = oid()
    EMPLOYEE_IDS_BY_DEPT[dept].append(emp_id)
    first = name.split()[0].lower()
    USERS.append({
        "_id": emp_id,
        "email": f"emp{i:02d}@dsgroup.com",
        "name": name,
        "role": "employee",
        "department_id": dept,
        "is_active": True,
        "created_at": dt(random.randint(30, 80)),
    })

ALL_EMPLOYEES = [u["_id"] for u in USERS if u["role"] == "employee"]

# ── Tickets ───────────────────────────────────────────────────────────────────

CATEGORIES   = ["technical", "hr", "finance", "admin", "general"]
PRIORITIES   = ["low", "medium", "high", "critical"]
OPEN_STATUSES = ["open", "in_progress"]
DONE_STATUSES = ["resolved", "closed"]

_TITLES = {
    "technical":  ["VPN access not working", "Laptop not booting up", "Email sync failure",
                   "Software license expired", "Printer not responding on network"],
    "hr":         ["Leave balance discrepancy", "Onboarding docs missing", "PF not updated",
                   "Transfer request pending", "Payslip not generated for last month"],
    "finance":    ["Reimbursement not processed", "Invoice approval delay", "Petty cash mismatch",
                   "GST filing clarification needed", "Vendor payment stuck"],
    "admin":      ["Desk allocation issue", "ID card not received", "Parking sticker expired",
                   "Cafeteria access blocked", "Visitor policy query"],
    "general":    ["Need ergonomic chair", "AC not working in meeting room",
                   "Projector bulb fused", "Wi-Fi slow on 3rd floor", "Pantry supplies running low"],
}


def _make_tickets() -> list[dict]:
    tickets = []
    now = datetime.now(timezone.utc)

    for i in range(60):
        dept = random.choice(ALL_DEPTS)
        category = random.choice(CATEGORIES)
        status_pool = OPEN_STATUSES + DONE_STATUSES + DONE_STATUSES  # bias toward done
        status = random.choice(status_pool)

        created_days_ago = random.uniform(1, 29)
        created_at = now - timedelta(days=created_days_ago)

        resolved_at = None
        closed_at = None
        resolver_id = None

        if status in DONE_STATUSES:
            resolver_id = random.choice(RESOLVERS_BY_DEPT[dept])
            resolve_delta = timedelta(hours=random.uniform(2, 72))
            resolved_at = min(created_at + resolve_delta, now)
            if status == "closed":
                closed_at = resolved_at + timedelta(hours=random.uniform(1, 24))

        dept_employees = EMPLOYEE_IDS_BY_DEPT.get(dept) or ALL_EMPLOYEES
        title = random.choice(_TITLES.get(category, _TITLES["general"]))

        tickets.append({
            "_id": oid(),
            "title": title,
            "description": f"Employee reported: {title.lower()}. Requires prompt attention.",
            "category": category,
            "priority": random.choice(PRIORITIES),
            "status": status,
            "raised_by": random.choice(dept_employees),
            "department_id": dept,
            "assigned_to": resolver_id,          # correct field name per live schema
            "created_at": created_at,
            "updated_at": resolved_at or created_at,
            "resolved_at": resolved_at,
            "closed_at": closed_at,
        })

    return tickets


TICKETS = _make_tickets()

# ── Comments ──────────────────────────────────────────────────────────────────

_COMMENT_BODIES = [
    "Looking into this now, should have an update shortly.",
    "Reproduced the issue on my end — escalating to Tier 2.",
    "Please share a screenshot of the error message you are seeing.",
    "Issue has been fixed — please verify on your end and confirm.",
    "Workaround applied; permanent fix will be rolled out in the next patch.",
    "Checked the backend logs — no anomaly found. Monitoring further.",
    "Contacted the vendor for the license key — ETA 24 hours.",
    "Confirmed with the HR team. Records have been updated.",
    "Finance team has been notified; please allow 2–3 business days.",
    "Closing as resolved per user confirmation received over email.",
]


def _make_comments(tickets: list[dict]) -> list[dict]:
    comments = []
    done = [t for t in tickets if t["status"] in DONE_STATUSES]

    for ticket in done:
        num_comments = random.randint(2, 3)
        ticket_dept = ticket["department_id"]
        resolver = ticket["assigned_to"]
        dept_employees = EMPLOYEE_IDS_BY_DEPT.get(ticket_dept) or ALL_EMPLOYEES

        ticket_created = ticket["created_at"]
        ticket_resolved = ticket["resolved_at"] or datetime.now(timezone.utc)

        for j in range(num_comments):
            # First comment always from resolver, rest random
            author = resolver if j == 0 and resolver else random.choice(dept_employees)
            comment_time = rand_dt_between(ticket_created, ticket_resolved)
            comments.append({
                "_id": oid(),
                "ticket_id": ticket["_id"],
                "author_id": author,
                "content": random.choice(_COMMENT_BODIES),
                "is_internal": random.choice([True, False]),
                "created_at": comment_time,
            })

    return comments


COMMENTS = _make_comments(TICKETS)

# ── Audit Logs ────────────────────────────────────────────────────────────────

def _make_audit_logs(tickets: list[dict]) -> list[dict]:
    logs = []

    for ticket in tickets:
        # Log 1: ticket created
        logs.append({
            "_id": oid(),
            "ticket_id": ticket["_id"],
            "actor_id": ticket["raised_by"],
            "action": "created",
            "detail": {"title": ticket["title"]},
            "timestamp": ticket["created_at"],
        })

        # Log 2: status_changed (only for resolved/closed)
        if ticket["status"] in DONE_STATUSES and ticket["resolved_at"]:
            logs.append({
                "_id": oid(),
                "ticket_id": ticket["_id"],
                "actor_id": ticket["assigned_to"],
                "action": "status_changed",
                "detail": {"from": "open", "to": ticket["status"]},
                "timestamp": ticket["resolved_at"],
            })

    return logs


AUDIT_LOGS = _make_audit_logs(TICKETS)

# ── FAQs ──────────────────────────────────────────────────────────────────────

_FAQ_DATA = [
    # IT
    {
        "department_id": DEPT_IT,
        "question": "How do I request a VPN access token?",
        "answer": (
            "Submit a VPN access request through the IT portal under 'Network Services'. "
            "Approval is granted within 1 business day by the IT Admin."
        ),
        "keywords": ["vpn", "network", "access", "token"],
        "suggested_by": RES_IT_1,
        "approved_by": DA_IT,
    },
    {
        "department_id": DEPT_IT,
        "question": "What is the process to request a new software license?",
        "answer": (
            "Raise a 'technical' ticket with category 'Software License Request'. "
            "Include the software name, version, and business justification. "
            "The IT team will procure and install it within 3–5 business days."
        ),
        "keywords": ["software", "license", "install"],
        "suggested_by": RES_IT_2,
        "approved_by": DA_IT,
    },
    # HR
    {
        "department_id": DEPT_HR,
        "question": "How can I check my remaining leave balance?",
        "answer": (
            "Log in to the HRMS portal and navigate to My Leave → Leave Balance. "
            "Balances are updated every Monday. For discrepancies, raise an 'hr' ticket."
        ),
        "keywords": ["leave", "balance", "hrms", "holiday"],
        "suggested_by": RES_HR_1,
        "approved_by": DA_HR,
    },
    {
        "department_id": DEPT_HR,
        "question": "When are monthly payslips generated?",
        "answer": (
            "Payslips are generated on the 5th of every month for the previous month's salary. "
            "They are accessible via the HRMS portal under Payroll → My Payslips."
        ),
        "keywords": ["payslip", "salary", "payroll", "hrms"],
        "suggested_by": RES_HR_2,
        "approved_by": DA_HR,
    },
    # Finance
    {
        "department_id": DEPT_FIN,
        "question": "How do I submit an expense reimbursement claim?",
        "answer": (
            "Fill in the Expense Claim form available on the Finance portal. "
            "Attach original receipts and get your manager's approval. "
            "Claims are processed within 7 working days of submission."
        ),
        "keywords": ["reimbursement", "expense", "claim", "receipt"],
        "suggested_by": RES_FIN_1,
        "approved_by": DA_FIN,
    },
    {
        "department_id": DEPT_FIN,
        "question": "What is the turnaround time for vendor payment approvals?",
        "answer": (
            "Standard vendor payment approvals take 3–5 business days. "
            "Urgent payments can be expedited by raising a 'finance' priority ticket "
            "tagged 'high' with the invoice and PO number attached."
        ),
        "keywords": ["vendor", "payment", "invoice", "approval"],
        "suggested_by": RES_FIN_2,
        "approved_by": DA_FIN,
    },
    # Operations
    {
        "department_id": DEPT_OPS,
        "question": "How do I book a meeting room?",
        "answer": (
            "Meeting rooms can be booked via the Office 365 calendar by selecting the room "
            "as an attendee resource. Rooms are available on a first-come, first-served basis. "
            "For recurring bookings, contact the Operations Admin team."
        ),
        "keywords": ["meeting room", "booking", "office", "calendar"],
        "suggested_by": RES_OPS_1,
        "approved_by": DA_OPS,
    },
]

_faq_base = dt(45)

FAQS = []
for i, faq in enumerate(_FAQ_DATA):
    created = _faq_base - timedelta(days=i * 3)
    FAQS.append({
        "_id": oid(),
        "question": faq["question"],
        "answer": faq["answer"],
        "department_id": faq["department_id"],
        "suggested_by": faq["suggested_by"],     # resolver who suggested it
        "created_by": faq["suggested_by"],        # alias used by live model
        "reviewed_by": faq["approved_by"],
        "approved_by": faq["approved_by"],
        "rejected_by": None,
        "status": "published",
        "keywords": faq["keywords"],
        "review_notes": "Reviewed and approved for publication.",
        "rejection_reason": None,
        "created_at": created,
        "updated_at": created + timedelta(days=2),
        "reviewed_at": created + timedelta(days=1),
        "approved_at": created + timedelta(days=2),
        "rejected_at": None,
    })


# ── Main ──────────────────────────────────────────────────────────────────────

def seed_database() -> None:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"\n{'='*50}")
    print(f"  Connected -> {MONGO_URI}/{DB_NAME}")
    print(f"{'='*50}")

    COLLECTIONS = ["departments", "users", "tickets", "comments", "faqs", "audit_logs"]

    # Drop all collections for idempotency
    for col in COLLECTIONS:
        db[col].drop()
        print(f"  Dropped   : {col}")

    print()

    datasets = {
        "departments": DEPARTMENTS,
        "users":       USERS,
        "tickets":     TICKETS,
        "comments":    COMMENTS,
        "faqs":        FAQS,
        "audit_logs":  AUDIT_LOGS,
    }

    summary: dict[str, int] = {}
    for col in COLLECTIONS:
        docs = datasets[col]
        if docs:
            db[col].insert_many(docs)
        summary[col] = len(docs)
        status_icon = "[OK]" if docs else "[!!]"
        print(f"  {status_icon} Inserted  : {col:<15} -> {len(docs):>4} documents")

    print(f"\n{'='*50}")
    print("  Seed complete.\n")

    total = sum(summary.values())
    print(f"  Total documents inserted: {total}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    seed_database()