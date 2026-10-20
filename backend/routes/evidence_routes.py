import os
import mimetypes
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status, Query
from fastapi.responses import FileResponse
from database import db, serialize_doc
from auth_middleware import decode_token

router = APIRouter()

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def resolve_evidence_user(request: Request, token: Optional[str] = None) -> Optional[dict]:
    """
    Extract authenticated user payload from either Authorization header
    or URL query parameter (for direct browser <img> and <iframe> previews).
    """
    auth_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        auth_token = auth_header.split(" ")[1].strip()
    elif token:
        auth_token = token.strip()
    elif request.query_params.get("token"):
        auth_token = request.query_params.get("token").strip()

    if not auth_token:
        return None

    try:
        return decode_token(auth_token)
    except Exception:
        return None

def check_evidence_access(proj: dict, user: dict) -> bool:
    """
    Enforces RBAC and project ownership/jurisdiction for evidence inspection:
    - Contractor can only access evidence for their own assigned project.
    - District officer can only access evidence for projects in their assigned district.
    - Higher administrative tiers (STATE, FINANCE, ADMIN, SUPER_ADMIN) have authorized audit access.
    - Public access is forbidden for internal work evidence.
    """
    if not user or not proj:
        return False

    role = user.get("role")
    if role in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        return True

    if role == "STATE":
        user_state = (user.get("state_code") or "").strip().upper()
        proj_state = (proj.get("state_code") or "").strip().upper()
        return bool(user_state and proj_state and user_state == proj_state)

    if role == "DISTRICT":
        user_dist = (user.get("district_name") or "").strip().lower()
        proj_dist = (proj.get("district_name") or "").strip().lower()
        return bool(user_dist and user_dist == proj_dist)

    if role == "CONTRACTOR":
        from routes.contractor_routes import verify_contractor_project_ownership
        return verify_contractor_project_ownership(proj, user)

    return False

@router.get("/{evidence_id}/file")
async def get_evidence_file(
    evidence_id: str,
    request: Request,
    token: Optional[str] = Query(None),
    download: Optional[bool] = Query(False)
):
    """
    Stream or download work evidence file with strict role-based access control.
    Supports inline preview for photos and PDFs, without forcing download.
    """
    user = resolve_evidence_user(request, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access work evidence deliverables."
        )

    # Find evidence record
    ev = db.evidence.find_one({
        "$or": [
            {"evidence_id": evidence_id},
            {"evidenceId": evidence_id},
            {"document_id": evidence_id}
        ]
    })
    
    # Fallback to documents collection if legacy record
    if not ev:
        ev = db.documents.find_one({"document_id": evidence_id})

    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found."
        )

    # Lookup parent project
    project_id = ev.get("project_id") or ev.get("projectId") or ev.get("entity_id")
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated project not found."
        )

    # Verify authorization
    if not check_evidence_access(proj, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You are not authorized to access work evidence for this project."
        )

    # Locate physical file
    file_path = ev.get("file_path") or ev.get("filePath")
    if not file_path or not os.path.exists(file_path):
        candidates = []
        if file_path:
            candidates.append(os.path.basename(file_path))
        fname = ev.get("file_name") or ev.get("fileName")
        if fname:
            candidates.append(fname)

        for c in candidates:
            alt_path = os.path.join(UPLOAD_FOLDER, c)
            if os.path.exists(alt_path):
                file_path = alt_path
                break
            alt_ev_path = os.path.join(UPLOAD_FOLDER, "evidence", c)
            if os.path.exists(alt_ev_path):
                file_path = alt_ev_path
                break

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file asset missing from secure storage repository."
        )

    # Infer media type
    orig_name = ev.get("file_name") or ev.get("fileName") or os.path.basename(file_path)
    content_type = ev.get("file_type") or ev.get("fileType")
    if not content_type or content_type == "application/octet-stream":
        guessed_type, _ = mimetypes.guess_type(file_path)
        content_type = guessed_type or "application/octet-stream"

    # Set disposition header
    clean_name = os.path.basename(orig_name).replace('"', '')
    disposition = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{clean_name}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate"
    }

    return FileResponse(
        path=file_path,
        media_type=content_type,
        headers=headers
    )

@router.get("/{evidence_id}")
async def get_evidence_details(
    evidence_id: str,
    request: Request,
    token: Optional[str] = Query(None)
):
    """Retrieve metadata and verification status for a specific evidence item"""
    user = resolve_evidence_user(request, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required."
        )

    ev = db.evidence.find_one({
        "$or": [
            {"evidence_id": evidence_id},
            {"evidenceId": evidence_id}
        ]
    })
    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found."
        )

    proj = db.projects.find_one({"project_id": ev.get("project_id") or ev.get("projectId")})
    if not proj or not check_evidence_access(proj, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to access evidence metadata."
        )

    return {
        "success": True,
        "evidence": serialize_doc(ev)
    }

@router.get("/project/{project_id}/milestone/{milestone_index}")
async def get_milestone_evidence(
    project_id: str,
    milestone_index: int,
    request: Request,
    token: Optional[str] = Query(None)
):
    """Retrieve all submitted evidence items for a specific project milestone"""
    user = resolve_evidence_user(request, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required."
        )

    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found."
        )

    if not check_evidence_access(proj, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You cannot view evidence for this project."
        )

    query = {
        "$and": [
            {"$or": [{"project_id": project_id}, {"projectId": project_id}]},
            {"$or": [{"milestone_index": milestone_index}, {"milestoneId": f"MS-{project_id}-{milestone_index + 1}"}]}
        ]
    }
    
    evidence_list = list(db.evidence.find(query).sort("uploaded_at", -1))
    return {
        "success": True,
        "project_id": project_id,
        "milestone_index": milestone_index,
        "evidence_count": len(evidence_list),
        "evidence": serialize_doc(evidence_list)
    }
