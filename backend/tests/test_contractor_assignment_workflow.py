import os
import sys
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db, get_active_financial_year
from auth_middleware import generate_token

client = TestClient(app)

TEST_PID_PREFIX = "PRJ-REGRESS-"

@pytest.fixture(autouse=True)
def cleanup_test_projects():
    yield
    db.projects.delete_many({"project_id": {"$regex": f"^{TEST_PID_PREFIX}"}})

def get_or_create_test_contractors():
    """Ensure two distinct state-verified contractors exist for isolation testing."""
    # Contractor A (Apex)
    user_a = db.users.find_one({"email": "contractor.test.a@govtfund.in"})
    if not user_a:
        res = db.users.insert_one({
            "email": "contractor.test.a@govtfund.in",
            "name": "Alpha Infra Works Ltd",
            "company_name": "Alpha Infra Works Ltd",
            "role": "CONTRACTOR",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "contractor_id": "CON-KA-ALPHA",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        })
        user_a = db.users.find_one({"_id": res.inserted_id})

    kyc_a = db.contractor_kyc.find_one({"user_id": str(user_a["_id"])})
    if not kyc_a:
        res_k = db.contractor_kyc.insert_one({
            "user_id": str(user_a["_id"]),
            "contractor_id": "CON-KA-ALPHA",
            "company_name": "Alpha Infra Works Ltd",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "email": "contractor.test.a@govtfund.in",
            "kyc_status": "APPROVED",
            "state_verified": True,
            "created_at": datetime.now(timezone.utc)
        })
        kyc_a = db.contractor_kyc.find_one({"_id": res_k.inserted_id})

    # Contractor B (Beta)
    user_b = db.users.find_one({"email": "contractor.test.b@govtfund.in"})
    if not user_b:
        res = db.users.insert_one({
            "email": "contractor.test.b@govtfund.in",
            "name": "Beta Highway Builders Ltd",
            "company_name": "Beta Highway Builders Ltd",
            "role": "CONTRACTOR",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "contractor_id": "CON-KA-BETA",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        })
        user_b = db.users.find_one({"_id": res.inserted_id})

    kyc_b = db.contractor_kyc.find_one({"user_id": str(user_b["_id"])})
    if not kyc_b:
        res_k = db.contractor_kyc.insert_one({
            "user_id": str(user_b["_id"]),
            "contractor_id": "CON-KA-BETA",
            "company_name": "Beta Highway Builders Ltd",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "email": "contractor.test.b@govtfund.in",
            "kyc_status": "APPROVED",
            "state_verified": True,
            "created_at": datetime.now(timezone.utc)
        })
        kyc_b = db.contractor_kyc.find_one({"_id": res_k.inserted_id})

    return user_a, kyc_a, user_b, kyc_b

def create_sample_project(project_id, district="Belagavi", state="KA", status="CREATED"):
    db.projects.delete_one({"project_id": project_id})
    doc = {
        "project_id": project_id,
        "name": f"Road Construction {project_id}",
        "scheme_name": "PM Gram Sadak Yojana",
        "scheme_code": "PMGSY",
        "department": "Rural Infrastructure",
        "state_code": state,
        "state_name": "Karnataka",
        "district_name": district,
        "financial_year": get_active_financial_year() or "2027-28",
        "total_budget": 5000000.0,
        "released_amount": 0.0,
        "contractor_id": None,
        "contractor_name": None,
        "contractor_email": None,
        "status": status,
        "created_at": datetime.now(timezone.utc)
    }
    db.projects.insert_one(doc)
    return doc

def test_district_assignment_persists_contractor_details():
    """1. District assignment successfully persists intended contractor ID, district, and assignment status."""
    user_a, kyc_a, _, _ = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}001"
    create_sample_project(pid, district="Belagavi")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )

    # Assign using the KYC document's _id (the common frontend selector scenario)
    res = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(kyc_a["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res.status_code == 200, f"Assignment failed: {res.text}"
    assert res.json()["success"] is True

    # Verify database document persistence
    updated = db.projects.find_one({"project_id": pid})
    assert updated is not None
    assert updated["contractor_id"] == str(user_a["_id"])
    assert updated["canonical_contractor_id"] == "CON-KA-ALPHA"
    assert updated["contractor_email"] == "contractor.test.a@govtfund.in"
    assert updated["status"] == "ASSIGNED"
    assert updated["assignment_status"] == "ASSIGNED"
    assert updated["contract_status"] == "PENDING_ACCEPTANCE"
    assert updated["assigned_by_district"] == "Belagavi"
    assert updated["assigned_at"] is not None

def test_assigned_project_appears_in_contractor_dashboard_and_list():
    """2. The assigned project appears in that contractor's dashboard and projects list."""
    user_a, kyc_a, _, _ = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}002"
    create_sample_project(pid, district="Belagavi")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )
    assign_res = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(user_a["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert assign_res.status_code == 200

    contractor_a_token = generate_token(
        user_id=str(user_a["_id"]),
        email=user_a["email"],
        role="CONTRACTOR",
        name=user_a["name"],
        state_code="KA",
        officer_id="CON-KA-ALPHA"
    )

    # Check /api/contractor/projects
    p_res = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {contractor_a_token}"})
    assert p_res.status_code == 200
    p_data = p_res.json()
    assert p_data["success"] is True
    found_in_list = any(p["project_id"] == pid for p in p_data["projects"])
    assert found_in_list, f"Project {pid} not found in contractor projects list!"

    # Check /api/contractor/dashboard
    d_res = client.get("/api/contractor/dashboard", headers={"Authorization": f"Bearer {contractor_a_token}"})
    assert d_res.status_code == 200
    d_data = d_res.json()
    assert d_data["success"] is True
    pending_ids = [p["project_id"] for p in d_data.get("pending_assignments", [])]
    assert pid in pending_ids, f"Project {pid} not found in contractor dashboard pending_assignments!"

def test_different_contractor_cannot_see_or_access_assigned_project():
    """3. A different contractor cannot see or access the assigned project."""
    user_a, kyc_a, user_b, kyc_b = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}003"
    create_sample_project(pid, district="Belagavi")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )
    # Assign strictly to Contractor A
    client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(user_a["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )

    contractor_b_token = generate_token(
        user_id=str(user_b["_id"]),
        email=user_b["email"],
        role="CONTRACTOR",
        name=user_b["name"],
        state_code="KA",
        officer_id="CON-KA-BETA"
    )

    # Contractor B list must NOT contain Contractor A's project
    p_res_b = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {contractor_b_token}"})
    assert p_res_b.status_code == 200
    b_project_ids = [p["project_id"] for p in p_res_b.json().get("projects", [])]
    assert pid not in b_project_ids, f"Isolation Breach: Contractor B saw project {pid} assigned to Contractor A!"

    # Contractor B dashboard must NOT contain Contractor A's project
    d_res_b = client.get("/api/contractor/dashboard", headers={"Authorization": f"Bearer {contractor_b_token}"})
    assert d_res_b.status_code == 200
    b_pending = [p["project_id"] for p in d_res_b.json().get("pending_assignments", [])]
    assert pid not in b_pending, f"Isolation Breach: Contractor B dashboard shows {pid} assigned to Contractor A!"

    # Contractor B attempting direct detail access must be rejected with 403 Forbidden
    detail_res = client.get(f"/api/contractor/projects/{pid}", headers={"Authorization": f"Bearer {contractor_b_token}"})
    assert detail_res.status_code == 403

    # Contractor B attempting to accept Contractor A's project must be rejected with 403 Forbidden
    accept_res = client.post(f"/api/contractor/projects/{pid}/accept", headers={"Authorization": f"Bearer {contractor_b_token}"})
    assert accept_res.status_code == 403

def test_unassigned_projects_do_not_appear_as_assigned():
    """4. Unassigned projects do not appear as assigned projects."""
    user_a, _, _, _ = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}004"
    create_sample_project(pid, district="Belagavi", status="CREATED")

    contractor_a_token = generate_token(
        user_id=str(user_a["_id"]),
        email=user_a["email"],
        role="CONTRACTOR",
        name=user_a["name"],
        state_code="KA",
        officer_id="CON-KA-ALPHA"
    )

    res = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {contractor_a_token}"})
    assert res.status_code == 200
    pids = [p["project_id"] for p in res.json().get("projects", [])]
    assert pid not in pids, f"Unassigned project {pid} appeared in contractor projects list!"

def test_invalid_contractor_ids_and_unauthorized_assignments_rejected():
    """5. Invalid contractor IDs and unauthorized assignments are rejected."""
    pid = f"{TEST_PID_PREFIX}005"
    create_sample_project(pid, district="Belagavi")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )

    # 1. Non-existent contractor ID -> 404 Not Found
    res_fake = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": "CON-NONEXISTENT-999"},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res_fake.status_code == 404

    # 2. Contractor with unverified KYC status -> 400 Bad Request
    unverified_res = db.contractor_kyc.insert_one({
        "user_id": "temp_unverified_uid",
        "contractor_id": "CON-KA-UNVERIFIED",
        "company_name": "Unverified Infra",
        "state_code": "KA",
        "kyc_status": "UNDER_REVIEW",
        "created_at": datetime.now(timezone.utc)
    })
    res_unver = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": "CON-KA-UNVERIFIED"},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res_unver.status_code == 400
    assert "UNDER_REVIEW" in res_unver.json()["message"]
    db.contractor_kyc.delete_one({"_id": unverified_res.inserted_id})

    # 3. Cross-state assignment attempt -> 400 Bad Request
    mh_res = db.contractor_kyc.insert_one({
        "user_id": "temp_mh_uid",
        "contractor_id": "CON-MH-OUTOFSTATE",
        "company_name": "Maharashtra Infra",
        "state_code": "MH",
        "kyc_status": "APPROVED",
        "created_at": datetime.now(timezone.utc)
    })
    res_cross = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": "CON-MH-OUTOFSTATE"},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res_cross.status_code == 400
    assert "Cross-state" in res_cross.json()["message"]
    db.contractor_kyc.delete_one({"_id": mh_res.inserted_id})

    # 4. District officer from wrong district attempting assignment -> 403 Forbidden
    other_dist_token = generate_token(
        user_id="dist_mysuru_officer",
        email="district.mysuru@govtfund.in",
        role="DISTRICT",
        name="Mysuru District Collector",
        state_code="KA",
        district_name="Mysuru"
    )
    res_unauth_dist = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": "CON-KA-ALPHA"},
        headers={"Authorization": f"Bearer {other_dist_token}"}
    )
    assert res_unauth_dist.status_code == 403

def test_cannot_reassign_active_in_progress_or_completed_project():
    """6. Avoid duplicate assignments and handle reassignment according to lifecycle rules."""
    user_a, _, user_b, _ = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}006"
    create_sample_project(pid, district="Belagavi", status="IN_PROGRESS")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )

    # Attempting to assign/reassign when project is already IN_PROGRESS -> 400 Bad Request
    res = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(user_b["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res.status_code == 400
    assert "Cannot reassign project in 'IN_PROGRESS' state" in res.json()["message"]

def test_idempotent_assignment_to_same_contractor():
    """7. Duplicate assignment to the same contractor returns cleanly and idempotently."""
    user_a, _, _, _ = get_or_create_test_contractors()
    pid = f"{TEST_PID_PREFIX}007"
    create_sample_project(pid, district="Belagavi")

    dist_token = generate_token(
        user_id="dist_belagavi_officer",
        email="district.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Collector",
        state_code="KA",
        district_name="Belagavi"
    )

    # First assignment
    res1 = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(user_a["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res1.status_code == 200

    # Second assignment to the same contractor
    res2 = client.post(
        f"/api/district/projects/{pid}/assign-contractor",
        json={"contractor_id": str(user_a["_id"])},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert res2.status_code == 200
    assert res2.json().get("already_assigned") is True
