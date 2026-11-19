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
            } else {
                console.warn('Użytkownik nie zezwolił na powiadomienia push.');
            }
        } catch (e) {
            console.warn('Konfiguracja push nie powiodła się:', e);
        }
    }

    window.NativeApp = {
        isNative: jestNatynie,

        // Wywoływane po zalogowaniu z auth.js.
        initOnLogin: async function (uid) {
            if (!jestNatynie()) return;
            await skonfigurujPush(uid);
            await this.ustawCodziennePrzypomnienie(20, 0);
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

        wylaczPrzypomnienie: async function () {
            const b = bridge();
            if (!jestNatynie() || !b || !b.LocalNotifications) return;
            try { await b.LocalNotifications.remove([4242]); } catch (e) { }
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
})();
