# seQmo. 監視・保護連携

Firebaseの検証済みセッションとapp_usersの有効状態・組織・既存の業務権限を確認してから保護を適用する。監視IDは組織を含む専用HMACで生成し、UID・Cookie・入力値を送らない。既存業務データの移行はない。

## 有効化

サーバーに次の値を設定する。ブラウザーへ渡す値は例外収集の有効化フラグのみ。操作記録の有効・無効は認証後にサーバーで確認する。

- `SEQMO_ENDPOINT`: seQmo. ingestionのHTTPS URL
- `SEQMO_PROJECT_ID`, `SEQMO_INGEST_KEY`: 対象システム専用のIDと送信キー
- `SEQMO_ORGANIZATION_ID`: この設定に対応するselmoの組織ID
- `SEQMO_ACTOR_SECRET`: 32文字以上の監視専用秘密値。変更すると監視IDも変わる
- `SEQMO_ENVIRONMENT`: productionなど
- `SEQMO_PROTECTION_ENABLED=true`: 明示的に保護を有効化。初回同期完了までは対象組織へのアクセスを拒否
- `SEQMO_APPLICATION_ORIGIN`: selmo自身の正確なorigin
- `NEXT_PUBLIC_SEQMO_BROWSER_ENABLED=true`: ブラウザー例外収集（ビルド時）
- `SEQMO_REPLAY_ENABLED=true`: サーバー側の操作記録許可。顧客に範囲を説明し、seQmo.側でも有効化する。既存の`NEXT_PUBLIC_SEQMO_REPLAY_ENABLED`は使用しない

複数組織はサーバー専用の`SEQMO_SYSTEMS`に、組織IDをキーとする`{endpoint,projectId,ingestKey,actorSecret,protection,replay}`のJSONマップを設定する。各組織は別のシステム・送信キーに割り当てる。

IP制限はVercelの管理する`x-vercel-forwarded-for`、または管理下のプロキシが上書きする`SEQMO_TRUSTED_IP_HEADER`が利用できる場合のみ適用可能と申告する。公開リクエストが任意に設定できるヘッダーを指定しない。

## 適用箇所

- ログイン成功・ログアウト、60秒のSDK接続確認、認証済みのサーバー例外
- 全業務APIの認証後にアカウント・セッション・IP・API制限
- 全CSV APIで出力停止。CSV内容は監視ログへ送らない
- 認証済みDBクライアントのlazy query実行前に読み取り専用・重要操作制限。DB応答後に成功/失敗と件数を監査。クリックを完了の証拠にしない
- Firebase管理操作、AI実行、音声アップロードURL発行の前に追加制限
- ブラウザーリレーは同一origin・認証を必須とし、サーバーが組織とIDを確定する。入力・機密領域は記録から除外

重要操作名は`customers.delete`等の`テーブル名.操作名`、`users.manage`、`roleplay.analyze`、`activities.analyze`。API制限は`/api/customers/search`等のルートパターン。保護変更はseQmo.で別の権限者の承認が必要。最大15秒の同期間隔があり、CSV出力は毎回同期する。解除も同じ経路で反映し結果を記録する。

認証前のFirebaseサインイン失敗はブラウザーSDKから本人が確定したイベントとして送信しない。取得するにはFirebase側の認証監査連携が別途必要。

## 検証と運用

Node 24で`npm test`、`npm run lint`、`npm run build`を実行する。`tests/seqmo-protection.test.mjs`はDB通信前の書き込み拒否・読み取り許可・成功後監査を検証する。

コードを配置しただけでは監視中・保護中にならない。上記サーバー設定、seQmo.側システム登録、デプロイ、接続確認が必要。監視通信の失敗は業務例外にしないが、明示的に有効化した保護は未同期・設定不備で許可扱いにしない。

SDKは`vendor/seqmo`のワークスペースに含め、外部の未公開npmレジストリーに依存しない。

操作記録は企業ごとの認証済み設定とseQmo.側の有効状態を両方確認して開始する。入力欄・機密領域を除外し、本文・属性・リンクを送信前と保存前に除去する。エラー時のみ直近60秒・最大500KBを送信し、認証済みサーバーがログイン履歴と同じHMACセッションIDを確定する。設定確認に失敗した場合は記録しない。複数サーバーでは完全な制御スナップショットを同期し、他サーバーで完了した解除にも追従する。

既存の`SEQMO_SYSTEMS`を維持したまま個別に有効化する場合は、サーバー専用の`SEQMO_PROTECTION_ORGANIZATIONS`と`SEQMO_REPLAY_ORGANIZATIONS`に、対象の組織IDをカンマ区切りで指定する。送信キー等の既存設定が検証できた組織だけに適用される。保護の初回同期に失敗した場合はアクセスを許可しない。
