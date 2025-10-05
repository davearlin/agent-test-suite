import pytest
from unittest.mock import MagicMock, patch

@pytest.fixture
def mock_db():
    """Mock database session for testing."""
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = MagicMock()
    mock_session.refresh = MagicMock()
    mock_session.query = MagicMock()
    mock_session.filter = MagicMock()
    mock_session.first = MagicMock(return_value=None)
    mock_session.all = MagicMock(return_value=[])
    mock_session.delete = MagicMock()
    return mock_session

@pytest.fixture
def mock_user():
    """Mock user object."""
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.role.value = "admin"
    user.is_active = True
    user.created_by_id = 1
    return user

@pytest.fixture
def auth_headers():
    """Mock authentication headers."""
    return {"Authorization": "Bearer mock_token"}

@pytest.fixture
def test_execution_service():
    """Mock test execution service for testing."""
    from app.services.test_execution_service import TestRunExecutionService
    return TestRunExecutionService()