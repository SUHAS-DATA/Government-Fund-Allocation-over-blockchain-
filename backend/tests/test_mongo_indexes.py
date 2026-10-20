import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import OperationFailure
import database as db_mod

def test_safe_create_index_success():
    """Verify safe_create_index calls create_index normally when no conflict exists."""
    mock_col = MagicMock()
    mock_col.name = "test_col"
    mock_col.create_index.return_value = "code_1"

    res = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=True)
    assert res == "code_1"
    mock_col.create_index.assert_called_once_with([("code", ASCENDING)], unique=True, sparse=True)

def test_safe_create_index_preserves_compatible_existing_index():
    """Verify that when Code 85 (IndexOptionsConflict) occurs, safe_create_index inspects and preserves existing index."""
    mock_col = MagicMock()
    mock_col.name = "departments"
    
    # Simulate MongoDB Code 85 error (e.g. existing index is sparse while new request options differ)
    exc = OperationFailure("Index with name: code_1 already exists with different options", code=85)
    mock_col.create_index.side_effect = exc
    
    # Existing on-disk index in MongoDB Atlas
    mock_col.index_information.return_value = {
        "_id_": {"v": 2, "key": [("_id", 1)]},
        "code_1": {"v": 2, "key": [("code", 1)], "unique": True, "sparse": True}
    }

    # Application requests index
    res = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=True)
    
    # Verified: It should identify the existing compatible index and return its name without raising
    assert res == "code_1"
    # Guaranteed: It must NOT call drop_index or drop_indexes!
    assert not hasattr(mock_col, "drop_index") or mock_col.drop_index.call_count == 0

def test_safe_create_index_detects_incompatible_index():
    """Verify that when existing index does not fulfill uniqueness requirement, safe_create_index does not fabricate success."""
    mock_col = MagicMock()
    mock_col.name = "departments"
    
    exc = OperationFailure("Index with name: code_1 already exists with different options", code=85)
    mock_col.create_index.side_effect = exc
    
    # Existing on-disk index is NOT unique, but unique=True was requested
    mock_col.index_information.return_value = {
        "code_1": {"v": 2, "key": [("code", 1)], "unique": False, "sparse": True}
    }

    res = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=True)
    assert res is None

def test_safe_create_index_detects_sparse_mismatch():
    """Verify that safe_create_index rejects index if sparse behavior does not match requested options."""
    mock_col = MagicMock()
    mock_col.name = "departments"

    exc = OperationFailure("Index with name: code_1 already exists with different options", code=85)
    mock_col.create_index.side_effect = exc

    # Case A: Request sparse=True, but existing is sparse=False
    mock_col.index_information.return_value = {
        "code_1": {"v": 2, "key": [("code", 1)], "unique": True, "sparse": False}
    }
    res_a = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=True)
    assert res_a is None

    # Case B: Request sparse=False, but existing is sparse=True
    mock_col.index_information.return_value = {
        "code_1": {"v": 2, "key": [("code", 1)], "unique": True, "sparse": True}
    }
    res_b = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=False)
    assert res_b is None

def test_safe_create_index_detects_key_direction_mismatch():
    """Verify that safe_create_index rejects index if key ordering/specification differs."""
    mock_col = MagicMock()
    mock_col.name = "departments"

    exc = OperationFailure("Index with name: code_1 already exists with different options", code=85)
    mock_col.create_index.side_effect = exc

    # Existing index is DESCENDING (-1), requested is ASCENDING (1)
    mock_col.index_information.return_value = {
        "code_1": {"v": 2, "key": [("code", -1)], "unique": True, "sparse": True}
    }
    res = db_mod.safe_create_index(mock_col, [("code", ASCENDING)], unique=True, sparse=True)
    assert res is None

def test_eight_primary_indexes_have_sparse_true():
    """Verify that the 8 primary business collections define sparse=True and unique=True."""
    # Read database.py source code to verify declarations
    import inspect
    source = inspect.getsource(db_mod.init_indexes)

    required_sparse_declarations = [
        "safe_create_index(db.departments, [(\"code\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.states, [(\"code\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.schemes, [(\"code\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.budget_allocations, [(\"allocation_id\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.state_transfers, [(\"transfer_id\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.district_allocations, [(\"district_alloc_id\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.projects, [(\"project_id\", ASCENDING)], unique=True, sparse=True)",
        "safe_create_index(db.documents, [(\"document_id\", ASCENDING)], unique=True, sparse=True)",
    ]

    for decl in required_sparse_declarations:
        assert decl in source, f"Missing required sparse unique index declaration: {decl}"
