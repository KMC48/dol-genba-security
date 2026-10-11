import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const cwd = fileURLToPath(new URL('../android/', import.meta.url));
const windows = process.platform === 'win32';
// Use the full path: cmd.exe skips the current directory when NoDefaultCurrentDirectoryInExePath is set.
const command = windows ? `"${path.join(cwd, 'gradlew.bat')}"` : './gradlew';
const result = spawnSync(command, process.argv.slice(2), {
  cwd, stdio: 'inherit', shell: windows,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
