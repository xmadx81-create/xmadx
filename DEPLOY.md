# 자동배포 (GitHub → Cloud Run)

`main` 브랜치에 머지하면 GitHub Actions가 자동으로 Cloud Run에 배포합니다.
(워크플로: `.github/workflows/deploy-cloudrun.yml`)

- 서비스명: `ebts-volunteer`
- 리전: `asia-northeast3` (서울)

## 1회 설정 (GCP 접근 가능한 곳에서, 예: Cloud Shell)

아래 `PROJECT_ID`만 본인 값으로 바꿔 복사·실행하세요.

```bash
PROJECT_ID="여기에-프로젝트-ID"
SA="github-deployer"

# 1) 필요한 API 활성화
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com iam.googleapis.com --project "$PROJECT_ID"

# 2) 배포용 서비스 계정 생성
gcloud iam service-accounts create "$SA" \
  --display-name "GitHub Actions Cloud Run Deployer" --project "$PROJECT_ID"

SA_EMAIL="$SA@$PROJECT_ID.iam.gserviceaccount.com"

# 3) 권한 부여 (Cloud Run 배포 + 소스 빌드)
for ROLE in roles/run.admin roles/cloudbuild.builds.editor \
            roles/artifactregistry.admin roles/storage.admin \
            roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA_EMAIL" --role "$ROLE" --condition=None
done

# 4) 키 생성 (이 파일 내용을 GitHub 비밀값에 넣습니다)
gcloud iam service-accounts keys create key.json --iam-account "$SA_EMAIL"
echo "=== 아래 key.json 내용을 GitHub Secret GCP_SA_KEY 로 등록 ==="
cat key.json
```

## 2. GitHub 비밀값 등록

저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|------|----|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_SA_KEY` | 위 `key.json` 파일 전체 내용(JSON) |

## 3. 동작 확인

- 비밀값 등록 후, `main`에 푸시(또는 GitHub Actions 탭에서 **Run workflow** 수동 실행).
- Actions 로그에서 `gcloud run deploy ... Done.` 확인.
- 런타임 환경변수(`DATABASE_URL` 등)는 기존 Cloud Run 서비스 값이 그대로 유지됩니다.

> 보안 강화 시: 서비스 계정 키(JSON) 대신 **Workload Identity Federation**으로 전환 권장.
> 그 경우 auth 단계를 `workload_identity_provider` + `service_account` 방식으로 변경하세요.
