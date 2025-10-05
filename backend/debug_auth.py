"""
Debug script to diagnose model cache authentication issues.
This script can be run inside the Cloud Run container to check authentication.
"""

import os
import asyncio
from typing import List, Dict, Any

try:
    import google.generativeai as genai
    from google.auth import default
    from app.core.config import settings
    from app.services.model_cache_service import ModelCacheService
except ImportError as e:
    print(f"Import error: {e}")
    exit(1)


async def main():
    print("🔍 Diagnosing Gemini API Authentication in Cloud Run")
    print("=" * 60)
    
    # 1. Check environment variables
    print("\n1. 🔐 Environment Variables:")
    google_api_key = os.getenv('GOOGLE_API_KEY', '')
    gcp_project = os.getenv('GOOGLE_CLOUD_PROJECT', '')
    
    print(f"   GOOGLE_API_KEY: {'✅ Set' if google_api_key else '❌ Not set'}")
    print(f"   GOOGLE_CLOUD_PROJECT: {'✅ Set' if gcp_project else '❌ Not set'}")
    
    if google_api_key:
        print(f"   API Key (first 10 chars): {google_api_key[:10]}...")
    
    # 2. Check Application Default Credentials
    print("\n2. 🎫 Application Default Credentials:")
    try:
        credentials, project = default()
        print(f"   ✅ ADC available")
        print(f"   Project: {project}")
        print(f"   Service Account: {getattr(credentials, 'service_account_email', 'N/A')}")
    except Exception as e:
        print(f"   ❌ ADC failed: {e}")
    
    # 3. Test Gemini API with different auth methods
    print("\n3. 🧪 Testing Gemini API Authentication:")
    
    # Method 1: Try with API key (if available)
    if google_api_key:
        print("\n   Testing with API Key:")
        try:
            genai.configure(api_key=google_api_key)
            models = list(genai.list_models())
            print(f"   ✅ API Key works: {len(models)} models found")
        except Exception as e:
            print(f"   ❌ API Key failed: {e}")
    
    # Method 2: Try with Application Default Credentials
    print("\n   Testing with Application Default Credentials:")
    try:
        # Reset any previous configuration
        genai.configure()
        models = list(genai.list_models())
        print(f"   ✅ ADC works: {len(models)} models found")
        
        # Show first few models
        print("   📋 Available models (first 5):")
        for i, model in enumerate(models[:5]):
            print(f"      {i+1}. {model.name}")
            
    except Exception as e:
        print(f"   ❌ ADC failed: {e}")
    
    # 4. Test the actual ModelCacheService
    print("\n4. 🔧 Testing ModelCacheService:")
    try:
        cache_service = ModelCacheService()
        models = await cache_service.get_available_models(force_refresh=True)
        print(f"   ✅ Cache service returned {len(models)} models:")
        for model in models:
            print(f"      - {model['name']} ({model['id']})")
    except Exception as e:
        print(f"   ❌ Cache service failed: {e}")
    
    # 5. Environment information
    print(f"\n5. 🌍 Runtime Environment:")
    print(f"   Python: {os.sys.version.split()[0]}")
    print(f"   Hostname: {os.getenv('HOSTNAME', 'unknown')}")
    print(f"   K_SERVICE: {os.getenv('K_SERVICE', 'Not Cloud Run')}")
    print(f"   K_REVISION: {os.getenv('K_REVISION', 'N/A')}")


if __name__ == "__main__":
    asyncio.run(main())