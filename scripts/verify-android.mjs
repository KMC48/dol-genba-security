// Run after sync. Verify the APK input uses the current build, including future font assets.
import {readFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'capacitor.config.json')));
assert.equal(config.webDir, 'www');
assert.ok(!config.server?.url, 'Native builds must bundle local content, not a remote server.url');
const nativeRoot = path.join(root, 'android/app/src/main/assets');
const copiedConfig = JSON.parse(await readFile(path.join(nativeRoot, 'capacitor.config.json')));
assert.deepEqual(copiedConfig, config, 'Run npm run sync:android after changing Capacitor config');
const gradle = await readFile(path.join(root, 'android/app/build.gradle'), 'utf8');
assert.equal(gradle.match(/applicationId\s+"([^"]+)"/)?.[1], config.appId);
assert.equal(gradle.match(/namespace\s*=\s*"([^"]+)"/)?.[1], config.appId);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json')));
assert.equal(gradle.match(/versionName\s+"([^"]+)"/)?.[1], pkg.version);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(dir, prefix = '') {
  const result = [];
  for (const item of await readdir(dir, {withFileTypes: true})) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await files(path.join(dir, item.name), relative));
    else if (item.isFile()) result.push(relative);
  }
  return result;
}
const webFiles = await files(path.join(root, config.webDir));
for (const required of ['index.html', 'game.js', 'style.css']) assert.ok(webFiles.includes(required));
for (const relative of webFiles) {
  const built = await readFile(path.join(root, config.webDir, relative));
  const copied = await readFile(path.join(nativeRoot, 'public', relative));
  assert.equal(hash(copied), hash(built), `Stale native asset: ${relative}`);
  const source = path.join(root, relative);
  if (await stat(source).then(s => s.isFile()).catch(() => false)) {
    assert.equal(hash(built), hash(await readFile(source)), `Stale www asset: ${relative}`);
  }
}
console.log(`PASS: ${webFiles.length} bundled files match www/ and current sources; appId/version/config consistent.`);
console.log(`Provisional appId: ${config.appId}. Owner must confirm before store registration.`);
