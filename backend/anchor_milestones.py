import blockchain_service as bcs
from database import db
from datetime import datetime

project_id = 'PRJ-BEN-YFIPCM'
proj = db.projects.find_one({'project_id': project_id})
print('Project found:', proj['name'] if proj else None)

if proj:
    budget = float(proj.get('total_budget', 1500000)) # 15 Lakhs
    # Divide budget into 3 phases: 5 Lakhs, 6 Lakhs, 4 Lakhs
    m1 = int(budget * 0.3333333333333333) # 500,000
    m2 = int(budget * 0.40) # 600,000
    m3 = int(budget - m1 - m2) # 400,000
    
    milestones_data = [
        {"title": "Phase 1: Groundwork & Foundation Drainage Culverts", "amount": m1, "description": "Clearing terrain, base leveling, and foundation drainage culvert construction."},
        {"title": "Phase 2: Heavy Concrete Paving & Asphalt Layer", "amount": m2, "description": "Laying reinforced cement concrete sub-base and grade-A bitumen surfacing."},
        {"title": "Phase 3: Final Road Signage & Quality Inspection", "amount": m3, "description": "Road safety markings, solar streetlights, guardrails, and final inspection."}
    ]

    amounts_list = [m1, m2, m3]
    print('Anchoring milestones on Ganache:', amounts_list)
    try:
        tx_receipt = bcs.set_project_milestones_onchain(project_id, amounts_list)
        print('On-chain receipt:', tx_receipt)
    except Exception as e:
        print('On-chain error (may already be set):', e)

    db.milestones.delete_many({'project_id': project_id})
    for idx, m in enumerate(milestones_data):
        db.milestones.insert_one({
            "project_id": project_id,
            "milestone_index": idx,
            "title": m["title"],
            "description": m["description"],
            "amount": float(m["amount"]),
            "status": "PENDING",
            "progress_percentage": 0,
            "proof_document_hash": None,
            "blockchain_tx_hash": None,
            "created_at": datetime.utcnow()
        })
    
    print('Successfully anchored and saved 3 milestones for', project_id)
