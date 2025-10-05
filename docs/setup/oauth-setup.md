# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for your Dialogflow Agent Tester application.

## Prerequisites

- Google Cloud Project with Dialogflow CX API enabled
- Google Cloud Console access

## Step 1: Create OAuth 2.0 Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your Google Cloud project

2. **Navigate to APIs & Services > Credentials**
   - Click on "APIs & Services" in the left sidebar
   - Click on "Credentials"

3. **Create OAuth 2.0 Client ID**
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - Choose "Web application" as the application type

4. **Configure the OAuth Client**
   - **Name**: `Dialogflow Agent Tester`
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000`
     - `http://localhost:8000`
   - **Authorized redirect URIs**: 
     - `http://localhost:8000/api/v1/auth/google/callback`

5. **Save and Download**
   - Click "CREATE"
   - Note down the **Client ID** and **Client Secret**

## Step 2: Set Environment Variables

Create a `.env` file in your project root (or set these in your environment):

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

# Optional: Google Cloud Project (if not auto-detected)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

## Step 3: Configure OAuth Consent Screen

1. **Go to OAuth consent screen**
   - In Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"

2. **Configure consent screen**
   - **User Type**: Internal (for your organization only) or External
   - **App name**: Dialogflow Agent Tester
   - **User support email**: Your email
   - **Developer contact information**: Your email

3. **Add Scopes**
   - Add these required scopes:
     - `../auth/userinfo.email` (User identity)
     - `../auth/userinfo.profile` (User name and photo)
     - `../auth/cloud-platform.read-only` (List GCP projects)
     - `../auth/dialogflow` (Dialogflow CX operations)
     - `../auth/generative-language.retriever` (Generative Language API for LLM evaluations)

4. **Add Test Users** (if using External user type)
   - Add `user@example.com` and other authorized users

## Step 4: Test the Setup

1. **Restart your application**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Visit the application**:
   - Go to `http://localhost:3000`
   - You should see the modern landing page
   - Click "Sign in with Google"
   - Complete the OAuth flow

## Security Notes

- **Client Secret**: Keep this secret and never commit it to version control
- **Internal Apps**: Use "Internal" user type for better security within your organization
- **HTTPS**: In production, use HTTPS URLs for all OAuth configurations

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Ensure the redirect URI in Google Cloud Console exactly matches: `http://localhost:8000/api/v1/auth/google/callback`

### Error: "unauthorized_client"
- Check that the OAuth consent screen is properly configured
- Verify that your domain is authorized

### Error: "access_denied"
- User clicked "Cancel" during OAuth flow
- User's email domain may not be authorized

## User Roles

The application automatically assigns roles based on email domains:
- **All users**: Admin role (full access by default)
- **Other domains**: Viewer role (read-only access)

## Next Steps

After successful OAuth setup:
1. Users can authenticate with their Google accounts
2. The app will use their Google Cloud credentials for Dialogflow access
3. All authenticated users get admin role by default!

The application will automatically create user accounts on first login via Google OAuth.