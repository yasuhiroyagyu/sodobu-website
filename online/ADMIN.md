# 筑波大学書道部 オンライン版

既存のHTML/CSSをそのまま配信し、SitesのChatGPTログイン、D1、R2を組み合わせています。

## 編集の対象

管理画面は `/admin.html`。基本情報、メイン写真、作品、活動記録、公式SNS、応援先を更新できます。ハワイプロジェクトの長い原稿など、HTMLに直接書かれた文章は元のHTMLで編集します。

## 管理者

本番環境変数 `ADMIN_EMAILS` は管理者として使うChatGPTアカウントのメールアドレスです。複数人はカンマ区切り。未設定では書き込みを許可しません。Sitesが認証した利用者のIDとメールアドレスをサーバーで確認し、すべての管理APIで権限を判定します。

POSTは同一オリジンと管理画面のヘッダーを確認します。ログインはSitesが管理し、認証用の秘密をブラウザーやGitに保存しません。

## 保存

- D1 `club_content`：現在のサイト情報と更新番号。
- D1 `content_history`：変更前の情報。失敗・競合した保存は履歴を追加しません。
- R2 `uploads/`：アップロード写真。管理画面で掲載解除してもファイルを削除しません。
- `/content.js`：現在のD1の情報を配信。未保存時のみ元の `content.js` を使います。

更新番号が一致した場合だけ保存します。データの検証と写真形式・サイズの確認をサーバー側で行います。アップロード可能な形式はJPEG・PNG・WebP、12MB以内です。保存内容はブラウザーのローカルストレージに依存しません。

## 開発・再公開

`scripts/sync-static.mjs` で親フォルダーの公開ページ、デザイン、写真をコピーします。機密ファイルやGitの情報はコピーしません。

```text
node scripts/sync-static.mjs
npm run db:generate
node --test tests/admin.test.mjs
npm run build
```

DBスキーマの変更がない場合、migrationの生成を繰り返す必要はありません。公開時はSites skillのソース同期・パッケージ作成・公開フローを使用してください。既存の `.openai/hosting.json` のproject_id、DB、BUCKETは維持してください。

Sitesの初期公開範囲は所有者のみです。一般向けに公開範囲を変更しても、管理APIは `ADMIN_EMAILS` の指定に従います。
