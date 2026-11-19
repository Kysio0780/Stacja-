// Dodaje do wygenerowanego przez Capacitora android/app/build.gradle konfigurację
// podpisu release. Uruchamiane tylko wtedy, gdy w repozytorium są sekrety podpisu.
const fs = require('fs');
const path = require('path');

const gradlePath = path.resolve(__dirname, '..', 'android', 'app', 'build.gradle');
let src = fs.readFileSync(gradlePath, 'utf8');

if (!src.includes('signingConfigs')) {
    const signingConfig = `
    signingConfigs {
        release {
            if (project.hasProperty('SIGNING_STORE_PASSWORD')) {
                storeFile file('release.keystore')
                storePassword project.property('SIGNING_STORE_PASSWORD')
                keyAlias project.property('SIGNING_KEY_ALIAS')
                keyPassword project.property('SIGNING_KEY_PASSWORD')
            }
        }
    }
`;
    if (!/\n\s*buildTypes\s*\{/.test(src)) throw new Error('Nie znaleziono bloku buildTypes w build.gradle');
    src = src.replace(/\n(\s*)buildTypes\s*\{/, `\n${signingConfig}\n$1buildTypes {`);
}

if (!/signingConfig\s+signingConfigs\.release/.test(src)) {
    // Szukamy „release" dopiero wewnątrz bloku buildTypes, nie w signingConfigs.
    src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
}

fs.writeFileSync(gradlePath, src);
console.log('Skonfigurowano podpis release w android/app/build.gradle');
