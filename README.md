# ValueScope (Next.js + Supabase + Vercel)

경영진 인터뷰 + 구성원 서베이 데이터를 분석해 가치체계 인식을 마인드맵으로 시각화하는 컨설턴트용 SaaS.

## 빠른 배포 가이드

### 1️⃣ Supabase 프로젝트 만들기 (5분)

1. https://supabase.com 가입 후 새 프로젝트 생성
2. **Project Settings → API** 에서 다음 두 값 복사:
   - `Project URL` (= `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon public` key (= `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. **SQL Editor** 에 `supabase/schema.sql` 내용 그대로 붙여넣고 Run
4. **Storage** → Create new bucket → 이름 `uploads` → **Private** (public 아님)
5. Storage RLS 정책 추가 (Storage → Policies → New policy):
   ```sql
   -- 업로드 (자기 폴더만)
   CREATE POLICY "own folder upload" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'uploads'
       AND (storage.foldername(name))[1] = auth.uid()::text
     );
   -- 읽기/삭제 (자기 폴더만)
   CREATE POLICY "own folder read" ON storage.objects
     FOR SELECT USING (
       bucket_id = 'uploads'
       AND (storage.foldername(name))[1] = auth.uid()::text
     );
   CREATE POLICY "own folder delete" ON storage.objects
     FOR DELETE USING (
       bucket_id = 'uploads'
       AND (storage.foldername(name))[1] = auth.uid()::text
     );
   ```
6. **Authentication → Providers** → Email 활성화 (기본). "Confirm email" 끄면 즉시 로그인 가능 (테스트용).

### 2️⃣ 로컬에서 실행해보기 (10분)

```bash
cd valuescope-next
cp .env.local.example .env.local
# .env.local 파일을 열어서 Supabase URL과 ANON KEY 입력
npm install
npm run dev
```

브라우저에서 http://localhost:3000 → 가입 → 새 프로젝트 → 파일 업로드 → 분석.

### 3️⃣ GitHub 푸시

```bash
cd valuescope-next
git init
git add .
git commit -m "Initial ValueScope SaaS"
# GitHub에 새 레포 만든 후
git remote add origin git@github.com:YOUR_USERNAME/valuescope.git
git push -u origin main
```

### 4️⃣ Vercel 배포 (3분)

1. https://vercel.com → New Project → GitHub 레포 선택
2. **Environment Variables** 에서 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy 클릭. 약 1-2분 후 라이브.

### 5️⃣ Supabase에 Vercel 도메인 등록

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: `https://your-project.vercel.app/**`

이거 안 하면 가입 메일 링크가 localhost로 돌아가요.

---

## 폴더 구조

```
valuescope-next/
├── app/
│   ├── login/                  # 로그인 페이지
│   ├── projects/               # 프로젝트 목록 (메인)
│   │   ├── [id]/               # 프로젝트 상세 (업로드 + 시각화)
│   │   ├── new-project-form.tsx
│   │   └── logout-button.tsx
│   ├── api/analyze/            # 자동 분석 API 라우트
│   ├── layout.tsx
│   ├── page.tsx                # / → /projects 리다이렉트
│   └── globals.css
├── components/
│   └── MindmapViewer.tsx       # Cytoscape 마인드맵 컴포넌트
├── lib/
│   ├── analysis/
│   │   ├── survey.ts           # 서베이 CSV 정규식 클러스터링
│   │   ├── interview.ts        # 인터뷰 MD 키워드 빈도 + 인용구
│   │   └── synthesis.ts        # 카테고리 + 정합/갭 엣지 합성
│   └── supabase/
│       ├── client.ts           # 브라우저용
│       ├── server.ts           # 서버 컴포넌트용
│       └── types.ts            # 분석 결과 타입 + DB Row 타입
├── supabase/
│   └── schema.sql              # DB 테이블 + RLS 정책
├── middleware.ts               # 인증 체크 (로그인 필요)
├── .env.local.example
└── README.md
```

## 데이터 모델

```
projects (1) ─── (1) analyses
   │
   └─── (N) uploads
              └── Storage bucket "uploads/{userId}/{projectId}/{kind}/{file}"
```

- `projects` — 컨설팅 프로젝트 (RLS: 자기 것만)
- `uploads` — 원본 파일 메타 (실제 파일은 Storage)
- `analyses` — 분석 결과 JSON 3종 (서베이 / 인터뷰 / 마인드맵)

## 분석 깊이 — 현재 한계

지금 자동 분석은 **정규식·키워드 빈도 기반**이에요 (LLM 호출 없이 무료).
- ✅ 서베이 CSV: 컬럼 자동 추측, Q1-Q4 자동 클러스터링, 부서 분포 — 충분히 의미있는 결과
- ⚠️ 인터뷰 MD: 키워드 매칭으로 핵심가치 후보 + 인용구 추출만 — 깊이 있는 의미 추론은 한계

**향후 개선**: API 키 예산이 잡히면 `/api/analyze/route.ts` 에서 Anthropic SDK 추가하면 됨. 현재 코드 구조는 그대로 두고 인터뷰 분석만 LLM으로 교체.

## 트러블슈팅

- **"Cannot find module '@/lib/...'"** → tsconfig.json 의 paths 확인, `npm install` 다시
- **로그인 후 무한 리다이렉트** → middleware의 matcher와 cookie 설정 확인
- **업로드 RLS 에러** → Storage 정책 SQL 다시 실행
- **분석 시 timeout** → Vercel Hobby는 함수당 10초. 큰 파일은 Pro 필요 (60초)
