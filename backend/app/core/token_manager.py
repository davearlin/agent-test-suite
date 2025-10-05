"""
Google OAuth token management utilities.
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

try:
    import requests
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

from app.core.config import settings
from app.models import User


class TokenManager:
    """Manages Google OAuth tokens for users."""
    
    @staticmethod
    def is_token_expired(user: User) -> bool:
        """Check if user's Google access token is expired."""
        if not user.google_token_expires_at:
            return True
        
        # Make sure both datetimes are timezone-aware for comparison
        now = datetime.utcnow()
        expires_at = user.google_token_expires_at
        
        # If expires_at is timezone-aware, make now timezone-aware too
        if expires_at.tzinfo is not None:
            from datetime import timezone
            now = now.replace(tzinfo=timezone.utc)
        # If expires_at is naive, make sure now is naive too
        elif now.tzinfo is not None:
            now = now.replace(tzinfo=None)
            
        return now >= expires_at
    
    @staticmethod
    def refresh_user_token(user: User, db: Session) -> bool:
        """
        Refresh user's Google access token using refresh token.
        Returns True if successful, False otherwise.
        """
        if not GOOGLE_AUTH_AVAILABLE:
            return False
            
        if not user.google_refresh_token:
            return False
        
        try:
            # Prepare refresh token request
            token_url = 'https://oauth2.googleapis.com/token'
            token_data = {
                'client_id': settings.GOOGLE_CLIENT_ID,
                'client_secret': settings.GOOGLE_CLIENT_SECRET,
                'refresh_token': user.google_refresh_token,
                'grant_type': 'refresh_token'
            }
            
            response = requests.post(token_url, data=token_data)
            if response.status_code != 200:
                print(f"Token refresh failed for {user.email}: {response.text}")
                return False
            
            tokens = response.json()
            new_access_token = tokens.get('access_token')
            expires_in = tokens.get('expires_in', 3600)
            
            if not new_access_token:
                return False
            
            # Update user's token in database
            user.google_access_token = new_access_token
            user.google_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            # Update refresh token if provided (Google may rotate it)
            new_refresh_token = tokens.get('refresh_token')
            if new_refresh_token:
                user.google_refresh_token = new_refresh_token
            
            db.commit()
            print(f"Successfully refreshed token for {user.email}")
            return True
            
        except Exception as e:
            print(f"Error refreshing token for {user.email}: {e}")
            return False
    
    @staticmethod
    def get_valid_token(user: User, db: Session) -> Optional[str]:
        """
        Get a valid Google access token for the user.
        Refreshes if necessary. Returns None if unable to get valid token.
        """
        if not user.google_access_token:
            return None
        
        # If token is not expired, return it
        if not TokenManager.is_token_expired(user):
            return user.google_access_token
        
        # Try to refresh the token
        if TokenManager.refresh_user_token(user, db):
            return user.google_access_token
        
        return None
    
    @staticmethod
    def has_sufficient_scopes(user: User) -> bool:
        """
        Check if user's stored Google tokens have the required scopes.
        This is a simplified check - we assume if they have no tokens or 
        tokens were created before our scope expansion, they need to re-auth.
        """
        if not user.google_access_token:
            return False
            
        # If user has tokens but we can't verify scopes directly,
        # we'll let the actual API call determine this
        return True
    
    @staticmethod
    def needs_scope_upgrade(user: User) -> bool:
        """
        Determine if user needs to upgrade their OAuth permissions.
        This typically happens for users who authenticated before we added
        Google Cloud Platform and Dialogflow scopes.
        """
        # If no tokens at all, they definitely need to authenticate
        if not user.google_access_token:
            return True
            
        # For existing users, we could check token creation date
        # or attempt an API call to verify scope sufficiency
        # For now, we'll rely on the actual Dialogflow API call to determine this
        return False
    
    @staticmethod
    def create_credentials(access_token: str, refresh_token: Optional[str] = None) -> Optional[Credentials]:
        """Create Google credentials object from tokens."""
        if not GOOGLE_AUTH_AVAILABLE:
            return None
            
        try:
            credentials = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                scopes=[
                    'https://www.googleapis.com/auth/cloud-platform',
                    'https://www.googleapis.com/auth/dialogflow'
                ]
            )
            return credentials
        except Exception as e:
            print(f"Error creating credentials: {e}")
            return None