# ドル現場防衛戦 — IDOL SECURITY

KMC Creative Lab / Web版 v1.5 / 2026-10-14

アイドルライブの現場を守る60秒のドット絵アクションゲーム。4会場×4グループ、7種の警戒対象、コンボと一斉退場。IDOL SECURITYへ更新したキービジュアル、5段階の結果画像、黒Tシャツキャラ、顔付き退場一覧、入退場する観客を収録。

公開URL: https://kmc48.github.io/dol-genba-security/

Claude Codeへの引き継ぎは [START_HERE.md](START_HERE.md) から。ネイティブ化を依頼する文面は [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md)。

## 起動
Node.js 22以上で `npm run dev`。表示されたURLをブラウザで開く。Web起動・テスト・ビルドにはnpm install不要。

- `npm run check`: 構文確認
- `npm test`: ゲームロジック回帰テスト
- `npm run build`: ネイティブ組み込み用www/を生成
- ネイティブ依存の導入は `npm ci`。`npm run build:android:debug` で同期・照合・デバッグビルド。BUILD_ANDROID_IOS.mdを参照。

### 隠しアイドルの開発用プレビュー（v1.6）

`npm run dev:animal` を起動し、表示された `http://127.0.0.1:8080/?unlock=animal` を開くと「アニマルプラネット」を選択できる。パラメータを外すと正規の達成状況に戻る。仮解禁は保存されず、通常アイドルで実際に獲得したA評価以上だけが従来どおり保存される。

通常の `npm run dev`、GitHub Pages等の静的Web公開、`npm run build` で生成する `www/`、Android/iOSアプリでは、このURLパラメータは無効。通常4アイドルすべてのA評価以上が必要。専用サーバーは明示的な `--debug-unlock` 指定時だけHTTP応答内のJavaScriptを変更し、ソースやビルド出力を書き換えない。ホスト名や環境変数による自動解禁は行わない。

開発用サーバーは配信用に使わず、アプリは通常どおり `sync:android` / `sync:ios` で `www/` を同梱する。

## 引き継ぎ資料
1. CLAUDE.md — Claude Codeの開始点
2. PROJECT_OVERVIEW.md — 概要・設計
3. GAME_SPEC.md — 仕様・得点・出現条件
4. BUILD_ANDROID_IOS.md — Android/iOSビルド
5. QA.md / NEXT_TASKS.md — 検証・残課題
6. ASSETS.md / asset-manifest.json — 素材・出所・ハッシュ
7. HANDOFF_PROMPT.md — Claude Codeへ渡す依頼文

既存GitHub Pagesはmainブランチのルートを公開。更新時はRELEASE_CHECKLIST.mdを参照。相対URLを使用。Androidプロジェクトとlockfileは生成済み。APK/AAB/IPA、実機QA、署名、ストア提出は未実施。現在の結果はANDROID_BUILD_QA.mdを参照。
公開は第三者への再利用許諾を意味しない。本リポジトリにオープンソースライセンスは付与していない。

## 結果をSNSでシェア

結果画面の人数のすぐ下にある「結果を報告(シェア)」で、その回の退場人数・評価・得点・現場名と公開URLを共有できます。アプリ版はOSの共有メニュー、対応ブラウザはブラウザの共有メニューを使用します。非対応環境は文章コピー（コピー不可の場合は手動選択用の報告文）に切り替わります。

ネイティブ版を更新する際は、新しいShareプラグインを組み込むため `npm ci` → `npm run sync:ios` または `npm run sync:android` → Xcode/Android Studioで再ビルドしてください。Webの公開だけではインストール済みアプリは更新されません。

## 音が出ない場合
初期設定は「音 OFF」です。右上を「音 ON」にしてから警備を開始してください。BGMは警備中だけ流れます。
音はWeb Audioで合成しており、GitHub専用のミュート処理はありません。
ONでも聞こえない場合は、端末の音量・出力先を確認し、端末名/OS/ブラウザ/アプリ内表示かを記録してください。実機での可聴確認は今後のQA項目です。
