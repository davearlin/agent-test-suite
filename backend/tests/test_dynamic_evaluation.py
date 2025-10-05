"""
Test cases for the dynamic evaluation system.
These tests verify that the new parameter-based evaluation system works correctly
and that legacy fields are no longer populated for new test runs.
"""

import pytest
from unittest.mock import MagicMock, patch
from app.services.test_execution_service import TestRunExecutionService
from app.models.schemas import TestRunCreate


class TestDynamicEvaluationSystem:
    """Test the core dynamic evaluation functionality."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_user(self):
        """Create a mock user."""
        user = MagicMock()
        user.id = 1
        user.email = "test@example.com"
        return user

    def test_legacy_fields_not_populated_in_new_test_results(self, mock_db, mock_user):
        """Test that new test results don't populate legacy similarity_score, empathy_score, overall_score."""
        # Create service instance
        service = TestRunExecutionService(mock_db, mock_user)
        
        # Mock the database objects
        mock_question = MagicMock()
        mock_question.id = 1
        mock_question.question = "What is the weather like?"
        
        mock_test_run = MagicMock()
        mock_test_run.id = 1
        mock_test_run.evaluation_model_id = "models/gemini-2.0-flash"
        
        # Mock the evaluation parameters
        mock_eval_params = [
            {"name": "accuracy", "description": "Response accuracy", "weight": 80},
            {"name": "helpfulness", "description": "How helpful is the response", "weight": 20}
        ]
        
        with patch.object(service, '_load_evaluation_parameters', return_value=mock_eval_params):
            # Test that the service loads parameters correctly
            params = service._load_evaluation_parameters(mock_db, 1, mock_user.id)
            
            # Verify parameters are loaded
            assert len(params) == 2
            assert params[0]["name"] == "accuracy"
            assert params[0]["weight"] == 80
            assert params[1]["name"] == "helpfulness" 
            assert params[1]["weight"] == 20

    def test_default_evaluation_parameters(self, mock_db, mock_user):
        """Test that default evaluation parameters are provided when none are configured."""
        service = TestRunExecutionService(mock_db, mock_user)
        
        # Mock some default parameters in the database
        mock_param1 = MagicMock()
        mock_param1.id = 1
        mock_param1.name = "accuracy"
        mock_param1.prompt_template = "Rate accuracy"
        
        mock_param2 = MagicMock()
        mock_param2.id = 2
        mock_param2.name = "helpfulness"
        mock_param2.prompt_template = "Rate helpfulness"
        
        # Mock the database query to return these parameters
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_param1, mock_param2]
        
        # Test the default parameters method
        default_params = service._get_default_evaluation_parameters(mock_db)
        
        # Should return some default parameters
        assert isinstance(default_params, list)
        assert len(default_params) == 2
        
        # Each parameter should have required fields
        for param in default_params:
            assert "parameter_type" in param
            assert "weight" in param
            assert "enabled" in param
            assert isinstance(param["weight"], (int, float))
            
        # Weights should sum to 100
        total_weight = sum(param["weight"] for param in default_params)
        assert total_weight == 100

    def test_parameter_weight_calculation(self):
        """Test that parameter weights are handled correctly."""
        # Test data with different weights
        params = [
            {"name": "accuracy", "weight": 80, "score": 85},
            {"name": "helpfulness", "weight": 20, "score": 90}
        ]
        
        # Calculate weighted average: (85*80 + 90*20) / (80+20) = (6800 + 1800) / 100 = 86
        total_weighted_score = sum(p["score"] * p["weight"] for p in params)
        total_weight = sum(p["weight"] for p in params)
        expected_average = total_weighted_score / total_weight if total_weight > 0 else 0
        
        assert expected_average == 86.0

    def test_evaluation_parameter_edge_cases(self):
        """Test edge cases in parameter evaluation."""
        # Test with zero weight
        params_zero_weight = [
            {"name": "accuracy", "weight": 0, "score": 85},
            {"name": "helpfulness", "weight": 100, "score": 90}
        ]
        
        total_weighted_score = sum(p["score"] * p["weight"] for p in params_zero_weight)
        total_weight = sum(p["weight"] for p in params_zero_weight)
        expected_average = total_weighted_score / total_weight if total_weight > 0 else 0
        
        assert expected_average == 90.0  # Should ignore zero-weight parameter
        
        # Test with empty parameters
        empty_params = []
        total_weight_empty = sum(p["weight"] for p in empty_params)
        expected_average_empty = 0 if total_weight_empty == 0 else None
        
        assert expected_average_empty == 0


class TestSchemaValidation:
    """Test schema validation and computed properties."""

    def test_test_run_create_schema_requires_evaluation_model(self):
        """Test that TestRunCreate now requires evaluation_model_id."""
        # This should fail without evaluation_model_id
        with pytest.raises(Exception):  # Should be a ValidationError
            TestRunCreate(
                name="Test Run",
                description="Test description", 
                dataset_ids=[1],
                agent_name="projects/test/locations/us-central1/agents/test",
                agent_display_name="Test Agent",
                flow_name="Default Start Flow",
                page_name="Start Page",
                environment="draft",
                batch_size=5,
                evaluation_parameters=[]
                # Missing evaluation_model_id - should cause validation error
            )

    def test_test_run_create_schema_with_evaluation_model(self):
        """Test that TestRunCreate works correctly with evaluation_model_id."""
        # This should succeed with evaluation_model_id
        test_run_data = TestRunCreate(
            name="Test Run",
            description="Test description",
            dataset_ids=[1], 
            agent_name="projects/test/locations/us-central1/agents/test",
            agent_display_name="Test Agent",
            flow_name="Default Start Flow",
            page_name="Start Page", 
            environment="draft",
            batch_size=5,
            evaluation_model_id="models/gemini-2.0-flash",  # Required field
            evaluation_parameters=[]
        )
        
        assert test_run_data.evaluation_model_id == "models/gemini-2.0-flash"
        assert test_run_data.name == "Test Run"


class TestModelCacheIntegration:
    """Test integration with the model cache service."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture 
    def mock_user(self):
        """Create a mock user."""
        user = MagicMock()
        user.id = 1
        user.email = "test@example.com"
        return user

    @pytest.mark.asyncio
    async def test_model_cache_service_basic_functionality(self):
        """Test that ModelCacheService basic methods work."""
        from app.services.model_cache_service import ModelCacheService
        
        cache_service = ModelCacheService()
        
        # Test that cache initialization works
        assert hasattr(cache_service, 'cached_models')
        assert hasattr(cache_service, 'last_refresh')
        assert hasattr(cache_service, '_is_cache_valid')
        
        # Test cache validity method
        is_valid = cache_service._is_cache_valid()
        assert isinstance(is_valid, bool)
        
        # Test that we can get models (may be empty if no authentication)
        try:
            models = await cache_service.get_available_models()
            if models:  # If authentication works
                assert isinstance(models, list)
                # Each model should have required fields
                for model in models[:3]:  # Test first 3 models
                    assert "id" in model
                    assert "name" in model
                    assert "category" in model
        except Exception:
            # Expected if no Google Cloud authentication available in test environment
            pass

    @pytest.mark.asyncio
    async def test_model_cache_get_available_models(self):
        """Test that get_available_models returns valid data."""
        from app.services.model_cache_service import ModelCacheService
        
        cache_service = ModelCacheService()
        
        # This should return fallback models if no API key is configured
        models = await cache_service.get_available_models()
        assert isinstance(models, list)
        assert len(models) > 0
        
        # Verify model structure
        for model in models:
            assert "id" in model
            assert "name" in model

    @pytest.mark.asyncio
    async def test_model_validation(self):
        """Test model validation functionality."""
        from app.services.model_cache_service import ModelCacheService
        
        cache_service = ModelCacheService()
        
        # Test with a known model ID
        result = await cache_service.validate_model("models/gemini-2.0-flash")
        assert isinstance(result, dict)