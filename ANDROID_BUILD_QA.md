# Androidビルド基盤: 検証記録

確認日: 2026-10-11 JST。基準main: `821579264e74eeafb8865431aa98f8b2d61f0543`。
開始時に公開されていたブランチはmainのみ、open PRは0件。時計・フォント修正はこのブランチに含まない。

## ローカルで実行済み

環境: Linux x86_64、Node 24.19.0、npm 11.9.0、初期Javaは17.0.20。実機なし、/dev/kvmなし。

| 検証 | 結果 |
| --- | --- |
| `npm ci` | 成功。lockfileから99パッケージを復元 |
| `npm run check` | 成功 |
| `npm test` | 成功。既存4会場×4グループ、全16ミッション等の回帰テスト |
| `npx cap add android` | 成功。Capacitor 8.5.3のAndroidプロジェクトを生成 |
| `npm run sync:android` | 成功。Web18ファイルを同梱元へコピー |
| `npm run verify:android` | 成功。18ファイルのSHA-256、appId、versionName、設定を照合 |
| ゲームソースと画像 | HTML/CSS/JS/build.mjsとルート画像14点のバイト一致を確認 |
| 同梱チェックの異常検出 | コピー側game.jsのみ変えた際にエラーで停止することを確認し、コピーを復元 |
| Git登録対象 | 署名鍵、証明書、APK、AAB、local.propertiesが登録されていないことを確認 |
| ローカルAPK生成 | 未実施。JDK 21未導入。JDK取得とGradle checksum取得の転送先接続が自動承認チェックで拒否されたため、別URLで迂回していない |
| Android実機/エミュレータ | 未実施 |
| iOS生成/ビルド | 未実施 |

## Windowsでのビルド（2026-10-11 JST）

環境: Windows 11、Node 24.18.0、npm 11.16.0、JDK 21.0.12（Temurin）、Android SDK Platform 36 / Build Tools 35.0.0・36.0.0。作業パスは `C:\dev\dol-genba-security`（OneDrive・日本語パス外）。

| 検証 | 結果 |
| --- | --- |
| `npm ci` / `npm run check` / `npm test` | 成功 |
| `npm run build:android:debug` | 成功。同梱照合PASS、`:app:assembleDebug` 成功 |
| `:app:lintDebug` | 成功 |
| APKの内容（aapt2 dump badging） | package `jp.kmccreativelab.dolgenba`、versionCode 1、versionName 1.4.0、minSdk 24、targetSdk 36、ラベル「ドル現場防衛戦」 |
| 修正 | `scripts/gradle.mjs` がWindowsで `gradlew.bat` を見つけられず失敗（`NoDefaultCurrentDirectoryInExePath` 設定時）。絶対パスで呼び出すよう修正 |
| アイコン/スプラッシュ | 採用アイコンを `assets/icon.png` に保存し、ランチャーアイコン（通常・丸・アダプティブ前景）とスプラッシュを生成して置換 |
| Android実機/エミュレータ | 未実施（接続端末なし） |

## GitHub Actions

`Android debug APK` workflowを追加したが、実行は未実施。

- 通常のgit push: HTTPS認証情報がなく失敗。
- 接続済みGitHub経由での作業ブランチ作成: `403 Resource not accessible by integration`。
- このためリモート作業ブランチ・PRは作成できず、GitHub Actionsも実行されていない。ローカルの `codex/android-build-foundation` にコミット済み。
- 権限がある環境から変更を適用してpush/PR作成するか、リポジトリへの書き込み権限を持つ接続が必要。
- ローカルにはAndroid SDK 36 / Build Tools 35.0.0を配置できたが、JDK 21未導入のためAPKビルドは未実施。
CIではビルド環境に用意されたJDK 21を使用する。APK生成/Android lintと、実機QAは別判定。

## ブラウザ補助検証（Android実機の代替ではない）

Android同梱元 `android/app/src/main/assets/public` をローカルHTTP配信し、Chromium headless / タッチエミュレーションで確認。
幅360・390・412 CSS px、各高さ844pxで以下を確認した。

- 会場/グループ選択、警備開始、Canvasタップに対する得点変化、ポーズ/再開/現場選択への復帰: 全幅で成功。
- ポーズ中500msの表示時間停止、メニューで横方向のはみ出しなし、JavaScript例外なし。
- 音ONでAudioContextがrunning、OFFでsuspendedに遷移。実際の可聴音は未確認。
- 360pxのプレイ画面、412pxのメニュー画面のスクリーンショットを目視確認。残り4枚も引き継ぎZIPに収録。
- 外部リクエストを遮断して実施。Google Fonts取得リクエストが残ることを確認（代替フォントで動作）。これはフォント修正の完了を意味しない。
- ブラウザの「現場選択に戻る」とAndroid OSの戻る操作は別。OS戻る、WebView、ノッチ、回転、バックグラウンド音声は未検証。

## 実機確認表（すべて未実施）

| 項目 | 確認する内容 |
| --- | --- |
| 起動・表示 | コールドスタート、v1.4表示、全画像の表示、白画面やクラッシュがない |
| タッチ | 会場/グループ選択、開始、違反者タップ、一斉退場、再挑戦 |
| 音声 | 初期OFF、ONで効果音/BGMが聞こえる、OFFで停止、イヤホン/音量/復帰 |
| 戻る | メニュー/プレイ/ポーズ/ヘルプ/結果それぞれでOS戻るボタン・ジェスチャー。ゲームの進行状態と画面が不整合にならない |
| サイズ | 360/390/412 CSS px相当、縦横、タブレット、ノッチ、ステータス/ナビゲーションバー、重要ボタンが隠れない |
| ライフサイクル | ホーム移動・画面ロック・着信で時間/音が止まり、安全に再開できる |
| オフライン | フォント修正統合後、初回から機内モードで表示・操作できる |
| 低FPS | 時計修正統合後、停止時間を除く実時間で終了する |
| 保存 | 再起動・更新時の記録、保存拒否、OSバックアップ設定と説明の整合 |

ゲーム専用のAndroid戻る/音声ライフサイクル処理は追加していない。既存visibilitychange処理とCapacitor標準動作の実機確認が必要。
広告、課金、分析SDK、アカウント、オンライン通信機能は追加していない。
