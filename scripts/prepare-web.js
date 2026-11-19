// Przygotowuje katalog www dla Capacitora: kopiuje pliki aplikacji
// i dobudowuje mały bundle z pluginami natywnymi.
const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const item of ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
    fs.copyFileSync(path.join(root, item), path.join(www, item));
}
copyDir(path.join(root, 'css'), path.join(www, 'css'));
copyDir(path.join(root, 'js'), path.join(www, 'js'));

build({
    entryPoints: [path.join(root, 'js', 'native-entry.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    outfile: path.join(www, 'js', 'vendor', 'capacitor-native.js')
}).then(() => {
    console.log('Przygotowano katalog www dla Capacitora.');
}).catch(err => {
    console.error(err);
    process.exit(1);
});
