# Android / iOSビルド手順

現在はひな形まで。android/iosフォルダ、APK/AAB/IPA、署名、ストア提出は未実施。

## 共通
Node.js 22以上。capacitor.config.jsonのappId `jp.kmccreativelab.dolgenba` は仮値なので、ストア登録前に所有者と確定する。
`npm install`でCapacitor 8系を解決しpackage-lock.jsonをコミット。以降npm ci。`npm test`、`npm run build`でwww/を生成。本番でserver.urlに外部URLを設定せず、www/を同梱する。

## Android
Android Studio/SDKを用意。Capacitor 8公式案内はAndroid Studio 2025.2.1以上。JDKはStudioと整合。target/compile SDKは生成設定と提出時のストア要件を確認。

```sh
npm install
npm test
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

cap addは初回のみ。Studioで同期して実機/エミュレータへRun。生成済みプロジェクトでは以下も使える。

```sh
cd android
./gradlew assembleDebug
```
Windowsはgradlew.bat assembleDebug。通常の出力はandroid/app/build/outputs/apk/debug/app-debug.apk。
Play提出はStudioの署名付きAABを作成。versionCode/versionName、アイコン、向き、権限を確認。署名鍵とパスワードはGitへ入れない。

## iOS
macOSとXcode/Command Line Toolsが必要。Capacitor 8公式案内はXcode 26以上、Swift Package Managerが標準。Windows単独でローカルiOSビルドは不可。

```sh
npm install
npm test
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

XcodeでTeam/Bundle Identifier/Version/Buildを設定。Simulator→実機→Archive/Organizer→TestFlightへ。署名・証明書・プロビジョニングは所有者の環境で設定。ストア情報/プライバシー/年齢区分は提出時に確定。

更新時はルートを編集→npm test→npm run build→npx cap sync→IDEでビルド。www/は直接編集しない。

## 2026-10-02に確認した公式資料
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/android
- https://capacitorjs.com/docs/ios
- https://capacitorjs.com/docs/config

ストア要件と利用SDKの対応バージョンは実際の提出時に再確認する。
