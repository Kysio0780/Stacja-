'use strict';
// Logowanie, wylogowanie i onAuthStateChanged (uruchamia aplikację — ładowany jako OSTATNI).

/* ==================== LOGOWANIE I AUTORYZACJA ==================== */

const KLUCZ_ZAPAMIETANYCH_LOGOWAN = 'sklep_zapamietane_logowania';
let ostatnieLogowanie = { login: '', pass: '' };
let zapamietajHasloUzytkownika = false;

function pobierzZapamietaneLogowania() {
    try { return JSON.parse(localStorage.getItem(KLUCZ_ZAPAMIETANYCH_LOGOWAN) || '{}') || {}; }
    catch (e) { return {}; }
}

function zapiszZapamietaneLogowania(mapa) {
    try { localStorage.setItem(KLUCZ_ZAPAMIETANYCH_LOGOWAN, JSON.stringify(mapa)); } catch (e) { }
}

function zapamietajDaneLogowania(login, pass, uid) {
    const klucz = String(login || '').toLowerCase();
    if (!klucz) return;
    const mapa = pobierzZapamietaneLogowania();
    mapa[klucz] = { pass, uid };
    zapiszZapamietaneLogowania(mapa);
    try { localStorage.setItem('sklep_ostatni_login', klucz); } catch (e) { }
}

function zapomnijDaneLogowania(login) {
    const klucz = String(login || '').toLowerCase();
    const mapa = pobierzZapamietaneLogowania();
    delete mapa[klucz];
    zapiszZapamietaneLogowania(mapa);
}

window.zapiszDaneLogowaniaJesliWymagane = function() {
    if (!zapamietajHasloUzytkownika || !ostatnieLogowanie.login) return;
    zapamietajDaneLogowania(ostatnieLogowanie.login, ostatnieLogowanie.pass, currentUserData ? currentUserData.uid : '');
};

window.zalogujUstawZapamietanie = function(wlaczony) {
    const login = document.getElementById('login-input')?.value || '';
    if (!wlaczony) zapomnijDaneLogowania(login);
};

window.pobierzZapamietanieHasla = function() { return !!zapamietajHasloUzytkownika; };

window.odswiezPrzyciskZapamietania = function() {
    const pole = document.getElementById('zapamietaj-haslo-dd');
    if (pole) pole.checked = !!zapamietajHasloUzytkownika;
};

window.ustawFlageZapamietaniaHasla = function(wlaczony) {
    zapamietajHasloUzytkownika = !!wlaczony;
    window.odswiezPrzyciskZapamietania();
};

window.ustawZapamietanieHaslaUzytkownika = async function(wlaczony) {
    zapamietajHasloUzytkownika = !!wlaczony;
    if (!currentUserData) return;
    try {
        await setDoc(doc(db, 'preferencje_uzytkownika', currentUserData.uid), {
            zapamietajHaslo: zapamietajHasloUzytkownika,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) { console.warn('Nie udało się zapisać ustawienia zapamiętywania hasła:', e); }
    if (zapamietajHasloUzytkownika) window.zapiszDaneLogowaniaJesliWymagane();
    else if (ostatnieLogowanie.login) zapomnijDaneLogowania(ostatnieLogowanie.login);
};

function wypelnijLoginZPamieci() {
    try {
        const login = localStorage.getItem('sklep_ostatni_login') || '';
        if (!login) return;
        const wpis = pobierzZapamietaneLogowania()[login];
        if (!wpis) return;
        const poleLogin = document.getElementById('login-input');
        const poleHaslo = document.getElementById('password-input');
        const poleZapamietaj = document.getElementById('zapamietaj-mnie');
        if (poleLogin) poleLogin.value = login;
        if (poleHaslo) poleHaslo.value = wpis.pass || '';
        if (poleZapamietaj) poleZapamietaj.checked = true;
    } catch (e) { }
}

document.addEventListener('DOMContentLoaded', wypelnijLoginZPamieci);
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'login-input') {
        const klucz = String(e.target.value || '').trim().toLowerCase();
        const wpis = pobierzZapamietaneLogowania()[klucz];
        const poleHaslo = document.getElementById('password-input');
        const poleZapamietaj = document.getElementById('zapamietaj-mnie');
        if (wpis && poleHaslo) poleHaslo.value = wpis.pass || '';
        if (poleZapamietaj) poleZapamietaj.checked = !!wpis;
    }
});

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
        ostatnieLogowanie = { login, pass };
        const zapamietajNaLogowaniu = !!document.getElementById('zapamietaj-mnie')?.checked;
        if (zapamietajNaLogowaniu) {
            zapamietajHasloUzytkownika = true;
            zapamietajDaneLogowania(login, pass, auth.currentUser ? auth.currentUser.uid : '');
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
        const badgeRaportu = document.getElementById('raporty-badge');
        if (badgeRaportu) badgeRaportu.classList.add('hidden');
    }
});
