'use strict';
// Nakładka na natywne funkcje Capacitora. W zwykłej przeglądarce (file://, GitHub Pages)
// plik jest nieaktywny — aplikacja działa dokładnie tak samo jak dotąd.

(function () {
    const bridge = () => window.NativeBridge || null;

    function jestNatynie() {
        const b = bridge();
        return !!(b && b.Capacitor && typeof b.Capacitor.isNativePlatform === 'function'
            && b.Capacitor.isNativePlatform());
    }

    window.NativeApp = {
        isNative: jestNatynie,

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
