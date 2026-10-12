# Androidの戻る操作 — 仕様・検証

実装日: 2026-10-12 JST。基点: main `57c8dfa920bc9ce1b9b284935b1fdf2c5100b2da`。

## 画面別の操作

| 表示中の画面 | 戻る操作 | 維持する内容 |
| --- | --- | --- |
| 説明ダイアログ | 説明だけ閉じる。説明を開く直前の状態へ | プレイ／開始カウントダウンから開いた場合は既存のclose処理で再開。一時停止・結果の上なら下のダイアログを維持 |
| 一時停止ダイアログ | 「警備を再開する」と同じ再開処理 | 残り時間・得点・コンボ・登場人物・対応キュー |
| 結果ダイアログ | 「別の現場を選ぶ」と同じ会場選択への遷移 | 結果確定時に保存されたベスト記録 |
| プレイ／開始カウントダウン | 「Ⅱ」と同じ一時停止処理 | 全ゲーム状態。途中の得点を保存しない |
| 会場選択 | タイトルへ | 会場・グループの選択、音の設定、保存済み記録。HI-SCOREを再表示 |
| タイトル | Androidのタスクをバックグラウンドへ移す | Activityを明示終了せず、記録を消さない |

タイトル以外でアプリを終了する処理やWebViewの履歴を戻す処理は呼ばない。
説明が最優先。Android側で350ms未満の連打と応答待ち中の重複入力を無視し、一時停止直後の誤再開や画面飛ばしを抑える。
OSがバックグラウンドのプロセスを破棄した場合、次回は通常の初期起動になる。途中の公演を永続保存する機能は追加していない。

## 実装

- `MainActivity.java`: AndroidX `OnBackPressedDispatcher` にActivityのライフサイクルに紐づくコールバックを登録。現在のWebViewで `window.handleAndroidBack()` を評価する。
- `game.js`: 現在のダイアログ／modeを判定し、既存の `pause` / `resume` / `goMenu` を利用。タイトルへ戻る処理とHI-SCORE再表示のみ追加。
- JavaScript未準備・例外・不明状態では戻るを消費する。意図しないActivity終了へフォールバックしない。起動直後は読み込みを待って再操作する。
- `@capacitor/app`、依存パッケージ、lockfile、Gradle設定、iOSプロジェクトは変更しない。AndroidXは既存のCapacitor/AppCompat依存を使用。
- ブラウザ履歴、Web/iOSの戻るジェスチャー、Escapeキーの操作は変更しない。Android専用処理はネイティブからのみ呼ばれる。

## 自動検証

```sh
npm ci
npm run check
npm test
node --test test-android-back.cjs  # 戻る操作だけを検証する場合
npm run sync:android
npm run verify:android
npm run build:android:debug
```

`npm test` の既存エントリ `test-game.cjs` から追加テストを呼ぶため、既存Android CIでも実行される。CI workflow / package.jsonを書き換えていない。

2026-10-12のローカル結果:

- 構文検査、既存の全16ミッション・得点／ランク等のロジック検査: PASS。
- 新規の戻る操作16テスト: PASS。音ON/OFFでのタイトル復帰、開始前・プレイ中の停止と再開、6状態からの説明表示／閉じる、途中離脱、結果保存・HI-SCORE更新・再読込、バックグラウンド復帰、保存領域利用不可、ネイティブから呼ぶJS式の未準備・例外を検証。
- Webビルド・Android同期・同梱18ファイルのハッシュ照合: PASS。
- Chromiumで実DOM検証を試みたが、実行環境のsocket権限制約によりブラウザが起動せず未検証。Android実機確認の代替とはしない。
- ローカルはJDK 17で、Androidに必要なJDK 21／SDKを備えていない。APKコンパイル・lintはPR作成後の既存Android CIで確認する。今回GitHubへの書き込みが403で拒否されたため、リモートブランチ／PR／新しいCI実行は未作成。
- 16件は実際のgame.jsとindex.htmlを使うNode上のDOM／時計アダプターによる検証。Androidのボタン・ジェスチャー配送、Java側の連打抑止、可聴音を保証するものではない。

## 並行作業との関係

確認時点でGitHubのopen PRは0件。手元にCI整備・タイトルテストの未統合作業があるため、workflow / package.json / lockfile / iOSは編集しない。
`BUILD_ANDROID_IOS.md` は古い戻る操作の説明1行のみ変更し、詳細を本ファイルに分離した。
両方の手元差分について `git apply --check` が成功（テキスト上の競合なし）。
タイトルテスト側が `npm test` から `test-game.cjs` を呼ぶ構成なら、両方の検証がそのまま共存する。
時計／フォントの修正はこの変更に含めず、`frame` / `update` / `finish` の時間・得点・保存処理を維持した。

## Android実機QA — すべて未実施

最低限、3ボタン方式とジェスチャー方式をそれぞれ確認する。Android 12以前とAndroid 13以降（可能ならtarget SDKに対応するAndroid 16）を含め、機種名・OS・WebViewバージョン・コミットSHAを記録する。

- [ ] タイトルから戻るとホーム／前面アプリへ移る。履歴から戻るとタイトルが表示される。HI-SCOREが消えない。
- [ ] 会場／グループを変更して戻るとタイトル。再入場時に選択・音設定が維持される。
- [ ] 開始カウントダウン中に戻ると停止。5秒以上待っても進まず、再開すると停止地点から続く。
- [ ] 得点・コンボ・対応待ちキューがあるプレイ中に戻ると一時停止。10秒待っても残り時間・得点・違反者の寿命が変わらず、再開後にまとめて減らない。
- [ ] 一時停止中の戻るは再開。一時停止画面の「現場選択に戻る」は途中得点を保存せず会場選択へ移る。
- [ ] タイトル・会場選択・開始前・プレイ・一時停止・結果から説明を開き、戻るで説明だけ閉じる。下の状態・ダイアログが保たれる。
- [ ] 結果画面から戻ると会場選択。さらにタイトルへ戻ると新しいHI-SCOREが表示され、アプリ再起動後も記録が残る。
- [ ] 戻るを素早く2回押しても、一時停止を即座に解除したり複数画面を飛ばしたりしない。350ms以上空けた意図的操作は受け付ける。
- [ ] 起動直後／画像読み込み中の戻るでクラッシュしない。読み込み完了後に操作できる。
- [ ] ホーム移動・画面ロック・他アプリからの復帰で一時停止を維持。回転後も戻る処理が二重に実行されない。
- [ ] Android 13以降の戻るスワイプ完了は同じ遷移になり、途中キャンセルでは遷移しない。予測的戻るアニメーション自体は今回の対象外。
- [ ] 音あり／音なし双方で、停止・説明・再開・タイトル復帰時の音を実際に聴いて確認する。
- [ ] WebブラウザとiOSの既存タイトル・一時停止・結果操作をスモーク確認する。

## 参照

- https://developer.android.com/guide/navigation/navigation-custom-back
- https://developer.android.com/reference/android/webkit/WebView#evaluateJavascript(java.lang.String,%20android.webkit.ValueCallback)
- https://developer.android.com/reference/android/app/Activity#moveTaskToBack(boolean)
- 使用APIの互換性はローカルにインストールしたCapacitor 8.5.3の `BridgeActivity.java` でも確認。
