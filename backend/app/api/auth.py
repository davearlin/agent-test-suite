from datetime import timedelta
from typing import Any, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

try:
    from google.auth.transport import requests
    from google.oauth2 import id_token
    from google_auth_oauthlib.flow import Flow
    import os
    
    # SECURITY WARNING: Only allow HTTP for local development
    # This should NEVER be used in production environments
    if os.getenv('ENVIRONMENT', 'development').lower() in ['development', 'dev', 'local']:
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        print("WARNING: OAuth HTTP transport enabled for LOCAL DEVELOPMENT only")
    
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, verify_token, get_password_hash
from app.core.config import settings
from app.models import User
from app.models.schemas import (
    UserCreate, 
    UserLogin, 
    User as UserSchema, 
    Token,
    QuickTestPreferences,
    QuickTestPreferencesUpdate,
    TestRunPreferences,
    TestRunPreferencesUpdate
)
from app.models import UserRole

router = APIRouter()
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def create_google_oauth_flow():
    """Create Google OAuth flow."""
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth libraries not available"
        )
    
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=[
            'openid',
            'https://www.googleapis.com/auth/userinfo.email', 
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/cloud-platform.read-only',  # Required for list_projects
            'https://www.googleapis.com/auth/dialogflow',  # Required for Dialogflow operations
            'https://www.googleapis.com/auth/generative-language.retriever'  # Required for Generative Language API (LLM evaluations)
        ]
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get the current authenticated user, return None if not authenticated."""
    print(f"DEBUG: get_current_user_optional called with credentials: {bool(credentials)}")
    
    if not credentials:
        print("DEBUG: No credentials provided")
        return None
        
    print(f"DEBUG: Token received: {credentials.credentials[:20]}...")
    token_data = verify_token(credentials.credentials)
    print(f"DEBUG: Token verification result: {token_data}")
    
    if not token_data:
        print("DEBUG: Token verification failed")
        return None
    
    email = token_data.get("sub")
    print(f"DEBUG: Looking for user with email: {email}")
    
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        print(f"DEBUG: User not found or inactive: {user}")
        return None

    print(f"DEBUG: Found active user: {user.email}")
    return user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token_data = verify_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.email == token_data.get("sub")).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


@router.get("/google/login")
async def google_login():
    """Initiate Google OAuth login."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )
    
    flow = create_google_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    return {"authorization_url": authorization_url, "state": state}


@router.get("/google")
async def google_oauth_redirect():
    """Redirect directly to Google OAuth authorization page."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )
    
    flow = create_google_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    return RedirectResponse(url=authorization_url)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    try:
        import urllib.parse
        import requests as req_lib
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        # Parse the callback URL to extract the authorization code
        authorization_response = str(request.url)
        parsed_url = urllib.parse.urlparse(authorization_response)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        auth_code = query_params.get('code', [None])[0]
        
        if not auth_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No authorization code received"
            )
        
        # Exchange authorization code for tokens manually
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'code': auth_code,
            'client_id': settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'redirect_uri': settings.GOOGLE_REDIRECT_URI,
            'grant_type': 'authorization_code'
        }
        
        token_response = req_lib.post(token_url, data=token_data)
        if token_response.status_code != 200:
            print(f"Token exchange failed: {token_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code for tokens"
            )
        
        tokens = token_response.json()
        id_token_jwt = tokens.get('id_token')
        access_token = tokens.get('access_token')
        refresh_token = tokens.get('refresh_token')
        expires_in = tokens.get('expires_in', 3600)  # Default to 1 hour
        
        if not id_token_jwt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ID token received from Google"
            )
        
        # Verify and decode the ID token with clock skew tolerance for Docker/WSL2 environments
        user_info_request = google_requests.Request()
        id_info = id_token.verify_oauth2_token(
            id_token_jwt, user_info_request, settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10  # Allow 10 seconds of clock skew for Docker/WSL2
        )
        
        email = id_info.get("email")
        name = id_info.get("name", email)
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )
        
        # Calculate token expiration time
        from datetime import datetime, timedelta
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Check if user exists, create if not
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # All users start as admin by default
            # TODO: Implement role management feature to change user access rights
            role = UserRole.admin
            
            user = User(
                email=email,
                full_name=name,
                hashed_password="google_oauth",  # Not used for OAuth users
                role=role,
                is_active=True,
                google_access_token=access_token,
                google_refresh_token=refresh_token,
                google_token_expires_at=token_expires_at
            )
            db.add(user)
        else:
            # Update existing user's tokens
            user.google_access_token = access_token
            user.google_refresh_token = refresh_token
            user.google_token_expires_at = token_expires_at
            user.full_name = name  # Update name in case it changed
        
        db.commit()
        db.refresh(user)
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role.value}
        )
        
        # Debug logging
        print(f"DEBUG: Created user: {user.email}, role: {user.role.value}")
        print(f"DEBUG: Generated token for user: {user.email}")
        print(f"DEBUG: Frontend URL: {settings.FRONTEND_URL}")
        
        # Redirect to frontend with token
        frontend_url = settings.FRONTEND_URL
        redirect_url = f"{frontend_url}?token={access_token}"
        print(f"DEBUG: Redirecting to: {redirect_url}")
        
        return RedirectResponse(
            url=redirect_url,
            status_code=status.HTTP_303_SEE_OTHER
        )
        
    except Exception as e:
        print(f"Google OAuth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication failed"
        )


# Keep legacy login for development/testing
@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Legacy login endpoint."""
    user = db.query(User).filter(User.email == user_credentials.email).first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@router.get("/status")
async def auth_status(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Check authentication status."""
    print(f"DEBUG: Auth status check - current_user: {current_user.email if current_user else None}")
    return {
        "authenticated": current_user is not None,
        "user": current_user.email if current_user else None,
        "role": current_user.role.value if current_user else None,
        "google_oauth_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    }


@router.get("/preferences/quick-test", response_model=QuickTestPreferences)
async def get_quick_test_preferences(current_user: User = Depends(get_current_user)):
    """Get user's Quick Test preferences."""
    return QuickTestPreferences(
        project_id=current_user.quick_test_project_id,
        agent_id=current_user.quick_test_agent_id,
        flow_id=current_user.quick_test_flow_id,
        page_id=current_user.quick_test_page_id,
        playbook_id=current_user.quick_test_playbook_id,
        llm_model_id=current_user.quick_test_llm_model_id,
        session_id=current_user.quick_test_session_id,
        session_parameters=current_user.quick_test_session_parameters or {},
        pre_prompt_messages=current_user.quick_test_pre_prompt_messages or [],
        post_prompt_messages=current_user.quick_test_post_prompt_messages or [],
        enable_webhook=current_user.quick_test_enable_webhook
    )


@router.put("/preferences/quick-test", response_model=QuickTestPreferences)
async def update_quick_test_preferences(
    preferences: QuickTestPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's Quick Test preferences."""
    
    # Update only the fields that are provided
    if preferences.project_id is not None:
        current_user.quick_test_project_id = preferences.project_id
    if preferences.agent_id is not None:
        current_user.quick_test_agent_id = preferences.agent_id
    if preferences.flow_id is not None:
        current_user.quick_test_flow_id = preferences.flow_id
    if preferences.page_id is not None:
        current_user.quick_test_page_id = preferences.page_id
    if preferences.playbook_id is not None:
        current_user.quick_test_playbook_id = preferences.playbook_id
    if preferences.llm_model_id is not None:
        current_user.quick_test_llm_model_id = preferences.llm_model_id
    if preferences.session_id is not None:
        current_user.quick_test_session_id = preferences.session_id
    if preferences.session_parameters is not None:
        current_user.quick_test_session_parameters = preferences.session_parameters
    if preferences.pre_prompt_messages is not None:
        current_user.quick_test_pre_prompt_messages = preferences.pre_prompt_messages
    if preferences.post_prompt_messages is not None:
        current_user.quick_test_post_prompt_messages = preferences.post_prompt_messages
    if preferences.enable_webhook is not None:
        current_user.quick_test_enable_webhook = preferences.enable_webhook
    
    db.commit()
    db.refresh(current_user)
    
    return QuickTestPreferences(
        project_id=current_user.quick_test_project_id,
        agent_id=current_user.quick_test_agent_id,
        flow_id=current_user.quick_test_flow_id,
        page_id=current_user.quick_test_page_id,
        playbook_id=current_user.quick_test_playbook_id,
        llm_model_id=current_user.quick_test_llm_model_id,
        session_id=current_user.quick_test_session_id,
        session_parameters=current_user.quick_test_session_parameters or {},
        pre_prompt_messages=current_user.quick_test_pre_prompt_messages or [],
        post_prompt_messages=current_user.quick_test_post_prompt_messages or [],
        enable_webhook=current_user.quick_test_enable_webhook
    )


@router.get("/preferences/test-run", response_model=TestRunPreferences)
async def get_test_run_preferences(current_user: User = Depends(get_current_user)):
    """Get user's Test Run preferences."""
    return TestRunPreferences(
        test_run_project_id=current_user.test_run_project_id,
        test_run_agent_id=current_user.test_run_agent_id,
        test_run_flow_id=current_user.test_run_flow_id,
        test_run_page_id=current_user.test_run_page_id,
        test_run_playbook_id=current_user.test_run_playbook_id,
        test_run_llm_model_id=current_user.test_run_llm_model_id,
        test_run_session_parameters=current_user.test_run_session_parameters or {},
        test_run_pre_prompt_messages=current_user.test_run_pre_prompt_messages or [],
        test_run_post_prompt_messages=current_user.test_run_post_prompt_messages or [],
        test_run_enable_webhook=current_user.test_run_enable_webhook,
    test_run_evaluation_parameters=current_user.test_run_evaluation_parameters,
    test_run_batch_size=current_user.test_run_batch_size
    )


@router.put("/preferences/test-run", response_model=TestRunPreferences)
async def update_test_run_preferences(
    preferences: TestRunPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user's Test Run preferences."""
    
    update_data = preferences.model_dump(exclude_unset=True)
    logger.info(
        "Updating test run preferences",
        extra={
            "update_fields": {k: v for k, v in update_data.items() if k.startswith('test_run_')}
        }
    )

    for field_name, value in update_data.items():
        setattr(current_user, field_name, value)
    
    db.commit()
    db.refresh(current_user)

    logger.info(
        "Updated test run preference snapshot",
        extra={
            "stored_preferences": {
                "test_run_project_id": current_user.test_run_project_id,
                "test_run_agent_id": current_user.test_run_agent_id,
                "test_run_flow_id": current_user.test_run_flow_id,
                "test_run_page_id": current_user.test_run_page_id,
                "test_run_playbook_id": current_user.test_run_playbook_id,
                "test_run_llm_model_id": current_user.test_run_llm_model_id,
                "test_run_enable_webhook": current_user.test_run_enable_webhook,
                "test_run_evaluation_parameters": current_user.test_run_evaluation_parameters,
                "test_run_batch_size": current_user.test_run_batch_size
            }
        }
    )
    
    return TestRunPreferences(
        test_run_project_id=current_user.test_run_project_id,
        test_run_agent_id=current_user.test_run_agent_id,
        test_run_flow_id=current_user.test_run_flow_id,
        test_run_page_id=current_user.test_run_page_id,
        test_run_playbook_id=current_user.test_run_playbook_id,
        test_run_llm_model_id=current_user.test_run_llm_model_id,
        test_run_session_parameters=current_user.test_run_session_parameters or {},
        test_run_pre_prompt_messages=current_user.test_run_pre_prompt_messages or [],
        test_run_post_prompt_messages=current_user.test_run_post_prompt_messages or [],
        test_run_enable_webhook=current_user.test_run_enable_webhook,
        test_run_evaluation_parameters=current_user.test_run_evaluation_parameters,
        test_run_batch_size=current_user.test_run_batch_size
    )
