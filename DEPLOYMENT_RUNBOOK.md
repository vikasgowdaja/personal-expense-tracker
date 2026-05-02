# Deployment Runbook (Azure App Service + ACR)

This document is the source of truth for deployment naming and GitHub secrets.
If deployment fails with "Microsoft.Web/Sites doesn't exist", check this file first.

For manual local deployment without GitHub Actions, see `LOCAL_AZURE_SEPARATE_DEPLOY.md`.

## 1. Azure Resources (Production)

Keep these names exact.

- Subscription ID: `bc8465fd-0da7-430a-8710-428d38d0ec99`
- Resource Group: `RG-DT4-devops-dt4-15`
- Azure Container Registry (ACR) name: `vikasacr267549`
- ACR login server: `vikasacr267549.azurecr.io`
- Backend App Service name: `Backend-Personal-Ops`
- Frontend App Service name: `Frontend-Personnal-Ops`

Important:
- `Frontend-Personnal-Ops` currently uses `Personnal` spelling.
- Do not change spelling/case in secrets unless the Azure resource is renamed.

## 2. GitHub Repository Secrets (Required)

Workflow file: `.github/workflows/azure-appservice-containers.yml`

Required secrets:

- `AZURE_CREDENTIALS`
  - Service principal JSON used by `azure/login@v2`
- `ACR_LOGIN_SERVER`
  - Example: `vikasacr267549.azurecr.io`
- `ACR_USERNAME`
  - ACR admin username
- `ACR_PASSWORD`
  - ACR admin password
- `AZURE_WEBAPP_BACKEND_NAME`
  - Must match App Service name exactly: `Backend-Personal-Ops`
- `AZURE_WEBAPP_FRONTEND_NAME`
  - Must match App Service name exactly: `Frontend-Personnal-Ops`
- `BACKEND_API_URL`
  - Example: `https://<backend-hostname>/api`

## 3. Minimal Validation Before Every Deployment

Run in Azure Cloud Shell:

```bash
az account show --query "{name:name,id:id,tenantId:tenantId}" -o table

az webapp show \
  --name Backend-Personal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "{name:name,host:defaultHostName,state:state}" -o table

az webapp show \
  --name Frontend-Personnal-Ops \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "{name:name,host:defaultHostName,state:state}" -o table

az acr show \
  --name vikasacr267549 \
  --resource-group RG-DT4-devops-dt4-15 \
  --query "{name:name,loginServer:loginServer}" -o table
```

## 4. How to Regenerate AZURE_CREDENTIALS

Use this only if credentials are wrong/expired or point to another subscription.

```bash
az ad sp create-for-rbac \
  --name "personal-ops-gha" \
  --role contributor \
  --scopes /subscriptions/bc8465fd-0da7-430a-8710-428d38d0ec99/resourceGroups/RG-DT4-devops-dt4-15 \
  --json-auth
```

Copy full JSON output into GitHub secret `AZURE_CREDENTIALS`.

## 5. Common Failure Mapping

- Error: `Resource '***' of type Microsoft.Web/Sites doesn't exist`
  - Wrong `AZURE_WEBAPP_*_NAME` secret value
  - Or `AZURE_CREDENTIALS` logs into wrong subscription

- Error around ACR token in Cloud Shell but repositories are listed
  - Usually transient Cloud Shell auth issue
  - If repositories list successfully, ACR is generally fine

## 6. Change Control Rule

Whenever any Azure resource is renamed:

1. Update this runbook first.
2. Update GitHub secrets.
3. Re-run workflow from Actions -> "Run workflow".

## 7. Quick Pre-Run Checklist

- `AZURE_WEBAPP_BACKEND_NAME` matches `Backend-Personal-Ops`
- `AZURE_WEBAPP_FRONTEND_NAME` matches `Frontend-Personnal-Ops`
- `AZURE_CREDENTIALS` subscription is `bc8465fd-0da7-430a-8710-428d38d0ec99`
- `ACR_LOGIN_SERVER` is `vikasacr267549.azurecr.io`
- Backend and frontend web apps exist in `RG-DT4-devops-dt4-15`
