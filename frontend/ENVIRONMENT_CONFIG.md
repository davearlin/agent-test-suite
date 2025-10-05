# Frontend Environment Configuration

The frontend uses different configuration files depending on the development scenario:

## Configuration Files

### `.env.local` (Gitignored - Personal Development Settings)
This file controls where the frontend sends API requests during development.

**Default Configuration (Local Docker Backend):**
```bash
# Uses Vite proxy to localhost:8000 (Docker backend)
VITE_API_BASE_URL=
```

**GCP Backend Configuration:**
```bash
# Bypasses proxy, calls GCP Cloud Run directly
VITE_API_BASE_URL=https://your-backend-url.run.app
```

### `.env.production` (Generated at Deploy Time)
Used automatically for production builds and Firebase deployment:
```bash
# Generated dynamically by GitHub Actions from Terraform output
VITE_API_BASE_URL=https://dialogflow-tester-backend-dev-XXXXX.us-central1.run.app
# URL is determined at deployment time based on actual Cloud Run service URL
```

## Development Scenarios

### Scenario 1: Full Local Development (Docker Compose)
1. Ensure `VITE_API_BASE_URL=` (empty) in `.env.local`
2. Start Docker backend: `docker compose up -d`
3. Start frontend: `npm run dev`
4. Frontend proxies API calls to localhost:8000

### Scenario 2: Frontend Development Against GCP Backend
1. Set `VITE_API_BASE_URL=https://...` in `.env.local`
2. Start frontend: `npm run dev`
3. Frontend makes direct API calls to GCP Cloud Run

### Scenario 3: Production (Firebase + GCP)
1. GitHub Actions builds and deploys backend via Terraform
2. Terraform outputs the actual Cloud Run service URL
3. Frontend build uses the dynamic backend URL from Terraform
4. Firebase deployment uses the correctly configured frontend

**Deployment Flow:**
```bash
Terraform → Deploy Backend → Get Backend URL → Build Frontend → Deploy to Firebase
```

## Switching Between Environments

1. Edit `frontend/.env.local`
2. Comment/uncomment the `VITE_API_BASE_URL` line
3. Restart the development server: `npm run dev`

## Troubleshooting

**Problem**: API calls go to localhost instead of GCP
**Solution**: Check that `VITE_API_BASE_URL` is set correctly in `.env.local`

**Problem**: 401 errors on auto-refresh
**Solution**: Ensure you're authenticated in the environment you're targeting

**Problem**: CORS errors
**Solution**: Use the proxy approach (empty `VITE_API_BASE_URL`) for local development