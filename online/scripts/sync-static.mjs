import { readFileSync, writeFileSync, cpSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.dirname(root);
const destination = path.join(root, 'public');
mkdirSync(destination, { recursive: true });
const files = ['index.html', 'about.html', 'activity.html', 'works.html', 'hawaii.html', 'hawaii-project.html', 'support.html', 'credits.html', 'admin.html', 'admin.css', 'admin.js', 'site.js', 'styles.css'];
for (const file of files) cpSync(path.join(source, file), path.join(destination, file));
cpSync(path.join(source, 'assets'), path.join(destination, 'assets'), { recursive: true });
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(path.join(source, 'content.js'), 'utf8'), sandbox, { timeout: 1000 });
writeFileSync(path.join(root, 'lib', 'initial-content.json'), JSON.stringify(sandbox.window.CLUB_CONTENT, null, 2) + '\n');
function photos(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? photos(absolute) : /\.(jpe?g|png|webp)$/i.test(entry.name) ? [path.relative(destination, absolute).replaceAll('\\', '/')] : [];
  });
}
writeFileSync(path.join(root, 'lib', 'initial-assets.json'), JSON.stringify(photos(path.join(destination, 'assets', 'photos')), null, 2) + '\n');
console.log('サイト原稿と写真をオンライン版へコピーしました。');
