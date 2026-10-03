# Web版の更新・公開手順

公開サイト: https://kmc48.github.io/dol-genba-security/
リポジトリ: https://github.com/KMC48/dol-genba-security
GitHub Pagesはmainのルートを公開する。

1. 最新mainを取得し、他の変更を消さずに作業ブランチで修正。
2. npm run check、npm test、npm run build。www/は生成物で直接編集しない。
3. ルートのHTML/CSS/JS・画像14点・設定・テスト・資料を反映。画像を変更したらasset-manifest.jsonのSHA-256も更新。旧security-team.jpegはv1.4で廃止し、security-team.pngに統一。
4. GitHub PagesのActionsが成功したことを確認し、公開URLを再読込して版番号・トップ・画像・60秒終了を確認。
5. 実施結果をQA.mdまたは公開記録に残す。失敗時は原因を修正。ロールバックは既存履歴を消さずrevertを使用。

旧localStorageキーnexus-genba-records-v1はベスト記録互換のため残す。Android/iOSでは外部公開URLをWebViewへ直接指定せず、ビルド済みwww/を同梱する。
