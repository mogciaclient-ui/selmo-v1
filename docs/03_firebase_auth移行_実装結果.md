# Firebase Auth移行 実装結果

更新日: 2026-09-17

## Firebase

- Firebase Client SDKによるメール・パスワードログインとパスワード再設定を実装。
- Firebase Admin SDKでID Tokenを検証し、5日間のHttpOnly Session Cookieを発行。
- サーバー処理ではSession Cookieを失効確認付きで検証。
- 初期管理者は`npm run bootstrap:admin`でFirebase作成、パスワード設定、Application User連携を一括実行可能。

## PostgreSQL

- `employees`、`app_users`、`app_user_departments`を追加するPhase 1 Migrationを作成。
- `activities.employee_id`と`customers.assigned_employee_id`を追加し、旧Profileから担当者を移行。
- Firebase User削除が営業履歴へ連鎖しないForeign Keyへ変更。
- Migration内でorganizations、customers、activities件数と担当者対応の不変条件を検査。
- 既存profilesは移行監査用に保持。

## RLS / Authorization

- anon/authenticatedから業務テーブルへの権限を剥奪し、DB接続をNext.jsサーバー限定へ変更。
- Supabase Auth依存Policy、RPC、`auth.users` Foreign Key、移行用互換Triggerを後続Migrationで撤去。
- Firebase UIDからApplication Userを取得し、organization、department、roleをRepository Scopeとして全クエリへ適用。
- 組織管理者、部門管理者、一般ユーザーの操作範囲をサーバー側で判定。

## User Management

- `/users`へ氏名、メール、部署、権限、ステータスの一覧と追加フォームを実装。
- Firebase User、Employee、Application User、部門所属を作成し、失敗時は作成済みデータを補償削除。
- 利用停止・再有効化はFirebaseとPostgreSQLの両方へ反映。
- 自分自身の利用停止を禁止し、停止時はRefresh Tokenを失効。
- Employeeと営業履歴は利用停止時にも削除しない。

## Supabase Auth

- ログイン、ログアウト、callback、招待、パスワード設定、Cookie ProxyのSupabase Auth実装を削除。
- `@supabase/ssr`を削除。
- 現行`src`、`package.json`、`seed.sql`、`.env.example`にSupabase Auth実行時依存がないことを検索確認。
- 旧依存は履歴MigrationとPhase 0調査文書にのみ残る。

## Existing Data

2026-09-17のMigration適用後の読取専用検査結果:

| 対象 | 件数 |
|---|---:|
| organizations | 1 |
| departments | 2 |
| profiles | 1 |
| customers | 3 |
| activities | 5 |
| employees | 1 |
| app_users | 1 |

既存organizations、customers、activitiesの件数はMigration前後で不変。既存ProfileからEmployeeとApplication Userを各1件作成し、全activitiesの担当Employee・organization整合性を確認済み。

## Verification

- `npm test`: 5件成功（部門権限、予定操作権限、Application Service入力検証）。
- `npm run lint`: 成功。
- `npx tsc --noEmit`: 成功。
- `npm run build -- --webpack`: 成功。
- `npm run verify:migration`: 成功。実DBの既存件数と担当Employee整合性を確認。
- Supabase CLI Migration履歴: ローカル5本とリモート5本が一致。
- Firebase Admin接続: 成功。
- 初期管理者Firebase User作成、メール確認、Application User UID連携、organization_admin権限を確認。
- Chromeでメール・パスワードログイン成功。`POST /api/auth/session 200`と認証後ホーム`200`を確認。
- `/users`、`/customers`、`/schedule`、`/results`の認証済み表示を各`200`で確認。
- Firebaseパスワード再設定メールの実送信を確認。
- `npm run verify:authorization`: 別organization境界、一般ユーザーの管理画面拒否、inactiveログイン拒否、既存Session無効化、Employee/活動履歴保持を確認。
- `npm run verify:business`: 顧客の登録・検索・編集・削除、予定の登録・編集・削除、活動結果の入力・編集をApplication Serviceから実DBまで確認。

## Remaining Issues

- Chrome上のログアウト操作だけは利用者による最終確認待ち。
- E2Eは専用一時データを作成して終了時に削除しており、既存customers 3件・activities 5件は維持。
- Xcodeライセンス未承諾のため、この端末ではGit差分コマンドを実行できない。

上記が解消するまでは移行完了とは判定しない。
