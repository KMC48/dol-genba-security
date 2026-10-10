# Android / iOSビルド手順

## 現在の到達点（2026-10-11 JST）

Web v1.4のmain `821579264e74eeafb8865431aa98f8b2d61f0543` を基準に、Capacitor 8.5.3の依存関係とpackage-lock.jsonを固定し、Androidプロジェクトを生成済み。
ゲームのルール・ステージ・スコア計算・画像は変更していない。
検証結果は [ANDROID_BUILD_QA.md](ANDROID_BUILD_QA.md)。APKビルド成功と実機QA完了は別の判定。
iOSプロジェクト、署名AAB/IPA、ストア提出は未実施。

## 共通環境

- Node.js 22以上（`.nvmrc` は22）、npm。初回から `npm ci` を使う。
- Capacitor core/android/ios/cliはすべて **8.5.3**。更新時は4パッケージを同時に変更しlockfileも更新する。
- ソースはルートのHTML/CSS/JSと画像。`www/` と `android/app/src/main/assets/` のコピーを直接編集・コミットしない。
- `server.url` は設定せず、Webコンテンツをアプリに同梱する。

## Android: 既存プロジェクトをビルド

Android Studio 2025.2.1以上、**JDK 21**、Android SDK Platform 36 / Build Tools 35.0.0 / Platform Toolsを用意する。
生成設定: minSdk 24、compileSdk/targetSdk 36、Android Gradle Plugin 8.13.0、Gradle Wrapper 8.14.3。
`ANDROID_HOME` にSDKパスを設定するか、Android StudioでSDKを選択する（`android/local.properties` はGit管理外）。

```sh
npm ci
npm run check
npm test
npm run build:android:debug
```

最後のコマンドはWebビルド → Capacitor同期 → 同梱ファイル照合 → `:app:assembleDebug` の順に実行する。
Windowsにも対応。生成済みなので **`npx cap add android` は再実行しない**。

出力: `android/app/build/outputs/apk/debug/app-debug.apk`。
デバッグ鍵はローカル環境またはCIが自動生成する。Gitへ追加しない。これはストア提出用の署名ではない。
Android Studioで確認する場合は `npm run sync:android` → `npm run open:android` → Run。

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n jp.kmccreativelab.dolgenba/.MainActivity
```

異なる開発環境のデバッグ鍵では上書きインストールできない場合がある。アンインストールは保存データを消すため、確認なしに実施しない。

### GitHub Actions

PRと手動実行用に `Android debug APK` workflowを用意。Node 22 / runnerのJDK 21で、`npm ci`、全16ミッションテスト、同期、同梱照合、デバッグAPK、Android lintを実行する。
成功時はAPKとlintレポートをActionsのArtifactsへ14日間保存する。製品署名鍵・ストア認証情報は使用しない。
実行にはリポジトリでActionsが有効であることが必要。CI成功は実機の表示・音・操作を保証しない。

## appId: 所有者の確定が必要

**`jp.kmccreativelab.dolgenba` は仮値のまま**。今回の開発用プロジェクト生成は、この仮値を使用する依頼に基づく。
ストア登録・リリース署名・配信前に所有者が名称と識別子を確定する。Android versionNameは1.4.0、versionCodeは初期値1。
変更する場合は以下を同時に更新して同期・再ビルドする。

- `capacitor.config.json` の `appId`
- `android/app/build.gradle` の `namespace` と `applicationId`
- `MainActivity.java` のpackage宣言と配置ディレクトリ
- `android/app/src/main/res/values/strings.xml` のpackage_name/custom_url_scheme
- インストール・起動コマンドのパッケージ名（iOS生成後はBundle Identifierも）

Capacitor設定だけ変えても、生成済みAndroidの識別子は自動変更されない。

## 時計・フォントの並行修正を取り込む

このブランチは `game.js` / `style.css` / `index.html` / `build.mjs` を変更しない。
修正ブランチを統合したら `npm ci` → `npm test` → `npm run build:android:debug` を再実行する。
フォント側で追加されるファイルも `build.mjs` が `www/` に出力すれば、そのままAndroidへ再帰コピーされる。
`verify:android` はwww内の全ファイルのSHA-256をAndroid同梱元と比較する。フォントがwwwに出力されること自体はフォント修正側でも検証する。
古いwwwやAndroid assetsのコピーを別ブランチから上書きしない。

現時点のmainには低FPS時計とGoogle Fonts外部取得が残る。このブランチ単独では修正済みと扱わない。

## iOS

macOS / Xcode 26以上 / Command Line Toolsが必要。今回のLinux環境では未生成・未ビルド。
macOSで以下を実施する。

```sh
npm ci
npm test
npm run build
npx cap add ios
npm run sync:ios
npm run open:ios
```

`cap add ios` は初回のみ。Capacitor 8はSwift Package Managerが標準。
所有者がTeam/Bundle Identifier/Version/Buildを設定し、Simulator → 実機 → Archive → TestFlightへ進む。
証明書・プロビジョニング・署名鍵・パスワードをGitへ登録しない。

## 配信までの未完了事項

- Android実機QA（起動、表示、タッチ、可聴音、戻る操作、端末サイズ、バックグラウンド復帰）
- 戻る操作を一時停止/画面遷移とどう連動させるか。現状はCapacitor標準動作で、ゲーム専用処理は追加していない
- 時計/ローカルフォント修正の統合、オフライン確認
- 仮のCapacitorアイコン/スプラッシュを製品素材へ置換
- バックアップ設定（生成時のallowBackup=true）と端末内保存の説明・実挙動の整合、INTERNET権限、データ申告の確認
- appId、versionCode、素材権利・名称・プライバシーポリシー・年齢区分の所有者確認
- Android署名付きAAB、内部テスト、ストア提出
- iOSプロジェクト生成、実機QA、署名Archive/TestFlight、ストア提出

## 公式資料（2026-10-11確認）

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/android
- https://capacitorjs.com/docs/ios
- https://capacitorjs.com/docs/config

提出時のストア要件は提出直前に再確認する。
