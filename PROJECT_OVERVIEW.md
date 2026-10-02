# 概要書

アイドルファンが現場あるあるを楽しむスマホゲーム。プレイヤーは警備員ハヤト。60秒で違反者を見つけてタップし退場させる。一斉退場では相棒ダイチが加勢。登場団体・グループ・会場は架空。

| ファイル | 役割 |
| --- | --- |
| index.html | 選択、HUD、ヘルプ、一時停止、結果 |
| style.css | レスポンシブUIと原画トップ |
| game.js | 状態、出現、移動、採点、Canvas/Web Audio |
| PNG3点 | キャラ、会場、警備員原画 |
| build.mjs / serve.mjs | Web出力/開発サーバー |
| test-game.cjs | Node VMでの回帰テスト |
| capacitor.config.json | ネイティブ化ひな形 |

Vanilla JavaScript ES Modules、Canvas 2D、dialog、Pointer Events。バックエンド、課金、広告、アカウント、オンラインランキングなし。
状態遷移はmenu→countdown→playing→result。paused経由で再開。document.visibilitychangeでも停止。
resetGameが初期化、spawnFan/spawnScheduledFansが出現、chooseFanがキュー、updateが時間と移動、ejectが採点、drawGame/drawFan/drawMosh/drawConnectionが描画。
localStorageのnexus-genba-records-v1へ会場-グループ別の人数とスコアを保存。同人数ならスコア比較。保存失敗でもプレイ継続。
フォントはGoogle FontsのDotGothic16/Noto Sans JPをCSSから外部取得。ネットなしでも代替字体で動く。ネイティブ版はライセンス付き同梱を推奨。
音源はWeb Audio合成、初期OFF。対応ブラウザに限りWebMCPの状態取得/現場選択を登録するが必須ではない。
