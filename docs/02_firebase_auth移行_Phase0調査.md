# Firebase Auth移行 Phase 0 調査結果

## 現在の認証依存

- `src/lib/supabase/server.ts` / `client.ts` / `proxy.ts`: Supabase Auth Cookieセッションの作成・更新。
- `src/app/auth/**`: ログイン、ログアウト、招待・復旧リンク、パスワード変更。
- `src/app/page.tsx`、`login/page.tsx`、`src/lib/current-user.ts`: `getClaims()`によるページ保護。
- activities / customers / resultsの全Server Actionと顧客検索Route Handler: `getClaims()`による認証確認。
- `src/components/auth/auth-link-handler.tsx`: Supabase Authのimplicit link処理。

## DB依存

- `profiles.id`は`auth.users.id ON DELETE CASCADE`を直接参照し、認証ユーザーとアプリユーザーが同一ID・同一レコードになっている。
- `user_departments.user_id`と`user_roles.user_id`は`profiles.id`を参照する。
- `customers.assigned_user_id`は`profiles.id ON DELETE SET NULL`を参照する。
- `activities.owner_user_id`は`profiles.id ON DELETE RESTRICT`を参照する。この制約がAuthユーザー削除を阻止している。
- 社員に相当する独立テーブルはなく、`profiles`がアプリユーザーと社員の両方の責務を持つ。

## RLS / RPC依存

- `current_organization_id`、`has_department_access`、`is_department_admin`、`is_organization_admin`が`auth.uid()`を使用する。
- organizations、departments、profiles、user_departments、user_roles、customers、activitiesの全Policyが上記関数または`auth.uid()`に依存する。
- `create_activity_with_customer`が`auth.uid()`を活動所有者として使用する。
- `search_customers`はSupabase Auth依存の権限関数を使用する。

## 維持対象

- organizations / departments / customers / activitiesの業務データ。
- Application Service、Domain、Repository Interface、カレンダー処理、既存UI。
- Supabase PostgreSQLとSQL Migration履歴。

## 移行対象

- 認証をFirebase Authentication、サーバー検証をFirebase Admin SDKへ変更する。
- `employees`を新設して営業履歴の担当者を認証ライフサイクルから分離する。
- `app_users`を新設し、Firebase UID、organization、employee、role、statusを管理する。
- DBアクセスをNext.jsサーバー限定の秘密鍵クライアントへ統一し、全Repositoryでorganization境界を明示する。
- Supabase Auth依存RLS/RPC、Cookie Proxy、callbackを段階的に撤去する。

## Phase 1方針

既存カラムを直ちに削除しない。`employees` / `app_users`追加、既存profilesからのbackfill、activitiesへの`employee_id`追加と検証を先に行う。移行期間中の既存画面互換のため`owner_user_id`は残すが、認証ユーザー削除を阻止するForeign Keyはbackfill検証後に解除する。
