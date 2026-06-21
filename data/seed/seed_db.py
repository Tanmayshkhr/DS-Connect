import json
import os
import random
from datetime import datetime, timedelta
from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "ds_connect_db"

def generate_historical_tickets(users, departments):
    employees = [u["_id"] for u in users if u["role"] == "Employee"]
    resolvers = [u["_id"] for u in users if u["role"] == "Resolver"]
    
    categories = ["Software Issue", "Hardware Access", "Payroll Query", "SAP B1 Endpoint", "Network Access"]
    statuses = ["Resolved", "Resolved", "Closed", "Open", "Open", "Overdue"]
    priorities = ["Low", "Medium", "High"]
    
    tickets = []
    now = datetime.utcnow()
    
    for i in range(1, 61):
        created_days_ago = random.randint(1, 30)
        created_time = now - timedelta(days=created_days_ago)
        sla_time = created_time + timedelta(days=random.randint(1, 3))
        
        status = random.choice(statuses)
        assigned_res = random.choice(resolvers) if status in ["Resolved", "Closed"] else None
        
        ticket = {
            "_id": f"tkt_hist_{i:03d}",
            "title": f"Historical Issue regarding {random.choice(categories)}",
            "description": "Auto-generated historical ticket for analytics dashboard visualization.",
            "category": random.choice(categories),
            "priority": random.choice(priorities),
            "status": status,
            "raised_by": random.choice(employees),
            "department_id": random.choice([d["_id"] for d in departments]),
            "assigned_resolver_id": assigned_res,
            "created_at": created_time.isoformat() + "Z",
            "sla_due_at": sla_time.isoformat() + "Z"
        }
        tickets.append(ticket)
        
    return tickets

def seed_database():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"Connected to database: {DB_NAME}")

    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, "seed_data.json")

    if not os.path.exists(json_path):
        print(f"Error: Cannot find {json_path}")
        return

    with open(json_path, "r") as f:
        data = json.load(f)

    # Generate the 60 required realistic historical tickets
    data["tickets"] = generate_historical_tickets(data["users"], data["departments"])

    collections_to_seed = ["departments", "users", "faqs", "tickets"]
    
    for col in collections_to_seed:
        db[col].delete_many({})
        print(f"Base collection cleared: {col}")

    for col in collections_to_seed:
        if col in data and len(data[col]) > 0:
            db[col].insert_many(data[col])
            print(f"Successfully seeded {len(data[col])} records into '{col}'")

    print("\nDatabase initialization completed successfully.")

if __name__ == "__main__":
    seed_database()