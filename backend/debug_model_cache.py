"""
Diagnostic script to debug model cache issues in GCP Sandbox.
Run this to identify why only 3 models are showing up.
"""

import asyncio
import os
from typing import List, Dict, Any

try:
    import google.generativeai as genai
    from app.core.config import settings
    from app.services.model_cache_service import ModelCacheService
except ImportError as e:
    print(f"Import error: {e}")
    print("This script should be run from within the Docker container")
    exit(1)


async def diagnose_model_cache():
    """Comprehensive diagnosis of model cache issues."""
    print("🔍 Diagnosing Model Cache Issues in GCP Sandbox")
    print("=" * 50)
    
    # 1. Check API key configuration
    print("\n1. 📋 API Key Configuration:")
    api_key = getattr(settings, 'GOOGLE_API_KEY', None)
    if not api_key:
        print("❌ No GOOGLE_API_KEY found in settings")
        print("💡 This explains why only 3 fallback models are shown")
        return
    else:
        print(f"✅ API key configured (length: {len(api_key)} chars)")
        print(f"🔑 Key prefix: {api_key[:10]}...")
    
    # 2. Test basic API connectivity
    print("\n2. 🌐 API Connectivity Test:")
    try:
        genai.configure(api_key=api_key)
        models = genai.list_models()
        model_count = len(list(models))
        print(f"✅ Successfully connected to Gemini API")
        print(f"📊 Total models returned by API: {model_count}")
    except Exception as e:
        print(f"❌ Failed to connect to Gemini API: {e}")
        print("💡 This explains why fallback models are used")
        return
    
    # 3. Analyze model filtering
    print("\n3. 🔍 Model Filtering Analysis:")
    genai.configure(api_key=api_key)
    models = genai.list_models()
    
    all_models = []
    gemini_models = []
    accessible_models = []
    
    cache_service = ModelCacheService()
    
    for model in models:
        if not hasattr(model, 'name'):
            continue
        
        model_name = model.name
        all_models.append(model_name)
        
        # Check Gemini filtering
        if ('gemini' in model_name.lower() and 
            'embedding' not in model_name.lower() and
            'image' not in model_name.lower() and 
            'generate' not in model_name.lower() and
            'tts' not in model_name.lower() and
            'live' not in model_name.lower() and
            'audio' not in model_name.lower()):
            gemini_models.append(model_name)
            
            # Test accessibility
            print(f"🧪 Testing accessibility: {model_name}")
            try:
                is_accessible = cache_service._is_model_accessible(model_name)
                if is_accessible:
                    accessible_models.append(model_name)
                    print(f"  ✅ Accessible")
                else:
                    print(f"  ❌ Not accessible")
            except Exception as e:
                print(f"  ❌ Error testing: {e}")
    
    print(f"\n📊 Filtering Results:")
    print(f"  All models from API: {len(all_models)}")
    print(f"  After Gemini filtering: {len(gemini_models)}")
    print(f"  After accessibility test: {len(accessible_models)}")
    
    # 4. Show accessible models
    print(f"\n4. ✅ Accessible Models ({len(accessible_models)}):")
    for model in accessible_models:
        category = cache_service._categorize_model(model)
        display_name = cache_service._format_display_name(model)
        print(f"  {model} → {display_name} ({category})")
    
    # 5. Test the actual cache service
    print(f"\n5. 🔧 Cache Service Test:")
    try:
        models = await cache_service.get_available_models(force_refresh=True)
        print(f"✅ Cache service returned {len(models)} models:")
        for model in models:
            print(f"  {model['id']} → {model['name']} ({model['category']})")
    except Exception as e:
        print(f"❌ Cache service failed: {e}")
    
    # 6. Environment info
    print(f"\n6. 🌍 Environment Information:")
    print(f"  Python version: {os.sys.version}")
    print(f"  Container environment: {os.environ.get('HOSTNAME', 'unknown')}")
    print(f"  Google API library version: {genai.__version__ if hasattr(genai, '__version__') else 'unknown'}")


if __name__ == "__main__":
    asyncio.run(diagnose_model_cache())