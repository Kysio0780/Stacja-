'use strict';
// Nakładka na natywne funkcje Capacitora. W zwykłej przeglądarce (file://, GitHub Pages)
// plik jest nieaktywny — aplikacja działa dokładnie tak samo jak dotąd.

(function () {
    const bridge = () => {
        if (window.NativeBridge) return window.NativeBridge;
        const kap = window.Capacitor;
        if (!kap) return null;
        return {
            Capacitor: kap,
            NativeBiometric: kap.Plugins ? kap.Plugins.NativeBiometric : null,
            App: kap.Plugins ? kap.Plugins.App : null,
            Camera: kap.Plugins ? kap.Plugins.Camera : null,
            Filesystem: kap.Plugins ? kap.Plugins.Filesystem : null,
            Share: kap.Plugins ? kap.Plugins.Share : null
        };
    };

    function jestNatynie() {
        const b = bridge();
        const kap = (b && b.Capacitor) || window.Capacitor;
        return !!(kap && typeof kap.isNativePlatform === 'function' && kap.isNativePlatform());
    }

    window.NativeApp = {
        isNative: jestNatynie,

        czyDostepnaBiometria: async function () {
            const b = bridge();
            if (!jestNatynie() || !b || !b.NativeBiometric || typeof b.NativeBiometric.isAvailable !== 'function') return false;
            try {
                const wynik = await b.NativeBiometric.isAvailable();
                if (typeof wynik === 'boolean') return wynik;
                return !!(wynik && (wynik.isAvailable || wynik.available || wynik.biometryType));
            } catch (e) { return false; }
        },

        zweryfikujBiometrie: async function (powod = 'Odblokuj aplikację') {
            const b = bridge();
            if (!jestNatynie() || !b || !b.NativeBiometric || typeof b.NativeBiometric.verifyIdentity !== 'function') return true;
            try {
                await b.NativeBiometric.verifyIdentity({
                    reason: powod,
                    title: 'SklepApp',
                    subtitle: 'Weryfikacja biometryczna',
                    description: powod
                });
                return true;
            } catch (e) { return false; }
        },

        zamknij: async function () {
            const b = bridge();
            if (jestNatynie() && b && b.App && typeof b.App.exitApp === 'function') {
                await b.App.exitApp();
                return;
            }
            try { window.close(); } catch (e) { }
        },

        // Zwraca data URL zdjęcia z natywnego aparatu (aparat.js konwertuje je do File).
        takePicture: async function () {
            const b = bridge();
            if (!jestNatynie() || !b || !b.Camera) return null;
            const photo = await b.Camera.getPhoto({
                quality: 85,
                resultType: b.CameraResultType ? b.CameraResultType.DataUrl : 'dataUrl',
                source: b.CameraSource ? b.CameraSource.Camera : 'camera',
                correctOrientation: true
            });
            return photo.dataUrl || null;
        }
    };

    window.zamknijAplikacje = function () {
        if (window.NativeApp && typeof window.NativeApp.zamknij === 'function') window.NativeApp.zamknij();
    };
})();
