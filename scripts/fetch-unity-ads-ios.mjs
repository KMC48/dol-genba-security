// Downloads the official Unity Ads iOS SDK (static XCFramework) into ios/App/Frameworks/ (git-ignored).
// Unity ships the iOS SDK as CocoaPods or a manual XCFramework only (no SwiftPM), so the App target
// links this folder directly. The archive is pinned by version and SHA-256; a mismatch aborts.
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile, rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const VERSION = '4.21.0'; // Android uses com.unity3d.ads:unity-ads:4.21.0
const ZIP_URL = `https://github.com/Unity-Technologies/unity-ads-ios/releases/download/${VERSION}/UnityAds.zip`;
const SHA256 = 'ca0b2a3c5529c0fd4211a8afa61390ded8a64ea218c69056cffbc2ad31c399f8';

const root = fileURLToPath(new URL('../', import.meta.url));
const frameworks = path.join(root, 'ios/App/Frameworks');
const target = path.join(frameworks, 'UnityAds.xcframework');
const stamp = path.join(frameworks, 'UnityAds.version');

if (existsSync(target) && existsSync(stamp) && (await readFile(stamp, 'utf8')).trim() === `${VERSION} ${SHA256}`) {
  console.log(`Unity Ads iOS SDK ${VERSION} already present.`);
  process.exit(0);
}

const response = await fetch(ZIP_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${ZIP_URL}`);
const zip = Buffer.from(await response.arrayBuffer());
const digest = createHash('sha256').update(zip).digest('hex');
if (digest !== SHA256) throw new Error(`SHA-256 mismatch for ${ZIP_URL}: ${digest}`);

const work = await mkdtemp(path.join(tmpdir(), 'unity-ads-'));
try {
  await writeFile(path.join(work, 'UnityAds.zip'), zip);
  execFileSync('unzip', ['-q', path.join(work, 'UnityAds.zip'), '-d', path.join(work, 'x')]);
  await mkdir(frameworks, {recursive: true});
  await rm(target, {recursive: true, force: true});
  await rename(path.join(work, 'x/UnityAds.xcframework'), target);
  await writeFile(stamp, `${VERSION} ${SHA256}\n`);
} finally {
  await rm(work, {recursive: true, force: true});
}
console.log(`Unity Ads iOS SDK ${VERSION} installed in ios/App/Frameworks/.`);
