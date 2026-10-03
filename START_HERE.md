# ドル現場防衛戦 — Claude Code引き継ぎ案内

基準: Web v1.4 / KMC Creative Lab / 2026-10-03
公開: https://kmc48.github.io/dol-genba-security/
ソース: https://github.com/KMC48/dol-genba-security

## 最初の作業
1. 最新mainを取得し、作業ブランチを作成。
2. CLAUDE.md → PROJECT_OVERVIEW.md → GAME_SPEC.mdを読む。
3. npm run check、npm test、npm run buildでベースラインを確認。
4. BUILD_ANDROID_IOS.mdとQA.mdに沿ってAndroidデバッグAPKを先に作成。iOSはmacOS/Xcode環境で進める。

## 資料一覧
| ファイル | 内容 |
| --- | --- |
| CLAUDE.md | 維持する要件・作業ルール |
| PROJECT_OVERVIEW.md | ファイル構成・ゲーム状態・技術構成 |
| GAME_SPEC.md | 7種類の行為・得点・S〜D判定・出現条件 |
| BUILD_ANDROID_IOS.md | Capacitor設定・Android/iOSのコマンド・署名の段取り |
| QA.md | 実施済み検証と実機で確認する項目 |
| NEXT_TASKS.md | 優先順位・未決定事項 |
| ASSETS.md / asset-manifest.json | 14素材の用途とハッシュ |
| RELEASE_NOTES.md / RELEASE_CHECKLIST.md | 変更点・公開方法 |
| HANDOFF_PROMPT.md | Claude Codeへそのまま渡せる依頼文 |

## v1.4で守ること
- ブランドはIDOL SECURITY。羊マーク付き黒Tシャツ・センターパート・ネックレスなし。
- 黒Tシャツの投げ/モッシュ/乱入は専用ポーズ。対象行為で黒Tシャツ35%・既存キャラ65%で出現。最前管理・繋がりは専用金髪のまま。
- モッシュは身体衝突。乱入は実移動。最前管理は最前列限定。
- 繋がりは1回・4秒・得点10倍、見逃しはアイドル1人脱退と1000点減点。
- Sは見逃し/誤認ゼロ。A/B/Cは対応率90/70/40%以上と誤認上限2/5/9回。Aは脱退なし。Dは下位評価。詳細はGAME_SPEC。
- 結果画像5段階、指定の4種類の終了メッセージ、4会場×4グループを維持。

## 現在できていること／これから行うこと
Webゲーム・14点の画像・回帰テスト・www生成・Capacitorひな形を用意済み。
android/iosプロジェクト、package-lock.json、APK/AAB/IPA、署名・ストア申請は未作成/未実施。
仮appIdはjp.kmccreativelab.dolgenba。ネイティブ登録前に所有者と確定。
実機のライフサイクル/音声/safe-area/低FPS時計/オフライン字体を重点検証する。
