import os
import sys
import io
import hashlib
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db, get_active_financial_year
from auth_middleware import generate_token

client = TestClient(app)

TEST_PID_PREFIX = "PRJ-DOC-TEST-"
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

@pytest.fixture(autouse=True)
def cleanup_test_records():
    yield
    # Cleanup test projects, milestones, evidence, documents, notifications
    db.projects.delete_many({"project_id": {"$regex": f"^{TEST_PID_PREFIX}"}})
    db.milestones.delete_many({"project_id": {"$regex": f"^{TEST_PID_PREFIX}"}})
    db.evidence.delete_many({"project_id": {"$regex": f"^{TEST_PID_PREFIX}"}})
    db.documents.delete_many({"entity_id": {"$regex": f"^{TEST_PID_PREFIX}"}})
    db.contractor_kyc.delete_many({"email": {"$regex": r"^contractor\.doctest\."}})
    db.users.delete_many({"email": {"$regex": r"^contractor\.doctest\."}})

def setup_contractor_accounts():
    """Create Contractor A and Contractor B with full KYC and tokens."""
    # Contractor A
    user_a = db.users.find_one({"email": "contractor.doctest.a@govtfund.in"})
    if not user_a:
        res = db.users.insert_one({
            "email": "contractor.doctest.a@govtfund.in",
            "name": "Apex Builders Test",
            "role": "CONTRACTOR",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "contractor_id": "CON-DOC-APEX",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        })
        user_a = db.users.find_one({"_id": res.inserted_id})

    kyc_a = db.contractor_kyc.find_one({"email": "contractor.doctest.a@govtfund.in"})
    if not kyc_a:
        res_k = db.contractor_kyc.insert_one({
            "user_id": str(user_a["_id"]),
            "contractor_id": "CON-DOC-APEX",
            "company_name": "Apex Builders Test",
            "email": "contractor.doctest.a@govtfund.in",
            "state_code": "KA",
            "district_name": "Belagavi",
            "kyc_status": "APPROVED",
            "created_at": datetime.now(timezone.utc)
        })
        kyc_a = db.contractor_kyc.find_one({"_id": res_k.inserted_id})

    token_a = generate_token(
        user_id=str(user_a["_id"]),
        email=user_a["email"],
        role="CONTRACTOR",
        name=user_a["name"],
        state_code="KA",
        district_name="Belagavi",
        officer_id="CON-DOC-APEX"
    )

    # Contractor B (Untrusted / Cross-contractor)
    user_b = db.users.find_one({"email": "contractor.doctest.b@govtfund.in"})
    if not user_b:
        res = db.users.insert_one({
            "email": "contractor.doctest.b@govtfund.in",
            "name": "Beta Infra Test",
            "role": "CONTRACTOR",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "contractor_id": "CON-DOC-BETA",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        })
        user_b = db.users.find_one({"_id": res.inserted_id})

    token_b = generate_token(
        user_id=str(user_b["_id"]),
        email=user_b["email"],
        role="CONTRACTOR",
        name=user_b["name"],
        state_code="KA",
        district_name="Belagavi",
        officer_id="CON-DOC-BETA"
    )

    # District Officer (Authorized - Belagavi)
    token_dist_belagavi = generate_token(
        user_id="dist-officer-belagavi",
        email="officer.belagavi@govtfund.in",
        role="DISTRICT",
        name="Belagavi District Officer",
        state_code="KA",
        district_name="Belagavi"
    )

    # District Officer (Unauthorized - Mysuru)
    token_dist_mysuru = generate_token(
        user_id="dist-officer-mysuru",
        email="officer.mysuru@govtfund.in",
        role="DISTRICT",
        name="Mysuru District Officer",
        state_code="KA",
        district_name="Mysuru"
    )

    return {
        "user_a": user_a,
        "kyc_a": kyc_a,
        "token_a": token_a,
        "user_b": user_b,
        "token_b": token_b,
        "token_dist_belagavi": token_dist_belagavi,
        "token_dist_mysuru": token_dist_mysuru
    }

def create_assigned_project(project_id, contractor_id="CON-DOC-APEX", contractor_name="Apex Builders Test", contractor_email="contractor.doctest.a@govtfund.in"):
    """Helper to create project in ASSIGNED status with 2 milestones."""
    db.projects.delete_one({"project_id": project_id})
    db.milestones.delete_many({"project_id": project_id})

    proj_doc = {
        "project_id": project_id,
        "name": f"Flyover Project {project_id}",
        "district_name": "Belagavi",
        "state_code": "KA",
        "state_name": "Karnataka",
        "department": "Public Works",
        "scheme_code": "CRF",
        "financial_year": get_active_financial_year(),
        "total_budget": 5000000.0,
        "released_amount": 0.0,
        "status": "ASSIGNED",
        "contractor_id": contractor_id,
        "canonical_contractor_id": contractor_id,
        "contractor_name": contractor_name,
        "contractor_email": contractor_email,
        "contract_id": f"CTR-{project_id}",
        "created_at": datetime.now(timezone.utc)
    }
    db.projects.insert_one(proj_doc)

    milestones = [
        {
            "project_id": project_id,
            "milestone_index": 0,
            "title": "Phase 1: Foundation & Earthwork",
            "description": "Complete ground excavation and reinforced concrete piles",
            "amount": 2500000.0,
            "status": "PENDING",
            "phase_status": "PENDING",
            "progress_percentage": 0,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "project_id": project_id,
            "milestone_index": 1,
            "title": "Phase 2: Superstructure & Decking",
            "description": "Piers erection and precast girder installation",
            "amount": 2500000.0,
            "status": "PENDING",
            "phase_status": "PENDING",
            "progress_percentage": 0,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    db.milestones.insert_many(milestones)
    return proj_doc

# =========================================================================
# 1. Project Visibility & Acceptance Tests
# =========================================================================

def test_contractor_assigned_projects_display():
    """Verify that projects assigned to Contractor A appear, and Contractor B cannot see them."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}VIS-01"
    create_assigned_project(pid)

    # Contractor A requests their projects
    res_a = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res_a.status_code == 200
    pids_a = [p["project_id"] for p in res_a.json().get("projects", [])]
    assert pid in pids_a

    # Contractor B requests their projects
    res_b = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {ctx['token_b']}"})
    assert res_b.status_code == 200
    pids_b = [p["project_id"] for p in res_b.json().get("projects", [])]
    assert pid not in pids_b

def test_contractor_project_acceptance():
    """Verify contractor can accept assigned project and acknowledge phase initiation."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}ACC-01"
    create_assigned_project(pid)

    # Accept project
    res = client.post(
        f"/api/contractor/projects/{pid}/accept",
        json={"notes": "Mobilization commenced on site."},
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    # Verify status in DB
    updated_proj = db.projects.find_one({"project_id": pid})
    assert updated_proj["status"] in ["ACCEPTED", "CONTRACTOR_ACCEPTED", "IN_PROGRESS"]

# =========================================================================
# 2. Document Submission Validation Tests (Format, Size, Missing Fields)
# =========================================================================

def test_evidence_upload_missing_file_rejected():
    """Submitting evidence without a file attached must return 400 Bad Request."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}VAL-MISSING"
    create_assigned_project(pid)

    # Empty form data without file
    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "No file attached test"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 400
    assert "No file uploaded" in res.json().get("message", "")

def test_evidence_upload_disallowed_extension_rejected():
    """Submitting dangerous or disallowed file extensions (.exe, .sh, .bat) must return 400 Bad Request."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}VAL-EXT"
    create_assigned_project(pid)

    fake_malware = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    files = {"file": ("exploit.exe", fake_malware, "application/octet-stream")}
    
    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Executable file test"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 400
    assert "Unsupported file type" in res.json().get("message", "")

def test_evidence_upload_oversized_file_rejected():
    """Submitting file exceeding 25MB ceiling must return 400 Bad Request."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}VAL-SIZE"
    create_assigned_project(pid)

    # Create dummy 26MB buffer in memory
    oversized = io.BytesIO(b"0" * (26 * 1024 * 1024))
    files = {"file": ("huge_archive.pdf", oversized, "application/pdf")}

    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Oversized file test"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 400
    assert "exceeds 25 MB" in res.json().get("message", "")

def test_unauthorized_contractor_submission_rejected():
    """Contractor B must be forbidden from submitting deliverables to Contractor A's project."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}ISOL-01"
    create_assigned_project(pid)

    valid_pdf = io.BytesIO(b"%PDF-1.4 test deliverable")
    files = {"file": ("phase1_proof.pdf", valid_pdf, "application/pdf")}

    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Contractor B unauthorized attempt"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_b']}"}
    )
    assert res.status_code == 403
    assert "Access Denied" in res.json().get("message", "")

def test_nonexistent_project_submission_rejected():
    """Submitting evidence to a non-existent project must return 404 Not Found."""
    ctx = setup_contractor_accounts()
    valid_pdf = io.BytesIO(b"%PDF-1.4 test")
    files = {"file": ("test.pdf", valid_pdf, "application/pdf")}

    res = client.post(
        f"/api/contractor/projects/PRJ-DOES-NOT-EXIST/phases/0/evidence",
        data={"description": "Non-existent project"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 404

# =========================================================================
# 3. Successful Document Upload, File Storage & SHA-256 Digest Verification
# =========================================================================

def test_successful_evidence_upload_and_storage():
    """Contractor uploads valid milestone evidence; file is stored, SHA-256 matches, DB records created."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}SUB-01"
    create_assigned_project(pid)

    pdf_bytes = b"%PDF-1.4 Foundation quality certificate official content 12345"
    expected_hash = hashlib.sha256(pdf_bytes).hexdigest()
    file_stream = io.BytesIO(pdf_bytes)
    files = {"file": ("foundation_cert.pdf", file_stream, "application/pdf")}

    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Soil testing and core compaction reports"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    evidence_id = data["evidence"]["evidence_id"]
    assert evidence_id.startswith(f"EVD-{pid}-P1-")

    # Verify physical file existence and SHA-256 on disk
    ev_record = db.evidence.find_one({"evidence_id": evidence_id})
    assert ev_record is not None
    assert ev_record["sha256_hash"] == expected_hash
    assert ev_record["status"] == "SUBMITTED"
    assert ev_record["contractor_id"] == "CON-DOC-APEX"
    assert os.path.exists(ev_record["file_path"])

    with open(ev_record["file_path"], "rb") as f:
        disk_content = f.read()
    assert disk_content == pdf_bytes

    # Verify db.documents entity
    doc_record = db.documents.find_one({"document_id": evidence_id})
    assert doc_record is not None
    assert doc_record["sha256_hash"] == expected_hash

def test_successful_multi_proof_milestone_submission():
    """Contractor submits full milestone completion with material bills, photo, and test cert."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}SUB-MULTI"
    create_assigned_project(pid)

    bill_bytes = b"MATERIAL BILL: 500 Tons Grade 43 Cement, Invoice #99182"
    photo_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR Site Photo Foundation"
    cert_bytes = b"%PDF-1.4 Structural Engineering Cube Strength Test Passed"

    files = [
        ("material_bills_file", ("cement_invoice.txt", io.BytesIO(bill_bytes), "text/plain")),
        ("progress_photo_file", ("pier_concrete.png", io.BytesIO(photo_bytes), "image/png")),
        ("other_doc_file", ("cube_strength.pdf", io.BytesIO(cert_bytes), "application/pdf"))
    ]

    res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/submit-milestone",
        data={
            "percentage": "100",
            "notes": "Earthwork and foundation completed in full compliance with IRC standards.",
            "material_bills_notes": "Supplied by UltraTech Cement Ltd",
            "video_url": "https://video.govtfund.in/evidence/phase1.mp4"
        },
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["uploaded_proof_files"]) == 3

    # Check phase status updated in db.milestones
    phase = db.milestones.find_one({"project_id": pid, "milestone_index": 0})
    assert phase["status"] == "SUBMITTED"
    assert phase["phase_status"] == "SUBMITTED_FOR_VERIFICATION"
    assert len(phase["all_proof_hashes"]) == 3

    # Check notification for District Officer
    notif = db.notifications.find_one({
        "recipient_role": "DISTRICT",
        "district_name": "Belagavi",
        "link": {"$regex": pid}
    })
    assert notif is not None
    assert pid in notif["message"]

# =========================================================================
# 4. Contractor & District Officer Document Retrieval & Preview Tests
# =========================================================================

def test_contractor_can_preview_and_download_own_evidence():
    """Contractor can access /api/evidence/{id}/file with Authorization header or token query."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}PREVIEW-01"
    create_assigned_project(pid)

    content = b"%PDF-1.4 Test Report Content"
    files = {"file": ("report.pdf", io.BytesIO(content), "application/pdf")}
    upload_res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Test preview report"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    ev_id = upload_res.json()["evidence"]["evidence_id"]

    # Preview with Bearer token
    res_header = client.get(f"/api/evidence/{ev_id}/file", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res_header.status_code == 200
    assert res_header.content == content
    assert "application/pdf" in res_header.headers.get("content-type", "")

    # Preview with token query param (for <img> and <iframe> previews)
    res_query = client.get(f"/api/evidence/{ev_id}/file?token={ctx['token_a']}")
    assert res_query.status_code == 200
    assert res_query.content == content

def test_district_officer_review_and_cross_district_isolation():
    """District Officer of Belagavi can access evidence; Officer of Mysuru is forbidden."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}DIST-ACCESS"
    create_assigned_project(pid)

    content = b"%PDF-1.4 Belagavi Bridge Proof"
    files = {"file": ("bridge.pdf", io.BytesIO(content), "application/pdf")}
    upload_res = client.post(
        f"/api/contractor/projects/{pid}/phases/0/evidence",
        data={"description": "Bridge foundation evidence"},
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    ev_id = upload_res.json()["evidence"]["evidence_id"]

    # Authorized District Officer (Belagavi)
    res_belagavi = client.get(
        f"/api/evidence/project/{pid}/milestone/0",
        headers={"Authorization": f"Bearer {ctx['token_dist_belagavi']}"}
    )
    assert res_belagavi.status_code == 200
    assert res_belagavi.json()["evidence_count"] >= 1

    # Belagavi officer file preview
    file_res = client.get(f"/api/evidence/{ev_id}/file", headers={"Authorization": f"Bearer {ctx['token_dist_belagavi']}"})
    assert file_res.status_code == 200
    assert file_res.content == content

    # Unauthorized District Officer (Mysuru)
    res_mysuru = client.get(
        f"/api/evidence/project/{pid}/milestone/0",
        headers={"Authorization": f"Bearer {ctx['token_dist_mysuru']}"}
    )
    assert res_mysuru.status_code == 403

# =========================================================================
# 5. Review Lifecycle: Rejection, Resubmission & Approval
# =========================================================================

def test_milestone_rejection_and_resubmission_lifecycle():
    """Full lifecycle: Submission -> District Rejection -> Contractor Resubmission -> District Approval."""
    ctx = setup_contractor_accounts()
    pid = f"{TEST_PID_PREFIX}LIFECYCLE-01"
    create_assigned_project(pid)

    # 1. Initial submission
    res_sub1 = client.post(
        f"/api/contractor/projects/{pid}/phases/0/submit-milestone",
        data={"percentage": "100", "notes": "Initial milestone submission"},
        files=[("progress_photo_file", ("photo1.png", io.BytesIO(b"PNG initial photo"), "image/png"))],
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res_sub1.status_code == 200

    # 2. District Officer Rejection with feedback
    res_rej = client.post(
        f"/api/district/projects/{pid}/phases/0/verify-milestone",
        json={"action": "REJECT", "remarks": "Photographic resolution too low; re-take geo-tagged photos."},
        headers={"Authorization": f"Bearer {ctx['token_dist_belagavi']}"}
    )
    assert res_rej.status_code == 200
    assert res_rej.json()["success"] is True

    # Verify status changed to REJECTED_NEEDS_RECTIFICATION
    phase_after_rej = db.milestones.find_one({"project_id": pid, "milestone_index": 0})
    assert phase_after_rej["status"] == "REJECTED_NEEDS_RECTIFICATION"
    assert "geo-tagged" in phase_after_rej["rejection_reason"]

    # 3. Contractor Resubmission
    res_sub2 = client.post(
        f"/api/contractor/projects/{pid}/phases/0/submit-milestone",
        data={"percentage": "100", "notes": "Rectified with high-res geo-tagged imagery"},
        files=[("progress_photo_file", ("photo_geotagged.png", io.BytesIO(b"PNG rectified high res photo"), "image/png"))],
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res_sub2.status_code == 200

    # Verify status changed back to SUBMITTED
    phase_after_resub = db.milestones.find_one({"project_id": pid, "milestone_index": 0})
    assert phase_after_resub["status"] == "SUBMITTED"
    assert phase_after_resub["rejection_reason"] is None

    # 4. District Officer Approval
    res_app = client.post(
        f"/api/district/projects/{pid}/phases/0/verify-milestone",
        json={"action": "APPROVE"},
        headers={"Authorization": f"Bearer {ctx['token_dist_belagavi']}"}
    )
    assert res_app.status_code == 200
    assert res_app.json()["success"] is True

    # Verify status changed to COMPLETED / VERIFIED
    phase_final = db.milestones.find_one({"project_id": pid, "milestone_index": 0})
    assert phase_final["status"] == "COMPLETED"
    assert phase_final["evidence_status"] == "VERIFIED"

# =========================================================================
# 6. Statutory KYC Document Upload Test
# =========================================================================

def test_contractor_kyc_document_submission():
    """Contractor submits statutory KYC document (GST certificate); verify storage and KYC update."""
    ctx = setup_contractor_accounts()

    gst_pdf = b"%PDF-1.4 Official Government GST Registration Certificate 29AAAAA0000A1Z5"
    files = {"file": ("gst_cert.pdf", io.BytesIO(gst_pdf), "application/pdf")}
    
    res = client.post(
        "/api/contractor/kyc-submit",
        data={
            "doc_type": "gst_document",
            "gst_number": "29AAAAA0000A1Z5",
            "pan_number": "AAAAA0000A"
        },
        files=files,
        headers={"Authorization": f"Bearer {ctx['token_a']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    # Verify in contractor_kyc collection
    kyc_doc = db.contractor_kyc.find_one({"email": "contractor.doctest.a@govtfund.in"})
    assert kyc_doc is not None
    assert "gst_document" in kyc_doc
    assert os.path.exists(kyc_doc["gst_document"])

    with open(kyc_doc["gst_document"], "rb") as f:
        saved_bytes = f.read()
    assert saved_bytes == gst_pdf
