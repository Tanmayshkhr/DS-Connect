import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load .env from backend root (two levels up from this file)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "ds_connect"

# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

DEPARTMENT_NAMES = ["IT", "Finance", "HR", "Operations"]

EMPLOYEE_USERS = [
    ("Aarav Sharma",     "aarav.sharma"),
    ("Priya Mehta",      "priya.mehta"),
    ("Rohan Verma",      "rohan.verma"),
    ("Sneha Iyer",       "sneha.iyer"),
    ("Karan Patel",      "karan.patel"),
    ("Divya Nair",       "divya.nair"),
    ("Ankit Gupta",      "ankit.gupta"),
    ("Pooja Desai",      "pooja.desai"),
    ("Vikram Singh",     "vikram.singh"),
    ("Meera Joshi",      "meera.joshi"),
    ("Rahul Tiwari",     "rahul.tiwari"),
    ("Nisha Kapoor",     "nisha.kapoor"),
    ("Suresh Pillai",    "suresh.pillai"),
    ("Anjali Rao",       "anjali.rao"),
    ("Deepak Chaudhary", "deepak.chaudhary"),
    ("Kavita Saxena",    "kavita.saxena"),
    ("Amit Bose",        "amit.bose"),
    ("Ritika Malhotra",  "ritika.malhotra"),
    ("Siddharth Kulkarni","siddharth.kulkarni"),
    ("Lakshmi Reddy",    "lakshmi.reddy"),
]

TICKET_TITLES = [
    "Unable to access SAP portal",
    "Laptop not connecting to office Wi-Fi",
    "Request for software license renewal",
    "Payroll discrepancy for last month",
    "Email account locked out",
    "VPN not working from home",
    "Printer on 3rd floor not responding",
    "Need access to shared finance drive",
    "Leave policy clarification required",
    "Employee ID card replacement",
    "New joiner onboarding checklist missing",
    "Office 365 subscription expired",
    "Reimbursement claim not processed",
    "Meeting room AV system broken",
    "Data backup failure alert",
    "HR system login issue",
    "Salary slip not generated",
    "Request for additional monitor",
    "Network drive inaccessible",
    "Antivirus update failing on workstation",
    "Team mailing list not receiving emails",
    "Mobile device management enrollment issue",
    "GST invoice query from vendor",
    "Performance review portal not loading",
    "PF withdrawal request pending",
    "Canteen portal showing wrong balance",
    "IT asset audit form submission error",
    "Access card not working at gate 2",
    "ERP module throwing 500 error",
    "Video conferencing tool installation help",
]

COMMENT_TEXTS = [
    "I have raised this with the respective team, awaiting response.",
    "Can someone please look into this urgently?",
    "This issue is blocking my daily work.",
    "Please let me know if you need more details from my side.",
    "I tried restarting but the issue persists.",
    "This has been happening since last Monday.",
    "Attaching the screenshot via email for reference.",
    "The issue resolved on its own but logging for records.",
    "Escalating as the deadline is approaching.",
    "I will be available for a call if needed.",
    "Same issue is faced by my colleague as well.",
    "Checked with IT helpdesk — they suggested raising a ticket.",
    "Tried the suggested fix but it did not work.",
    "The problem reappeared after the last system update.",
    "Requesting closure as this is no longer blocking me.",
    "Could this be related to the recent network maintenance?",
    "Please prioritize as this affects payroll processing.",
    "Confirmed the issue is intermittent.",
    "Need resolution before end of day.",
    "Following up on this ticket as there has been no update.",
]

FAQ_DATA = [
    {
        "question": "How do I reset my corporate email password?",
        "answer": "Go to the IT portal at intranet.dsgroup.com/reset, enter your employee ID, and follow the steps. If you are locked out, call the IT helpdesk at ext. 1001.",
        "status": "published",
    },
    {
        "question": "How do I apply for reimbursement of travel expenses?",
        "answer": "Submit your bills through the HR portal under Reimbursements > Travel. Approvals are processed within 5 working days.",
        "status": "published",
    },
    {
        "question": "What is the process for requesting a new software license?",
        "answer": "Raise a ticket under the Technical category with the software name, version, and business justification. IT will evaluate and procure if approved.",
        "status": "published",
    },
    {
        "question": "How do I access my payslip?",
        "answer": "Log in to the HR portal and navigate to Payroll > Payslips. Slips are generated on the 1st of every month for the previous month.",
        "status": "published",
    },
    {
        "question": "What is the SLA for resolving high priority tickets?",
        "answer": "High priority tickets are acknowledged within 2 hours and resolved within 1 business day. Critical tickets are escalated immediately.",
        "status": "published",
    },
    {
        "question": "Can I work from home on Fridays?",
        "answer": "The WFH policy allows up to 2 days per week subject to manager approval. Check the HR policy document for department-specific rules.",
        "status": "suggested",
    },
    {
        "question": "How do I enroll my mobile device for corporate email access?",
        "answer": "Download the DS Group MDM app from the intranet, follow the enrollment guide, and submit the device IMEI to IT for whitelisting.",
        "status": "suggested",
    },
    {
        "question": "What is the process to raise a grievance against a manager?",
        "answer": "Grievances can be raised confidentially through HR portal under Employee Relations > Grievance. HR will initiate a review within 3 working days.",
        "status": "suggested",
    },
    {
        "question": "How do I request an IT asset like a monitor or keyboard?",
        "answer": "Raise a ticket under the Admin category specifying the asset type and business need. Assets are allocated based on availability and approval.",
        "status": "suggested",
    },
    {
        "question": "How is the annual performance review conducted?",
        "answer": "Reviews are conducted in Q4 through the HR portal. Employees self-assess first, followed by manager review and final HR sign-off.",
        "status": "suggested",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc():
    return datetime.now(timezone.utc)


def random_past_datetime(days=30):
    delta = random.randint(0, days * 24 * 60)
    return now_utc() - timedelta(minutes=delta)


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    collections = ["users", "departments", "tickets", "comments", "faqs", "audit_logs", "otps"]
    for col in collections:
        await db[col].drop()

    # -----------------------------------------------------------------------
    # Departments
    # -----------------------------------------------------------------------
    dept_docs = [{"_id": ObjectId(), "name": name} for name in DEPARTMENT_NAMES]
    await db["departments"].insert_many(dept_docs)
    dept_ids = [d["_id"] for d in dept_docs]

    # -----------------------------------------------------------------------
    # Users
    # -----------------------------------------------------------------------
    user_docs = []

    admin_doc = {
        "_id": ObjectId(),
        "email": "tanmayshkhr16@gmail.com",
        "name": "Tanmay Shekhar",
        "role": "system_admin",
        "department_id": None,
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": None,
    }
    user_docs.append(admin_doc)

    employee_docs = []
    for name, handle in EMPLOYEE_USERS:
        doc = {
            "_id": ObjectId(),
            "email": f"{handle}@dsgroup.com",
            "name": name,
            "role": "employee",
            "department_id": None,
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": None,
        }
        user_docs.append(doc)
        employee_docs.append(doc)

    await db["users"].insert_many(user_docs)

    # -----------------------------------------------------------------------
    # Tickets
    # -----------------------------------------------------------------------
    statuses = ["open", "in_progress", "resolved", "closed"]
    priorities = ["low", "medium", "high", "critical"]
    categories = ["technical", "hr", "finance", "admin", "general"]

    ticket_docs = []
    for i in range(30):
        status = random.choice(statuses)
        created_at = random_past_datetime(30)
        resolved_at = None
        if status in ("resolved", "closed"):
            resolved_at = created_at + timedelta(hours=random.randint(2, 48))

        doc = {
            "_id": ObjectId(),
            "title": TICKET_TITLES[i],
            "description": f"Employee reported: {TICKET_TITLES[i].lower()}. Requires attention from the support team.",
            "category": random.choice(categories),
            "priority": random.choice(priorities),
            "status": status,
            "raised_by": random.choice(employee_docs)["email"],
            "department_id": random.choice(dept_ids),
            "assigned_to": None,
            "created_at": created_at,
            "resolved_at": resolved_at,
            "updated_at": None,
        }
        ticket_docs.append(doc)

    await db["tickets"].insert_many(ticket_docs)

    # -----------------------------------------------------------------------
    # Comments
    # -----------------------------------------------------------------------
    comment_docs = []
    for i in range(20):
        ticket = random.choice(ticket_docs)
        author = random.choice(employee_docs)
        doc = {
            "_id": ObjectId(),
            "ticket_id": ticket["_id"],
            "author_id": author["_id"],
            "text": COMMENT_TEXTS[i],
            "is_internal": False,
            "created_at": ticket["created_at"] + timedelta(hours=random.randint(1, 10)),
        }
        comment_docs.append(doc)

    await db["comments"].insert_many(comment_docs)

    # -----------------------------------------------------------------------
    # FAQs
    # -----------------------------------------------------------------------
    faq_docs = []
    for faq in FAQ_DATA:
        suggester = random.choice(employee_docs)
        is_published = faq["status"] == "published"
        doc = {
            "_id": ObjectId(),
            "question": faq["question"],
            "answer": faq["answer"],
            "status": faq["status"],
            "department_id": random.choice(dept_ids),
            "suggested_by": suggester["_id"],
            "reviewed_by": None,
            "approved_by": None,
            "created_at": now_utc(),
        }
        faq_docs.append(doc)

    await db["faqs"].insert_many(faq_docs)

    # -----------------------------------------------------------------------
    # Audit logs — one per ticket
    # -----------------------------------------------------------------------
    audit_docs = []
    for ticket in ticket_docs:
        doc = {
            "_id": ObjectId(),
            "action": "created",
            "actor_id": ticket["raised_by"],
            "resource": "ticket",
            "resource_id": ticket["_id"],
            "detail": {
                "title": ticket["title"],
                "department_id": str(ticket["department_id"]),
            },
            "timestamp": ticket["created_at"],
        }
        audit_docs.append(doc)

    await db["audit_logs"].insert_many(audit_docs)

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n── Seed complete ──────────────────────────────")
    print(f"  departments : {len(dept_docs)}")
    print(f"  users       : {len(user_docs)}  (1 system_admin + {len(employee_docs)} employees)")
    print(f"  tickets     : {len(ticket_docs)}")
    print(f"  comments    : {len(comment_docs)}")
    print(f"  faqs        : {len(faq_docs)}  (5 published + 5 suggested)")
    print(f"  audit_logs  : {len(audit_docs)}")
    print(f"  otps        : 0  (collection dropped and left empty)")
    print("───────────────────────────────────────────────\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
