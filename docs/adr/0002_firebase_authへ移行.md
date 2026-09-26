# ADR 0002: 認証をFirebase Authenticationへ移行する

- 状態：採用（実環境適用待ち）
- 決定日：2026-09-17

## 決定

ログイン資格とユーザー管理はFirebase Authentication、業務データはSupabase PostgreSQLへ分離する。Firestoreは導入しない。

ブラウザはFirebase Client SDKでメール・パスワード認証し、ID TokenをNext.jsへ送る。Next.jsはFirebase Admin SDKで検証し、HttpOnly Session Cookieを発行する。全業務DBアクセスはサーバー限定Supabase Secret keyを使用し、Firebase UIDから取得したApplication Userのorganization、department、roleをRepositoryスコープとして強制する。

## データモデル

- `app_users`: Firebase UID、organization、role、status、Employeeとの対応。
- `employees`: 営業履歴上の担当者。Firebaseユーザーの削除・停止から独立。
- `activities.employee_id`: 業務履歴の担当者参照。認証ユーザーを参照しない。

## セキュリティ境界

- Firebase Authentication: 本人確認。
- PostgreSQL `app_users`: 利用可否、organization、role。
- Repository Scope: organizationとdepartmentを全クエリで強制。
- Supabase PostgreSQL: RLSを有効のまま維持し、anon/authenticated権限を剥奪。service roleはNext.jsサーバーでのみ利用。

## 移行上の注意

旧Supabase Auth依存はMigration履歴にのみ残る。後続MigrationがPolicy/RPCと`auth.users` Foreign Keyを撤去する。実環境へはMigrationを順番に適用し、件数検証後にFirebaseログインを有効化する。
