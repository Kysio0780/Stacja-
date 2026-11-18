'use strict';
// Logowanie, wylogowanie i onAuthStateChanged (uruchamia aplikację — ładowany jako OSTATNI).

/* ==================== LOGOWANIE I AUTORYZACJA ==================== */
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
    } catch (error) { document.getElementById('error-msg').innerText = "Błąd: Niepoprawny login lub hasło."; }
};

window.wyloguj = () => { window.location.hash = ""; signOut(auth); };

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
            if (typeof window.wczytajPreferencjeUzytkownika === 'function') window.wczytajPreferencjeUzytkownika();
            const czyAdmin = currentUserData.rola === 'admin';
            document.getElementById('admin-daily-section').classList.toggle('hidden', !czyAdmin);
            document.getElementById('tile-pracownicy').style.display = czyAdmin ? 'flex' : 'none';
            document.getElementById('tile-statystyki').style.display = czyAdmin ? 'flex' : 'none';
            document.getElementById('tile-finanse').style.display = czyAdmin ? 'flex' : 'none';
            if (typeof window.inicjalizujWskaznikMagazynu === 'function') window.inicjalizujWskaznikMagazynu();
            if (typeof window.sprawdzObecnoscGrafikuGlobal === 'function') window.sprawdzObecnoscGrafikuGlobal();
            
            sprawdzPowiadomieniaMisje(user.uid, imieKrotkie, czyAdmin);
            sprawdzPowiadomieniaWiadomosci(user.uid, currentUserData.imie);
            sprawdzPowiadomieniaPracownicyGlobal();
            sprawdzPowiadomieniaTpsGlobal();
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
            currentUserData = null;
            document.getElementById('error-msg').innerText = "To konto nie ma przypisanego profilu pracownika. Skontaktuj się z administratorem.";
            try { await signOut(auth); } catch (e) { console.error(e); }
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-screen').classList.add('hidden');
            const wskaznikRozmiaru = document.getElementById('header-storage-usage');
            if (wskaznikRozmiaru) wskaznikRozmiaru.classList.add('hidden');
        }
    } else {
        currentUserData = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        const wskaznikRozmiaru = document.getElementById('header-storage-usage');
        if (wskaznikRozmiaru) wskaznikRozmiaru.classList.add('hidden');
        const badgeGrafiku = document.getElementById('grafik-badge');
        if (badgeGrafiku) badgeGrafiku.classList.add('hidden');
    }
});
