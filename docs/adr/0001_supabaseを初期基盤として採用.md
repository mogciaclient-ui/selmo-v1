# ADR 0001: Supabaseを初期基盤として採用する

- 状態：採用
- 決定日：2026-09-15

## 背景

selmo.は日本国内の営業組織を対象とし、組織・部門単位の厳密なデータ分離、認証、PostgreSQL、将来の複数社提供を必要とする。

## 決定

初期基盤として、東京リージョンのSupabase PostgreSQLとSupabase Authを採用する。認可はPostgreSQL RLSでも強制する。

## 理由

- 東京リージョンを利用できる。
- PostgreSQL、認証、RLSを一体で運用できる。
- 少人数で初期開発・運用を始めやすい。
- PostgreSQLを基盤とするため、中核データの移行経路を確保できる。

## 許容する依存

- Supabase Authのセッション管理
- `auth.uid()`を起点とするRLS
- Supabase SSRクライアント

これらは認証Adapter、Supabase接続層、DB権限判定関数へ閉じ込める。

## 再検討条件

- 国内データ配置や契約条件を満たせなくなった場合
- DB負荷、接続数、費用が許容範囲を超えた場合
- Firebase Auth等への統一が事業上必要になった場合
- 顧客要件として専用環境、Cloud SQL、RDS等が必要になった場合
- DBブランチを中心とした開発運用が重要になった場合

