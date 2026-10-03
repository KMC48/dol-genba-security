# ドル現場防衛戦 — NEXUS SECURITY

KMC Creative Lab / Web版 v1.3 / 2026-10-03

アイドルライブの現場を守る60秒のドット絵アクションゲーム。4会場×4グループ、7種の警戒対象、コンボと一斉退場。元画像を使う警備員トップ画面を収録。

## 起動
Node.js 22以上で `npm run dev`。表示されたURLをブラウザで開く。Web起動・テスト・ビルドにはnpm install不要。

- `npm run check`: 構文確認
- `npm test`: ゲームロジック回帰テスト
- `npm run build`: ネイティブ組み込み用www/を生成
- ネイティブ依存の導入は `npm install`。以降はBUILD_ANDROID_IOS.mdを参照。

## 引き継ぎ資料
1. CLAUDE.md — Claude Codeの開始点
2. PROJECT_OVERVIEW.md — 概要・設計
3. GAME_SPEC.md — 仕様・得点・出現条件
4. BUILD_ANDROID_IOS.md — Android/iOSビルド
5. QA.md / NEXT_TASKS.md — 検証・残課題
6. ASSETS.md / asset-manifest.json — 素材・出所・ハッシュ
7. HANDOFF_PROMPT.md — Claude Codeへ渡す依頼文

GitHub Pagesはmainブランチのルートを公開。相対URLを使用。ネイティブフォルダ、APK/AAB/IPA、署名、ストア提出はまだ未実施。
公開は第三者への再利用許諾を意味しない。本リポジトリにオープンソースライセンスは付与していない。
