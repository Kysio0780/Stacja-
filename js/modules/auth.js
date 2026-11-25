'use strict';
// Logowanie, wylogowanie i onAuthStateChanged (uruchamia aplikację — ładowany jako OSTATNI).

/* ==================== LOGOWANIE I AUTORYZACJA ==================== */

let noweLogowanie = false;
let biometriaOdblokowana = false;

function pokazBlokadeBiometryczna() {
    const blokada = document.getElementById('blokada-biometryczna');
    const blad = document.getElementById('biometria-blad');
    if (blad) { blad.innerText = ''; blad.classList.add('hidden'); }
    if (blokada) blokada.classList.remove('hidden');
}

function ukryjBlokadeBiometryczna() {
    document.getElementById('blokada-biometryczna')?.classList.add('hidden');
}

window.odblokujBiometria = async function () {
    const blad = document.getElementById('biometria-blad');
    const ok = window.NativeApp && typeof window.NativeApp.zweryfikujBiometrie === 'function'
        ? await window.NativeApp.zweryfikujBiometrie('Odblokuj aplikację')
        : false;
    if (ok) {
        biometriaOdblokowana = true;
        ukryjBlokadeBiometryczna();
    } else if (blad) {
        blad.innerText = 'Weryfikacja nie powiodła się. Spróbuj ponownie.';
        blad.classList.remove('hidden');
    }
};

function ustawStatusBiometrii(tekst, blad = false) {
    const pole = document.getElementById('biometria-status');
    if (!pole) return;
    pole.innerText = tekst || '';
    pole.className = blad ? 'error' : 'text-muted';
    pole.style.fontSize = '0.78em';
    pole.style.margin = '4px 0 0 0';
}

window.ustawBiometrieUzytkownika = async function (wlaczone) {
    const zalaczone = !!wlaczony;
    const wAPK = window.NativeApp && typeof window.NativeApp.isNative === 'function' && window.NativeApp.isNative();

    if (!zalaczone) {
        if (!currentUserData) return;
        try {
            await setDoc(doc(db, 'preferencje_uzytkownika', currentUserData.uid), {
                biometria: false, updatedAt: new Date().toISOString()
            }, { merge: true });
            window.ustawFlageBiometrii?.(false);
            ustawStatusBiometrii('Biometria wyłączona.');
        } catch (e) { ustawStatusBiometrii('Błąd zapisu: ' + e.message, true); }
        return;
    }

    if (!wAPK) {
        window.ustawFlageBiometrii?.(false);
        ustawStatusBiometrii('Dostępne tylko w APK — tu nie można włączyć biometrii.', true);
        return;
    }
    if (!window.NativeApp || typeof window.NativeApp.zweryfikujBiometrie !== 'function') {
        window.ustawFlageBiometrii?.(false);
        ustawStatusBiometrii('Plugin biometrii nie jest dostępny w tej wersji APK.', true);
        return;
    }

    ustawStatusBiometrii('Oczekiwanie na weryfikację…');
    const potwierdzone = await window.NativeApp.zweryfikujBiometrie('Potwierdź włączenie biometrii');
    if (!potwierdzone) {
        window.ustawFlageBiometrii?.(false);
        ustawStatusBiometrii('Weryfikacja nie powiodła się. Sprawdź biometrię w telefonie.', true);
        return;
    }
    if (!currentUserData) return;
    try {
        await setDoc(doc(db, 'preferencje_uzytkownika', currentUserData.uid), {
            biometria: true, updatedAt: new Date().toISOString()
        }, { merge: true });
        window.ustawFlageBiometrii?.(true);
        ustawStatusBiometrii('Włączone. Kolejne uruchomienie APK poprosi o odblokowanie.');
    } catch (e) {
        window.ustawFlageBiometrii?.(false);
        ustawStatusBiometrii('Błąd zapisu: ' + e.message, true);
    }
};

async function pobierzEmailDoLogowania(login) {
    // Login jest aliasem w Firestore, a właściwy e-mail Firebase Auth pozostaje niezmienny.
    // Dzięki temu zmiana loginu nie wymaga zmiany adresu w Firebase Auth.
    try {
        const q = query(collection(db, "uzytkownicy"), where("login", "==", login), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const dane = snap.docs[0].data();
            return dane.authEmail || `${dane.login || login}@sp580.pl`;
        }
    } catch (e) {
        console.warn("Nie udało się odczytać aliasu logowania:", e);
    }
    return `${login}@sp580.pl`;
}

window.zaloguj = async function() {
    const login = document.getElementById('login-input').value.trim().toLowerCase();
    const pass = document.getElementById('password-input').value;
    document.getElementById('error-msg').innerText = "";
    if (!login || !pass) return;
    noweLogowanie = true;
    try {
        const email = await pobierzEmailDoLogowania(login);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            // Awaryjnie próbujemy domyślnego adresu (starsze konta) — logowanie nadal działa
            // nawet jeśli odczyt aliasu z Firestore został zablokowany przez reguły bezpieczeństwa.
            const domyslnyEmail = `${login}@sp580.pl`;
            if (email !== domyslnyEmail) {
                await signInWithEmailAndPassword(auth, domyslnyEmail, pass);
            } else {
                throw e;
            }
        }
    } catch (error) {
        noweLogowanie = false;
        document.getElementById('error-msg').innerText = "Błąd: Niepoprawny login lub hasło.";
    }
};

window.wyloguj = () => {
    biometriaOdblokowana = false;
    ukryjBlokadeBiometryczna();
    window.location.hash = "";
    signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        ustawBiezacaDateWNaglowku();
        const docSnap = await getDoc(doc(db, "uzytkownicy", user.uid));
        if (docSnap.exists() && docSnap.data().imie) {
            currentUserData = { ...docSnap.data(), uid: user.uid };
            const imieKrotkie = pobierzImieKrotkie(currentUserData.imie);
            document.getElementById('profile-btn-label').innerText = imieKrotkie;
            if (typeof window.wczytajPreferencjeUzytkownika === 'function') await window.wczytajPreferencjeUzytkownika();
            const czyAdmin = currentUserData.rola === 'admin';
            document.getElementById('admin-daily-section').classList.toggle('hidden', !czyAdmin);
            document.getElementById('tile-pracownicy').style.display = czyAdmin ? 'flex' : 'none';
            // Statystyki są dostępne dla wszystkich zalogowanych użytkowników.
            document.getElementById('tile-statystyki').style.display = 'flex';
            document.getElementById('tile-finanse').style.display = czyAdmin ? 'flex' : 'none';
            if (typeof window.inicjalizujWskaznikMagazynu === 'function') window.inicjalizujWskaznikMagazynu();
            if (typeof window.sprawdzObecnoscGrafikuGlobal === 'function') window.sprawdzObecnoscGrafikuGlobal();
            if (typeof window.sprawdzBadgeRaportu === 'function') window.sprawdzBadgeRaportu();
            
            sprawdzPowiadomieniaMisje(user.uid, imieKrotkie, czyAdmin);
            sprawdzPowiadomieniaWiadomosci(user.uid, currentUserData.imie);
            sprawdzPowiadomieniaPracownicyGlobal();
            sprawdzPowiadomieniaTpsGlobal();

            const wAPK = window.NativeApp && typeof window.NativeApp.isNative === 'function' && window.NativeApp.isNative();
            const wymagaBiometrii = !noweLogowanie && !biometriaOdblokowana && wAPK
                && typeof window.pobierzBiometrieUzytkownika === 'function'
                && window.pobierzBiometrieUzytkownika();
            noweLogowanie = false;
            if (wymagaBiometrii) pokazBlokadeBiometryczna();

            window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
            currentUserData = null;
            document.getElementById('error-msg').innerText = "To konto nie ma przypisanego profilu pracownika. Skontaktuj się z administratorem.";
            try { await signOut(auth); } catch (e) { console.error(e); }
            biometriaOdblokowana = false;
            ukryjBlokadeBiometryczna();
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
            const wskaznikRozmiaru = document.getElementById('header-storage-usage');
            if (wskaznikRozmiaru) wskaznikRozmiaru.classList.add('hidden');
        }
    } else {
        currentUserData = null;
        biometriaOdblokowana = false;
        ukryjBlokadeBiometryczna();
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        const wskaznikRozmiaru = document.getElementById('header-storage-usage');
        if (wskaznikRozmiaru) wskaznikRozmiaru.classList.add('hidden');
        const badgeGrafiku = document.getElementById('grafik-badge');
        if (badgeGrafiku) badgeGrafiku.classList.add('hidden');
        const badgeRaportu = document.getElementById('raporty-badge');
        if (badgeRaportu) badgeRaportu.classList.add('hidden');
    }
});
