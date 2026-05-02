# Local Azure Deployment (Separate Services, No GitHub Actions)

This guide deploys backend and frontend from your local machine directly to Azure App Service containers.
It is independent of GitHub workflow settings.

## 1. Current Target Resource Names

Use these exact values unless you intentionally rename Azure resources.

- Subscription: bc8465fd-0da7-430a-8710-428d38d0ec99
- Resource Group: RG-DT4-devops-dt4-15
- ACR Name: vikasacr267549
- ACR Login Server: vikasacr267549.azurecr.io
- Backend App Service: Backend-Personal-Ops
- Frontend App Service: Frontend-Personnal-Ops

## 2. What Must Be Correct Before Deploy

- Frontend image must be built with the backend public API URL.
- Backend CORS must allow frontend Azure hostname.
- Both web app names must match actual Azure resource names exactly.

## 3. Required Local Tools

- Docker Desktop
- Azure CLI (az)
- Logged into Azure with permissions on the resource group

## 4. One-Time Local Session Setup

```bash
az login
az account set --subscription bc8465fd-0da7-430a-8710-428d38d0ec99
az acr login --name vikasacr267549
```

Optional verification:

```bash
az webapp show --name Backend-Personal-Ops --resource-group RG-DT4-devops-dt4-15 --query "{name:name,host:defaultHostName}" -o table
az webapp show --name Frontend-Personnal-Ops --resource-group RG-DT4-devops-dt4-15 --query "{name:name,host:defaultHostName}" -o table
```

## 5. Deploy Backend From Local

From repository root:

Option A (local build + push):

```bash
docker build -t vikasacr267549.azurecr.io/personal-ops-backend:manual ./backend

docker push vikasacr267549.azurecr.io/personal-ops-backend:manual
```

Option B (remote ACR build, no local Docker build needed):

```bash
az acr build \
  --registry vikasacr267549 \
  --image personal-ops-backend:manual \
  ./backend
```

Then configure App Service container image:

```bash

az webapp config container set \
  --name Backend-Personal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --container-image-name vikasacr267549.azurecr.io/personal-ops-backend:manual \
  --container-registry-url https://vikasacr267549.azurecr.io
```

Set backend runtime app settings (update values):

```bash
az webapp config appsettings set \
  --name Backend-Personal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    MONGODB_URI="<your-mongodb-uri>" \
    JWT_SECRET="<your-jwt-secret>" \
    CORS_ORIGINS="https://frontend-personnal-ops-feg6cagkdjf0hmcz.canadacentral-01.azurewebsites.net"
```

## 6. Deploy Frontend From Local

Frontend Dockerfile builds React with build arg REACT_APP_API_BASE_URL.
Use backend public URL here.

Option A (local build + push):

```bash
docker build \
  -t vikasacr267549.azurecr.io/personal-ops-frontend:manual \
  --build-arg REACT_APP_API_BASE_URL="https://backend-personal-ops-feg6cagkdjf0hmcz.canadacentral-01.azurewebsites.net/api" \
  ./frontend

docker push vikasacr267549.azurecr.io/personal-ops-frontend:manual
```

Option B (remote ACR build with build arg):

```bash
az acr build \
  --registry vikasacr267549 \
  --image personal-ops-frontend:manual \
  --build-arg REACT_APP_API_BASE_URL="https://backend-personal-ops-feg6cagkdjf0hmcz.canadacentral-01.azurewebsites.net/api" \
  ./frontend
```

Then configure App Service container image:

```bash

az webapp config container set \
  --name Frontend-Personnal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --container-image-name vikasacr267549.azurecr.io/personal-ops-frontend:manual \
  --container-registry-url https://vikasacr267549.azurecr.io
```

Set frontend web app port setting (nginx listens on 80):

```bash
az webapp config appsettings set \
  --name Frontend-Personnal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --settings WEBSITES_PORT=80
```

## 7. Restart and Verify

```bash
az webapp restart --name Backend-Personal-Ops --resource-group RG-DT4-devops-dt4-15
az webapp restart --name Frontend-Personnal-Ops --resource-group RG-DT4-devops-dt4-15

az webapp show --name Backend-Personal-Ops --resource-group RG-DT4-devops-dt4-15 --query defaultHostName -o tsv
az webapp show --name Frontend-Personnal-Ops --resource-group RG-DT4-devops-dt4-15 --query defaultHostName -o tsv
```

Backend health check:
- Open https://<backend-hostname>/

Frontend check:
- Open https://<frontend-hostname>/

## 8. Minimal Project Changes Needed

No mandatory code rewrite is required for local Azure deploy.
Only ensure these are always set correctly:

1. Frontend build arg REACT_APP_API_BASE_URL points to backend public /api URL.
2. Backend app setting CORS_ORIGINS includes frontend public URL.
3. Azure app names match exactly (Backend-Personal-Ops and Frontend-Personnal-Ops).

## 9. Optional Improvement (Recommended)

If you want to avoid rebuilding frontend for every backend URL change, implement runtime config injection (env.js generated at container start). This is optional and can be added later.

## 10. 403: Web App Stopped (QuotaExceeded) - Fix

If `az webapp show` returns `state: QuotaExceeded`, the issue is App Service plan quota exhaustion.
This is not a Docker image problem.

Check current app state:

```bash
az webapp show \
  --name Frontend-Personnal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "{name:name,state:state,host:defaultHostName}" -o table

az webapp show \
  --name Backend-Personal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "{name:name,state:state,host:defaultHostName}" -o table
```

Check plan SKUs:

```bash
az appservice plan list \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "[].{name:name,sku:sku.name,tier:sku.tier,status:status}" -o table
```

If plan is `F1`/`D1`, first try scaling to `B1`:

```bash
az appservice plan update \
  --name Frontend-Personnal-Ops-Plan \
  --resource-group RG-DT4-devops-dt4-15 \
  --sku B1

az appservice plan update \
  --name Backend-Personal-Ops-Plan \
  --resource-group RG-DT4-devops-dt4-15 \
  --sku B1
```

If `B1` is blocked by Azure Policy (`RequestDisallowedByPolicy`), use an allowed SKU from policy.
In your subscription output, allowed SKUs include `F1`, `D1`, and `B2`, so use `B2`:

```bash
az appservice plan update \
  --name Frontend-Personnal-Ops-Plan \
  --resource-group RG-DT4-devops-dt4-15 \
  --sku B2

az appservice plan update \
  --name Backend-Personal-Ops-Plan \
  --resource-group RG-DT4-devops-dt4-15 \
  --sku B2
```

If `B2` is also denied, request a policy exemption from your Azure administrator using policy assignment:

- `devops-Policy-Assignment-RG-DT4-devops-dt4-14`
- `application-free-tier`

Start/restart apps after scaling:

```bash
az webapp start --name Frontend-Personnal-Ops --resource-group RG-DT4-devops-dt4-15
az webapp start --name Backend-Personal-Ops --resource-group RG-DT4-devops-dt4-15

az webapp restart --name Frontend-Personnal-Ops --resource-group RG-DT4-devops-dt4-15
az webapp restart --name Backend-Personal-Ops --resource-group RG-DT4-devops-dt4-15
```
