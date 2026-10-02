# Claude Code引き継ぎ

まずREADME、PROJECT_OVERVIEW、GAME_SPEC、BUILD_ANDROID_IOS、QA、NEXT_TASKSを読む。

## 確定したユーザー要件
- 日本語、スマホ中心、懐かしいドット絵。主人公は架空のNEXUS SECURITY。
- トップの黒制服・サングラスのイカつい警備員2人の原画を維持。
- モッシュはオタク同士の接近→身体衝突→反動。単なるジャンプへ戻さない。
- 乱入者は客席からステージへ実際に移動。
- 繋がりオタクは1プレイに1度だけ。特定のアイドルと双方向ハート、通常10倍得点。
- 4会場×4グループの出現傾向を維持。

## 作業開始
`npm test`、`npm run build`を実行しWeb版を保つ。正となるソースはルートのHTML/CSS/JSとPNG3点。www/は生成物で直接編集しない。
Capacitor 8系の設定はひな形。appIdは仮値なのでネイティブ生成/ストア登録前に所有者へ確認。プラットフォームフォルダ未生成。
ネイティブ作業でnpm installを行い、生成したpackage-lock.jsonをコミットする。以降npm ci。同じCapacitorメジャーに揃える。
APIキー、トークン、署名鍵、keystore、証明書、プロビジョニングをGitへ入れない。
広告・課金・分析SDK・ユーザー登録は依頼なしに追加しない。全面的なエンジン移行をしない。

## 完了の意味
AndroidデバッグAPK→実機QA→署名AAB。iOSはmacOS/XcodeでSimulator→実機→署名Archive/TestFlight。
未実施のビルドや実機確認を完了と報告しない。コマンドと環境・結果をQA.mdに記録する。
