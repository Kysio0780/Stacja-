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

    let pushSkonfigurowany = false;

    async function zapiszTokenFCM(uid, token) {
        if (!uid || !token) return;
        if (typeof db === 'undefined' || typeof doc === 'undefined' || typeof setDoc === 'undefined') return;
        try {
            await setDoc(doc(db, 'uzytkownicy', uid), {
                fcmToken: token,
                fcmTokenUpdatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.warn('Nie udało się zapisać tokenu FCM:', e);
        }
    }

    async function zapiszSubskrypcjeTematow() {
        const b = bridge();
        if (!jestNatynie() || !b || !b.PushNotifications) return;
        const jestAdmin = !!(typeof currentUserData !== 'undefined' && currentUserData && currentUserData.rola === 'admin');
        try {
            await b.PushNotifications.subscribeToTopic({ topic: 'wszyscy' });
            if (jestAdmin) {
                await b.PushNotifications.subscribeToTopic({ topic: 'admini' });
            } else {
                await b.PushNotifications.unsubscribeFromTopic({ topic: 'admini' });
            }
        } catch (e) {
            console.warn('Nie udało się zapisać do tematów FCM:', e);
        }
    }

    async function skonfigurujPush(uid) {
        const b = bridge();
        if (!jestNatynie() || !b || !b.PushNotifications || !uid) return;
        if (pushSkonfigurowany) return;
        pushSkonfigurowany = true;

        try {
            b.PushNotifications.addListener('registration', token => zapiszTokenFCM(uid, token.value));
            b.PushNotifications.addListener('registrationError', err => console.warn('Błąd rejestracji FCM:', err));
            b.PushNotifications.addListener('pushNotificationReceived', notification => {
                console.info('Powiadomienie push:', notification);
            });
            b.PushNotifications.addListener('pushNotificationActionPerformed', () => {
                window.location.hash = '#wiadomosci';
            });

            const uprawnienia = await b.PushNotifications.requestPermissions();
            if (uprawnienia.receive === 'granted') {
                await b.PushNotifications.register();
                await zapiszSubskrypcjeTematow();
                try {
                    const token = await b.PushNotifications.getToken();
                    if (token && token.value) await zapiszTokenFCM(uid, token.value);
                } catch (e) { /* registration listener zapisze token później */ }
            } else {
                console.warn('Użytkownik nie zezwolił na powiadomienia push.');
            }
        } catch (e) {
            console.warn('Konfiguracja push nie powiodła się:', e);
        }
    }

    window.NativeApp = {
        isNative: jestNatynie,

        odswiezPowiadomienia: async function () {
            const b = bridge();
            if (!jestNatynie() || !b || !b.PushNotifications) {
                alert('Odświeżanie powiadomień jest dostępne w wersji APK.');
                return false;
            }
            const uid = (typeof currentUserData !== 'undefined' && currentUserData)
                ? String(currentUserData.uid || currentUserData.id || '') : '';
            if (!uid) { alert('Zaloguj się, aby odświeżyć powiadomienia.'); return false; }
            try {
                const uprawnienia = await b.PushNotifications.requestPermissions();
                if (uprawnienia.receive !== 'granted') {
                    alert('Zezwól aplikacji na powiadomienia w ustawieniach telefonu.');
                    return false;
                }
                await b.PushNotifications.register();
                await zapiszSubskrypcjeTematow();
                try {
                    const token = await b.PushNotifications.getToken();
                    if (token && token.value) await zapiszTokenFCM(uid, token.value);
                } catch (e) { }
                alert('Powiadomienia zostały odświeżone.');
                return true;
            } catch (e) {
                alert('Nie udało się odświeżyć powiadomień: ' + e.message);
                return false;
            }
        },

        // Wywoływane po zalogowaniu z auth.js.
        initOnLogin: async function (uid) {
            if (!jestNatynie()) return;
            await skonfigurujPush(uid);
            await this.ustawCodziennePrzypomnienie(20, 0);
            const wlaczone = localStorage.getItem('sklep_przyp_zajrzyj') === '1';
            const g1 = localStorage.getItem('sklep_przyp_zajrzyj_1') || '09:30';
            const g2 = localStorage.getItem('sklep_przyp_zajrzyj_2') || '13:30';
            await this.ustawPrzypomnieniaZajrzyj(wlaczone, [g1, g2]);
        },

        ustawCodziennePrzypomnienie: async function (godzina = 20, minuta = 0) {
            const b = bridge();
            if (!jestNatynie() || !b || !b.LocalNotifications) return;
            try {
                const istniejace = await b.LocalNotifications.getPending();
                const stare = istniejace.notifications.filter(n => n.id === 4242);
                if (stare.length) await b.LocalNotifications.remove(stare.map(n => n.id));

                const uprawnienia = await b.LocalNotifications.requestPermissions();
                if (uprawnienia.display !== 'granted') return;

                await b.LocalNotifications.schedule({
                    notifications: [{
                        id: 4242,
                        title: 'Raport operacyjny',
                        body: 'Wypełnij dzisiejszy raport na zakończenie zmiany.',
                        schedule: { hour: godzina, minute: minuta, repeats: true, every: 'day' }
                    }]
                });
            } catch (e) {
                console.warn('Nie udało się ustawić przypomnienia lokalnego:', e);
            }
        },

        ustawPrzypomnieniaZajrzyj: async function (wlaczone, godziny) {
            const b = bridge();
            if (!jestNatynie() || !b || !b.LocalNotifications) return;
            try {
                await b.LocalNotifications.remove([4243, 4244]);
                if (!wlaczone || !Array.isArray(godziny)) return;
                const uprawnienia = await b.LocalNotifications.requestPermissions();
                if (uprawnienia.display !== 'granted') return;
                const notyfikacje = godziny.map((wartosc, idx) => {
                    const [h, m] = String(wartosc || '').split(':').map(Number);
                    return {
                        id: 4243 + idx,
                        title: 'Zajrzyj do aplikacji',
                        body: 'Sprawdź wiadomości, misje i raporty w SklepApp.',
                        schedule: { hour: h || 9, minute: m || 0, repeats: true, every: 'day' }
                    };
                });
                await b.LocalNotifications.schedule({ notifications: notyfikacje });
            } catch (e) {
                console.warn('Nie udało się ustawić przypomnień „Zajrzyj do aplikacji":', e);
            }
        },

        wylaczPrzypomnienie: async function () {
            const b = bridge();
            if (!jestNatynie() || !b || !b.LocalNotifications) return;
            try { await b.LocalNotifications.remove([4242]); } catch (e) { }
        },

        zamknij: async function () {
            const b = bridge();
            if (jestNatynie() && b && b.App && typeof b.App.exitApp === 'function') {
                await b.App.exitApp();
                return;
            }
            try { window.close(); } catch (e) { }
            alert('Zamykanie aplikacji jest dostępne w wersji APK.');
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

    window.odswiezPowiadomienia = function () {
        if (window.NativeApp && typeof window.NativeApp.odswiezPowiadomienia === 'function') {
            window.NativeApp.odswiezPowiadomienia();
        } else {
            alert('Odświeżanie powiadomień jest dostępne w wersji APK.');
        }
    };
})();
