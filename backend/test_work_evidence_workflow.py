import sys
import os
import io
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app import app
from database import db

def print_step(num, title):
    print(f"\n{'='*75}\n[TEST {num}] {title}\n{'='*75}", flush=True)

def run_all_tests():
    client = TestClient(app)

    # -------------------------------------------------------------------------
    # Setup: Authenticate District Officer and Contractor
    # -------------------------------------------------------------------------
    print_step(0, "Setup: Authenticate District Officer and Contractor")
    
    # District Login (Belagavi)
    dist_res = client.post("/api/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert dist_res.status_code == 200, f"District login failed: {dist_res.text}"
    dist_token = dist_res.json()["token"]
    dist_headers = {"Authorization": f"Bearer {dist_token}"}
    print("[OK] District Officer authenticated (Belagavi).")

    # Contractor Login (Apex Infrastructure)
    con_res = client.post("/api/auth/contractor/login", json={
        "identifier": "CON-KA-APEX",
        "password": "Contractor@123"
    })
    assert con_res.status_code == 200, f"Contractor login failed: {con_res.text}"
    con_user = con_res.json()["user"]
    con_token = con_res.json()["token"]
    con_headers = {"Authorization": f"Bearer {con_token}"}
    print(f"[OK] Contractor authenticated: {con_user['name']} (ID: {con_user.get('contractor_id')})")

    # Another Contractor Token (for unauthorized cross-contractor test)
    from auth_middleware import generate_token
    con2_token = generate_token(
        user_id="CON-UNAUTHORIZED-999",
        email="other_contractor@test.com",
        role="CONTRACTOR",
        name="Unauthorized Other Contractor"
    )
    con2_headers = {"Authorization": f"Bearer {con2_token}"}

    # District Allocation setup for Belagavi PMGSY
    db.district_allocations.update_one(
        {"district_name": "Belagavi", "scheme_name": "Pradhan Mantri Gram Sadak Yojana"},
        {"$set": {
            "district_alloc_id": "DAL-KA-BEL-PMGSY-001",
            "state_code": "KA",
            "district_name": "Belagavi",
            "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
            "scheme_code": "PMGSY",
            "amount": 250000000.0,
            "allocated_amount": 250000000.0,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    # -------------------------------------------------------------------------
    # 1. District creates and assigns project to Contractor
    # -------------------------------------------------------------------------
    print_step(1, "District creates and assigns project to Contractor")
    
    create_payload = {
        "name": "Belagavi Highway Overpass Work Evidence Test",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
        "state_code": "KA",
        "district_name": "Belagavi",
        "total_budget": 5000000.0,
        "contractor_id": con_user.get("contractor_id") or con_user.get("user_id"),
        "contractor_name": con_user.get("name")
    }
    create_res = client.post("/api/district/projects", json=create_payload, headers=dist_headers)
    assert create_res.status_code in [200, 201], f"Project creation failed: {create_res.text}"
    project_data = create_res.json()["project"]
    project_id = project_data["project_id"]
    print(f"[OK] Project created: {project_id} - '{project_data['name']}'")

    # Assign Contractor to Project
    assign_res = client.post(f"/api/district/projects/{project_id}/assign-contractor", json={
        "contractor_user_id": con_user["user_id"]
    }, headers=dist_headers)
    assert assign_res.status_code == 200, f"Assignment failed: {assign_res.text}"
    print(f"[OK] Project assigned to contractor {con_user['name']}. Status: ASSIGNED.")

    # -------------------------------------------------------------------------
    # 2. Contractor opens project and accepts project assignment
    # -------------------------------------------------------------------------
    print_step(2, "Contractor opens project and accepts assignment")

    accept_res = client.post(f"/api/contractor/projects/{project_id}/accept", headers=con_headers)
    assert accept_res.status_code == 200, f"Contractor accept failed: {accept_res.text}"
    print(f"[OK] Project accepted by contractor. Status is now ACTIVE/ACCEPTED.")

    # -------------------------------------------------------------------------
    # 3. Contractor selects Milestone 0 (Phase #1)
    # -------------------------------------------------------------------------
    print_step(3, "Contractor selects Milestone 0 (Phase #1)")

    detail_res = client.get(f"/api/contractor/projects/{project_id}", headers=con_headers)
    assert detail_res.status_code == 200
    milestones = detail_res.json().get("milestones", [])
    assert len(milestones) > 0, "No milestones found for project"
    m0 = milestones[0]
    print(f"[OK] Milestone 0 selected: '{m0['title']}' (Amount: INR {m0['amount']:,})")

    # -------------------------------------------------------------------------
    # 4. Contractor uploads image evidence
    # -------------------------------------------------------------------------
    print_step(4, "Contractor uploads image work evidence")

    # Create dummy PNG image bytes
    fake_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    
    upload_files = {
        "file": ("subbase_concrete_curing.png", io.BytesIO(fake_png_bytes), "image/png")
    }
    upload_data = {
        "description": "Geotagged site photograph showing Phase #1 concrete sub-base curing."
    }

    upload_res = client.post(
        f"/api/contractor/projects/{project_id}/milestones/0/evidence",
        files=upload_files,
        data=upload_data,
        headers=con_headers
    )
    assert upload_res.status_code == 200, f"Evidence upload failed: {upload_res.text}"
    upload_json = upload_res.json()
    assert upload_json.get("success") is True
    evidence_1 = upload_json.get("evidence")
    evidence_id_1 = evidence_1.get("evidence_id") or evidence_1.get("evidenceId")
    
    print(f"[OK] Evidence 1 uploaded: {evidence_id_1}")
    print(f"     Status: {evidence_1.get('status')} (Contractor sees: {upload_json.get('evidence_status')})")
    print(f"     File URL: {evidence_1.get('file_url')}")
    print(f"     SHA-256 Digest: {evidence_1.get('sha256_hash')}")

    # Verify fields stored in database
    ev_db = db.evidence.find_one({"$or": [{"evidence_id": evidence_id_1}, {"evidenceId": evidence_id_1}]})
    assert ev_db is not None, "Evidence not found in db.evidence"
    assert ev_db.get("status") == "SUBMITTED", f"Expected status SUBMITTED, got {ev_db.get('status')}"
    assert ev_db.get("project_id") == project_id
    assert ev_db.get("milestone_index") == 0
    assert ev_db.get("file_name") == "subbase_concrete_curing.png"
    assert ev_db.get("sha256_hash") is not None
    assert ev_db.get("uploaded_at") is not None
    print("[OK] All required Evidence database entity fields verified in db.evidence.")

    # -------------------------------------------------------------------------
    # 5. District sees the new evidence without manual refresh
    # -------------------------------------------------------------------------
    print_step(5, "District retrieves submitted evidence without refresh")

    dist_ev_res = client.get(f"/api/district/projects/{project_id}/milestones/0/evidence", headers=dist_headers)
    assert dist_ev_res.status_code == 200, f"District list evidence failed: {dist_ev_res.text}"
    dist_ev_json = dist_ev_res.json()
    assert dist_ev_json.get("success") is True
    ev_list = dist_ev_json.get("evidence", [])
    assert any(e.get("evidence_id") == evidence_id_1 or e.get("evidenceId") == evidence_id_1 for e in ev_list), "Evidence 1 not present in District list"
    
    # Also verify project details endpoint returns evidence
    dist_proj_res = client.get(f"/api/district/projects/{project_id}", headers=dist_headers)
    assert dist_proj_res.status_code == 200
    assert len(dist_proj_res.json().get("evidence", [])) >= 1
    print(f"[OK] District successfully retrieved {len(ev_list)} work evidence item(s) for Phase #1.")

    # -------------------------------------------------------------------------
    # 6. District previews image file directly (inline streaming)
    # -------------------------------------------------------------------------
    print_step(6, "District previews image deliverable directly (inline streaming)")

    # Stream with auth header
    file_res = client.get(f"/api/evidence/{evidence_id_1}/file", headers=dist_headers)
    assert file_res.status_code == 200, f"File streaming failed: {file_res.status_code}"
    assert file_res.headers.get("content-type") == "image/png"
    assert "inline" in file_res.headers.get("content-disposition", "")
    assert file_res.content == fake_png_bytes
    print("[OK] District inline image preview verified (Content-Disposition: inline, Content-Type: image/png).")

    # Stream with ?token= query parameter (for direct <img> browser tags)
    token_url_res = client.get(f"/api/evidence/{evidence_id_1}/file?token={dist_token}")
    assert token_url_res.status_code == 200
    assert token_url_res.headers.get("content-type") == "image/png"
    print("[OK] Image preview with query token verified (?token=...).")

    # Download parameter check
    dl_res = client.get(f"/api/evidence/{evidence_id_1}/file?download=true", headers=dist_headers)
    assert dl_res.status_code == 200
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    print("[OK] Forced download verified (Content-Disposition: attachment).")

    # -------------------------------------------------------------------------
    # 7. District verifies Evidence 1
    # -------------------------------------------------------------------------
    print_step(7, "District verifies evidence (Status -> VERIFIED)")

    verify_res = client.post(f"/api/district/evidence/{evidence_id_1}/verify", headers=dist_headers)
    assert verify_res.status_code == 200, f"Verify evidence failed: {verify_res.text}"
    verify_json = verify_res.json()
    assert verify_json.get("success") is True
    assert verify_json.get("evidence_status") == "VERIFIED"
    print(f"[OK] District verified evidence 1: Status is now VERIFIED.")

    # Check database record
    ev_updated = db.evidence.find_one({"$or": [{"evidence_id": evidence_id_1}, {"evidenceId": evidence_id_1}]})
    assert ev_updated.get("status") == "VERIFIED"
    assert ev_updated.get("verified_at") is not None
    assert ev_updated.get("verified_by") is not None
    print(f"[OK] Evidence verifiedAt and verifiedBy ({ev_updated.get('verified_by')}) recorded in database.")

    # -------------------------------------------------------------------------
    # 8. Contractor sees VERIFIED status
    # -------------------------------------------------------------------------
    print_step(8, "Contractor sees VERIFIED status on dashboard")

    con_ev_res = client.get(f"/api/contractor/projects/{project_id}/milestones/0/evidence", headers=con_headers)
    assert con_ev_res.status_code == 200
    con_ev_list = con_ev_res.json().get("evidence", [])
    ev_match = next((e for e in con_ev_list if e.get("evidence_id") == evidence_id_1 or e.get("evidenceId") == evidence_id_1), None)
    assert ev_match is not None
    assert ev_match.get("status") == "VERIFIED", f"Expected VERIFIED, got {ev_match.get('status')}"
    print("[OK] Contractor sees evidence status: VERIFIED.")

    # -------------------------------------------------------------------------
    # 9. Rejection Workflow: Contractor uploads second evidence item
    # -------------------------------------------------------------------------
    print_step(9, "Rejection Test: Contractor uploads second evidence document (PDF)")

    fake_pdf_bytes = b"%PDF-1.4\n%Test PDF document for work completion\n%%EOF"
    upload_pdf_files = {
        "file": ("asphalt_density_report.pdf", io.BytesIO(fake_pdf_bytes), "application/pdf")
    }
    upload_pdf_data = {
        "description": "Lab test core report for bituminous layer density."
    }

    upload_res_2 = client.post(
        f"/api/contractor/projects/{project_id}/milestones/0/evidence",
        files=upload_pdf_files,
        data=upload_pdf_data,
        headers=con_headers
    )
    assert upload_res_2.status_code == 200
    evidence_id_2 = upload_res_2.json()["evidence"]["evidence_id"]
    print(f"[OK] Evidence 2 (PDF) uploaded: {evidence_id_2} (Status: SUBMITTED)")

    # -------------------------------------------------------------------------
    # 10. District rejects Evidence 2 with Rejection Reason
    # -------------------------------------------------------------------------
    print_step(10, "District rejects Evidence 2 with mandatory rejection reason")

    rejection_reason_text = "Uploaded evidence does not clearly show completion of the milestone. Compaction density below 98% standard."
    reject_res = client.post(
        f"/api/district/evidence/{evidence_id_2}/reject",
        json={"rejection_reason": rejection_reason_text},
        headers=dist_headers
    )
    assert reject_res.status_code == 200, f"Reject evidence failed: {reject_res.text}"
    reject_json = reject_res.json()
    assert reject_json.get("success") is True
    assert reject_json.get("evidence_status") == "REJECTED"
    print(f"[OK] Evidence 2 rejected: Status is now REJECTED.")
    print(f"     Reason logged: '{reject_json.get('rejection_reason')}'")

    # Verify db record
    ev2_db = db.evidence.find_one({"$or": [{"evidence_id": evidence_id_2}, {"evidenceId": evidence_id_2}]})
    assert ev2_db.get("status") == "REJECTED"
    assert ev2_db.get("rejection_reason") == rejection_reason_text
    print("[OK] Evidence rejection_reason correctly persisted in MongoDB.")

    # -------------------------------------------------------------------------
    # 11. Contractor sees REJECTED status and rejection reason
    # -------------------------------------------------------------------------
    print_step(11, "Contractor sees REJECTED status and rejection reason")

    con_ev_res_2 = client.get(f"/api/contractor/projects/{project_id}/milestones/0/evidence", headers=con_headers)
    assert con_ev_res_2.status_code == 200
    ev2_match = next((e for e in con_ev_res_2.json()["evidence"] if e.get("evidence_id") == evidence_id_2), None)
    assert ev2_match is not None
    assert ev2_match.get("status") == "REJECTED"
    assert ev2_match.get("rejection_reason") == rejection_reason_text
    print(f"[OK] Contractor dashboard received REJECTED status with reason: '{ev2_match.get('rejection_reason')}'.")

    # -------------------------------------------------------------------------
    # 12. Contractor uploads corrected evidence
    # -------------------------------------------------------------------------
    print_step(12, "Contractor uploads corrected evidence")

    fake_corrected_pdf_bytes = b"%PDF-1.4\n%Rectified core test: 99.2% density achieved\n%%EOF"
    upload_corrected_files = {
        "file": ("asphalt_rectified_core_test.pdf", io.BytesIO(fake_corrected_pdf_bytes), "application/pdf")
    }
    upload_corrected_data = {
        "description": "Rectified lab test core report showing 99.2% compaction density."
    }

    upload_res_3 = client.post(
        f"/api/contractor/projects/{project_id}/milestones/0/evidence",
        files=upload_corrected_files,
        data=upload_corrected_data,
        headers=con_headers
    )
    assert upload_res_3.status_code == 200
    evidence_id_3 = upload_res_3.json()["evidence"]["evidence_id"]
    print(f"[OK] Corrected Evidence 3 uploaded: {evidence_id_3} (Status: SUBMITTED)")

    # -------------------------------------------------------------------------
    # 13. District reviews and verifies the new submission
    # -------------------------------------------------------------------------
    print_step(13, "District reviews and verifies the corrected submission")

    verify_res_3 = client.post(f"/api/district/evidence/{evidence_id_3}/verify", headers=dist_headers)
    assert verify_res_3.status_code == 200
    assert verify_res_3.json().get("evidence_status") == "VERIFIED"
    print(f"[OK] Corrected Evidence 3 verified by District Officer: Status: VERIFIED.")

    # -------------------------------------------------------------------------
    # 14. Security & Validation Controls
    # -------------------------------------------------------------------------
    print_step(14, "Security & File Validation Controls")

    # A. Disallow unauthorized file extension (.exe)
    invalid_file = {
        "file": ("malicious_payload.exe", io.BytesIO(b"MZ\x90\x00"), "application/x-msdownload")
    }
    invalid_res = client.post(
        f"/api/contractor/projects/{project_id}/milestones/0/evidence",
        files=invalid_file,
        data={"description": "Test invalid file"},
        headers=con_headers
    )
    assert invalid_res.status_code == 400, f"Expected 400 for .exe file, got {invalid_res.status_code}"
    print("[PASS] Disallowed file type (.exe) blocked with 400 Bad Request.")

    # B. Empty file rejection (0 bytes)
    empty_file = {
        "file": ("empty_image.png", io.BytesIO(b""), "image/png")
    }
    empty_res = client.post(
        f"/api/contractor/projects/{project_id}/milestones/0/evidence",
        files=empty_file,
        data={"description": "Test empty file"},
        headers=con_headers
    )
    assert empty_res.status_code == 400
    print("[PASS] Empty 0-byte file blocked with 400 Bad Request.")

    # C. Cross-contractor upload forbidden
    if con2_headers:
        cross_res = client.post(
            f"/api/contractor/projects/{project_id}/milestones/0/evidence",
            files={"file": ("unauthorized_test.png", io.BytesIO(fake_png_bytes), "image/png")},
            data={"description": "Unauthorized contractor submission"},
            headers=con2_headers
        )
        assert cross_res.status_code == 403, f"Expected 403 for unauthorized contractor, got {cross_res.status_code}"
        print("[PASS] Unauthorized contractor upload blocked with 403 Forbidden.")

    # D. Public unauthenticated access blocked
    public_res = client.get(f"/api/evidence/{evidence_id_1}/file")
    assert public_res.status_code in [401, 403], f"Expected 401/403 for unauthenticated public file access, got {public_res.status_code}"
    print("[PASS] Public unauthenticated access to private evidence blocked.")

    # E. Rejection without reason blocked
    no_reason_res = client.post(
        f"/api/district/evidence/{evidence_id_1}/reject",
        json={"rejection_reason": "   "},
        headers=dist_headers
    )
    assert no_reason_res.status_code == 400
    print("[PASS] Rejection without mandatory reason blocked with 400 Bad Request.")

    # F. Verify payment was NOT automatically released merely by uploading evidence
    proj_after = db.projects.find_one({"project_id": project_id})
    assert proj_after.get("released_amount", 0.0) == 0.0, "Payment must NOT be automatically released upon evidence upload"
    print("[PASS] Payment released_amount is 0.0 — No automatic release merely because evidence was uploaded.")

    print(f"\n{'='*75}\nALL 14 PROJECT WORK EVIDENCE & DISTRICT VERIFICATION TESTS PASSED!\n{'='*75}\n")

if __name__ == "__main__":
    run_all_tests()
