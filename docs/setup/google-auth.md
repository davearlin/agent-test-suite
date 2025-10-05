# Google Cloud Authentication Setup

This application now uses **user-specific authentication** to ensure each user only sees the Dialogflow agents they have permission to access. This is a more secure approach than using a shared service account.

## How It Works

🔐 **User-Based Permissions**: When you log in, the app uses YOUR Google credentials to call Dialogflow APIs, respecting your individual access rights.

🎯 **Granular Access Control**: Even within the same Google Cloud project, different users may see different agents based on their IAM roles.

## Quick Setup (Recommended)

### Step 1: Sign In with Enhanced Permissions
1. **Go to the app**: http://localhost:3000
2. **Click "Sign In with Google"** 
3. **Important**: You'll now be asked for additional permissions:
   - ✅ Basic profile access (name, email)
   - ✅ **Google Cloud Platform access** (new!)
   - ✅ **Dialogflow API access** (new!)
4. **Click "Allow"** to grant these permissions

### Step 2: Verify Access
- Navigate to **Quick Test** page
- You should now see your actual Dialogflow agents
- Each user will see only agents they have permission to access

## What Changed?

### Before (Service Account Approach)
```
User Login → Backend uses shared service account → Shows ALL agents in project
```
**Problem**: Everyone saw the same agents regardless of individual permissions

### After (User Token Approach) 
```
User Login → Backend uses YOUR Google token → Shows only YOUR accessible agents
```
**Benefit**: Respects individual IAM permissions and project access

## Required IAM Roles

For users to see Dialogflow agents, they need these roles in your Google Cloud project:

### Essential Roles
- **Dialogflow API Client** - Basic API access
- **Dialogflow CX Developer** - Agent and session management  
- **Project Viewer** - Project metadata access

### Assigning Roles
1. **Google Cloud Console** → **IAM & Admin** → **IAM**
2. **Add Principal** → Enter user's email
3. **Assign roles** → Select the roles above
4. **Save**

## Troubleshooting

### "Please authenticate with Google Cloud" Message?

**Most Common**: You need to re-authenticate with expanded permissions
1. **Click "Sign In Again"** button in the app
2. **Grant the new permissions** (Google Cloud Platform + Dialogflow)
3. **Refresh the page**

**Alternative**: Clear your browser data and sign in fresh
1. **Sign out** from the app
2. **Clear browser cookies** for localhost
3. **Sign in again** with full permissions

### Still Seeing No Agents?

**Check your IAM permissions**:
1. Verify you have the required roles (listed above)
2. Make sure you're accessing the correct Google Cloud project
3. Contact your Google Cloud admin to verify access

**Check project configuration**:
1. Verify `GOOGLE_CLOUD_PROJECT` in your `.env` file matches your actual project
2. Make sure the project has Dialogflow CX API enabled

### Token Refresh Issues?

The app automatically refreshes your Google tokens. If you see authentication errors:
1. **Sign out and back in** to get fresh tokens
2. **Check if your Google account has 2FA** (may require app-specific setup)
3. **Verify your account hasn't been suspended** or lost permissions
- `Dialogflow CX Developer` (for agent access)

### Project not found?
1. Check your project ID: `gcloud config get-value project`
2. Set the correct project: `gcloud config set project YOUR_PROJECT_ID`
3. Verify you have access: `gcloud projects list`

## Environment Variables

The app will automatically detect:
- **Project ID** from your gcloud configuration
- **Credentials** from Application Default Credentials
- **Location** is automatically detected from each agent's configuration (supports all GCP regions)

No manual configuration needed!