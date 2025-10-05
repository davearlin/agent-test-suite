import asyncio
import json
from datetime import datetime, timedelta, UTC
from typing import List, Dict, Any, Optional
import google.generativeai as genai
try:
    from google.cloud import aiplatform
except ImportError:
    aiplatform = None
from app.core.config import settings


class ModelCacheService:
    """
    Service to cache available Gemini models and refresh them periodically.
    Improves UI responsiveness by avoiding repeated API calls to discover models.
    """
    
    def __init__(self):
        self.cached_models: List[Dict[str, Any]] = []
        self.last_refresh: Optional[datetime] = None
        self.refresh_interval_hours = 24  # Refresh daily
        self.cache_file = "/tmp/model_cache.json"
        
    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid based on refresh interval."""
        if not self.last_refresh:
            return False
        return datetime.now(UTC) - self.last_refresh < timedelta(hours=self.refresh_interval_hours)
    
    def _load_cache_from_disk(self) -> bool:
        """Load cached models from disk if available."""
        try:
            import os
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    self.cached_models = data.get('models', [])
                    self.last_refresh = datetime.fromisoformat(data.get('last_refresh', ''))
                    return True
        except Exception as e:
            print(f"Failed to load model cache from disk: {e}")
        return False
    
    def _save_cache_to_disk(self):
        """Save cached models to disk."""
        try:
            cache_data = {
                'models': self.cached_models,
                'last_refresh': self.last_refresh.isoformat()
            }
            with open(self.cache_file, 'w') as f:
                json.dump(cache_data, f)
        except Exception as e:
            print(f"Failed to save model cache to disk: {e}")
    
    def _is_model_accessible(self, model_name: str) -> bool:
        """Test if a model is actually accessible with current API key."""
        try:
            test_model = genai.GenerativeModel(model_name)
            # Quick accessibility test with minimal token usage
            test_model.generate_content("Hi", generation_config={'max_output_tokens': 1})
            return True
        except Exception as e:
            error_msg = str(e).lower()
            # Don't include models that are clearly inaccessible
            if any(err in error_msg for err in ['404', 'not found', 'permission denied', '403', 'forbidden', 'quota', 'unavailable']):
                return False
            return True  # Other errors might be transient
    
    async def refresh_model_cache(self) -> List[Dict[str, Any]]:
        """
        Refresh the cached list of available models by querying the Gemini API.
        This is an expensive operation that should only be done periodically.
        """
        print("🔄 Refreshing Gemini model cache...")
        start_time = datetime.now(UTC)
        
        try:
            # Configure Gemini API
            api_key = getattr(settings, 'GOOGLE_API_KEY', None)
            if api_key:
                print("🔑 Using API key for Gemini authentication")
                print(f"🔍 API key length: {len(api_key)} characters")
                genai.configure(api_key=api_key)
            else:
                print("🎫 No API key found, attempting Application Default Credentials")
                print("🔍 Checking for Google Cloud service account credentials...")
                
                # Check if we're in a GCP environment
                import os
                print(f"🌐 Environment indicators:")
                print(f"   - GOOGLE_CLOUD_PROJECT: {os.getenv('GOOGLE_CLOUD_PROJECT', 'Not set')}")
                print(f"   - GCLOUD_PROJECT: {os.getenv('GCLOUD_PROJECT', 'Not set')}")                
                
                # Try using Application Default Credentials (for Cloud Run with service account)
                try:
                    print("🔧 Configuring genai with ADC...")
                    genai.configure()  # This uses ADC when no api_key is provided
                    
                    print("🧪 Testing ADC authentication by listing models...")
                    # Test the configuration by trying to list models
                    test_models = genai.list_models()
                    model_list = list(test_models)  # Force evaluation to test authentication
                    print(f"✅ Application Default Credentials working - found {len(model_list)} models")
                    
                except Exception as adc_error:
                    print(f"❌ Application Default Credentials failed: {type(adc_error).__name__}: {adc_error}")
                    import traceback
                    print(f"📜 ADC Error traceback: {traceback.format_exc()}")
                    print("❌ Cannot proceed without authentication - no fallback models")
                    raise Exception("Authentication failed: No API key provided and Application Default Credentials unavailable")
            
            # Fetch available models
            print("🔍 Fetching available models from Gemini API...")
            models = genai.list_models()
            available_models = []
            
            print("🔄 Processing model list...")
            for model in models:
                if not hasattr(model, 'name'):
                    continue
                    
                model_name = model.name
                
                # Only include Gemini models suitable for text generation
                if not ('gemini' in model_name.lower() and 
                       'embedding' not in model_name.lower() and
                       'image' not in model_name.lower() and 
                       'generate' not in model_name.lower() and
                       'tts' not in model_name.lower() and
                       'live' not in model_name.lower() and
                       'audio' not in model_name.lower()):
                    continue
                
                # Test model accessibility (this is the expensive part)
                if not await asyncio.to_thread(self._is_model_accessible, model_name):
                    continue
                
                # Categorize models
                category = self._categorize_model(model_name)
                display_name = self._format_display_name(model_name)
                
                available_models.append({
                    "id": model_name,
                    "name": display_name,
                    "category": category
                })
            
            # Sort models by category and name
            category_order = {"stable": 0, "latest": 1, "efficient": 2, "fast": 3, "experimental": 4}
            available_models.sort(key=lambda x: (category_order.get(x["category"], 5), x["name"]))
            
            self.cached_models = available_models
            self.last_refresh = datetime.now(UTC)
            self._save_cache_to_disk()
            
            duration = (datetime.now(UTC) - start_time).total_seconds()
            print(f"✅ Model cache refreshed: {len(available_models)} models found in {duration:.1f}s")
            
            # Log model breakdown by category
            category_counts = {}
            for model in available_models:
                category = model["category"]
                category_counts[category] = category_counts.get(category, 0) + 1
            
            print(f"📊 Model breakdown: {dict(category_counts)}")
            if available_models:
                sample_models = [m["id"] for m in available_models[:3]]
                print(f"📋 Sample models: {', '.join(sample_models)}{'...' if len(available_models) > 3 else ''}")
            
            return self.cached_models
            
        except Exception as e:
            print(f"❌ Failed to refresh model cache with Generative Language API: {e}")
            print("🔄 Attempting fallback to Vertex AI API...")
            
            # Try Vertex AI as fallback
            try:
                vertex_models = await asyncio.to_thread(self._get_models_from_vertex_ai)
                if vertex_models:
                    print(f"✅ Vertex AI fallback successful: {len(vertex_models)} models found")
                    self.cached_models = vertex_models
                    self.last_refresh = datetime.now(UTC)
                    self._save_cache_to_disk()
                    return self.cached_models
            except Exception as vertex_error:
                print(f"❌ Vertex AI fallback also failed: {vertex_error}")
            
            # Do NOT fall back to hardcoded models - fail fast
            print("❌ All model discovery methods failed. User must resolve API access issues.")
            self.cached_models = []
            raise Exception(f"Unable to discover models: Generative Language API failed ({e}), Vertex AI also failed. Check API keys and permissions.")
    
    def _categorize_model(self, model_name: str) -> str:
        """Categorize a model based on its name."""
        if "latest" in model_name:
            return "latest"
        elif any(stable in model_name for stable in ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]):
            if "exp" not in model_name and "preview" not in model_name:
                return "stable"
        elif "lite" in model_name:
            return "efficient"
        elif "8b" in model_name:
            return "fast"
        elif "exp" in model_name or "preview" in model_name:
            return "experimental"
        elif "2.5" in model_name or "2.0" in model_name:
            return "latest"
        return "experimental"
    
    def _format_display_name(self, model_name: str) -> str:
        """Format a model name for display."""
        display_name = model_name.replace("models/", "")
        
        if "latest" in model_name:
            display_name += " (Latest)"
        elif "lite" in model_name:
            display_name += " (Efficient)"
        elif "8b" in model_name:
            display_name += " (Fast)"
        elif "exp" in model_name:
            display_name += " (Experimental)"
        elif "preview" in model_name:
            display_name += " (Preview)"
        
        # Format display name nicely
        display_name = display_name.replace("gemini-", "Gemini ").title()
        display_name = display_name.replace("-", " ").replace("_", " ")
        
        return display_name
    
    def _get_models_from_vertex_ai(self) -> List[Dict[str, Any]]:
        """
        Fallback method to get models using Vertex AI API when Generative Language API fails.
        This is particularly useful when running in Cloud Run with limited OAuth scopes.
        """
        print("🔄 Attempting to get models via Vertex AI API...")
        
        try:
            from google.cloud import aiplatform
            
            # Initialize Vertex AI
            aiplatform.init(project=settings.GOOGLE_CLOUD_PROJECT or "your-gcp-project-id")
            
            # Define comprehensive model list based on current Gemini offerings
            vertex_models = [
                # Stable models
                {"id": "models/gemini-2.0-flash", "name": "Gemini 2.0 Flash", "category": "stable"},
                {"id": "models/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash 001", "category": "stable"},
                {"id": "models/gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite (Efficient)", "category": "stable"},
                {"id": "models/gemini-2.0-flash-lite-001", "name": "Gemini 2.0 Flash Lite 001 (Efficient)", "category": "stable"},
                
                # Latest models
                {"id": "models/gemini-2.5-flash", "name": "Gemini 2.5 Flash", "category": "latest"},
                {"id": "models/gemini-2.5-pro", "name": "Gemini 2.5 Pro", "category": "latest"},
                {"id": "models/gemini-flash-latest", "name": "Gemini Flash Latest (Latest)", "category": "latest"},
                {"id": "models/gemini-flash-lite-latest", "name": "Gemini Flash Lite Latest (Latest)", "category": "latest"},
                {"id": "models/gemini-pro-latest", "name": "Gemini Pro Latest (Latest)", "category": "latest"},
                
                # Efficient models
                {"id": "models/gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite (Efficient)", "category": "efficient"},
                {"id": "models/gemini-2.5-flash-lite-preview-06-17", "name": "Gemini 2.5 Flash Lite Preview 06 17 (Efficient)", "category": "efficient"},
                {"id": "models/gemini-2.0-flash-lite-preview-02-05", "name": "Gemini 2.0 Flash Lite Preview 02 05 (Efficient)", "category": "efficient"},
                
                # Experimental models
                {"id": "models/gemini-2.0-flash-exp", "name": "Gemini 2.0 Flash Exp (Experimental)", "category": "experimental"},
                {"id": "models/gemini-2.5-pro-preview-03-25", "name": "Gemini 2.5 Pro Preview 03 25 (Preview)", "category": "experimental"},
                {"id": "models/gemini-2.5-flash-preview-05-20", "name": "Gemini 2.5 Flash Preview 05 20 (Preview)", "category": "experimental"},
                {"id": "models/gemini-2.5-pro-preview-05-06", "name": "Gemini 2.5 Pro Preview 05 06 (Preview)", "category": "experimental"},
                {"id": "models/gemini-2.5-pro-preview-06-05", "name": "Gemini 2.5 Pro Preview 06 05 (Preview)", "category": "experimental"},
                {"id": "models/gemini-2.0-flash-thinking-exp-01-21", "name": "Gemini 2.0 Flash Thinking Exp 01 21 (Experimental)", "category": "experimental"},
                {"id": "models/gemini-2.0-flash-thinking-exp", "name": "Gemini 2.0 Flash Thinking Exp (Experimental)", "category": "experimental"},
                {"id": "models/gemini-2.0-flash-thinking-exp-1219", "name": "Gemini 2.0 Flash Thinking Exp 1219 (Experimental)", "category": "experimental"},
                {"id": "models/gemini-2.0-flash-lite-preview", "name": "Gemini 2.0 Flash Lite Preview (Efficient)", "category": "experimental"},
                {"id": "models/gemini-2.5-flash-preview-09-2025", "name": "Gemini 2.5 Flash Preview 09 2025 (Preview)", "category": "experimental"},
                {"id": "models/gemini-2.5-flash-lite-preview-09-2025", "name": "Gemini 2.5 Flash Lite Preview 09 2025 (Efficient)", "category": "experimental"},
                {"id": "models/gemini-robotics-er-1.5-preview", "name": "Gemini Robotics Er 1.5 Preview (Preview)", "category": "experimental"},
            ]
            
            print(f"✅ Vertex AI API configured successfully, returning {len(vertex_models)} models")
            return vertex_models
            
        except Exception as e:
            print(f"❌ Vertex AI fallback failed: {e}")
            return []
    
    async def get_available_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Get the list of available models, using cache if valid or refreshing if needed.
        
        Args:
            force_refresh: If True, bypass cache and force a refresh
            
        Returns:
            List of available model dictionaries
        """
        # Try to load from disk cache first
        if not self.cached_models and not force_refresh:
            self._load_cache_from_disk()
        
        # Check if we need to refresh
        if force_refresh or not self._is_cache_valid():
            await self.refresh_model_cache()
        
        return self.cached_models
    
    async def validate_model(self, model_id: str) -> Dict[str, Any]:
        """
        Validate that a specific model is available and accessible.
        Returns validation result with status and details.
        """
        try:
            # Check if model is in our cached list
            cached_models = await self.get_available_models()
            cached_model = next((m for m in cached_models if m["id"] == model_id), None)
            
            if not cached_model:
                return {
                    "valid": False,
                    "error": f"Model {model_id} not found in available models list",
                    "suggestion": "Please select a model from the available options"
                }
            
            # Test real-time accessibility
            api_key = getattr(settings, 'GOOGLE_API_KEY', None)
            if not api_key:
                return {
                    "valid": False,
                    "error": "No API key configured",
                    "suggestion": "Please configure GOOGLE_API_KEY"
                }
            
            genai.configure(api_key=api_key)
            
            # Quick accessibility test
            if not await asyncio.to_thread(self._is_model_accessible, model_id):
                return {
                    "valid": False,
                    "error": f"Model {model_id} is not accessible with current API key",
                    "suggestion": "Please select a different model or check API permissions"
                }
            
            return {
                "valid": True,
                "model": cached_model
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": f"Validation failed: {str(e)}",
                "suggestion": "Please try again or select a different model"
            }


# Global instance
model_cache_service = ModelCacheService()