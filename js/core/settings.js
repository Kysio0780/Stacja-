'use strict';
// Motywy, rozmiar czcionki, zmiana własnego hasła.

/* MOTYWY I CZCIONKA */
const MOTYW_DOMYSLNY = "mint-light";
/* Motywy usunięte z listy — stary wybór zapisany w localStorage przekierowujemy
   na najbliższy zachowany motyw, żeby nikt nie został z nieistniejącym motywem. */
const MOTYWY_PRZEKIEROWANE = {
    "light": MOTYW_DOMYSLNY,
    "warm-light": MOTYW_DOMYSLNY,
    "dark": "midnight-blue",
    "slate-dark": "steel-dark",
    // Usunięty grafitowy z pomarańczowym akcentem — zastępuje go stalowy ciemny.
    "graphite-dark": "steel-dark",
    // Usunięte motywy jasne — ich wybór przekierowujemy na najbliższe nowe.
    "sand-light": "sepia-light",
    "steel-light": "gray-light"
};
function prawidlowyMotyw(tryb) {
    return MOTYWY_PRZEKIEROWANE[tryb] || tryb || MOTYW_DOMYSLNY;
}

/* Preferencje per użytkownik — localStorage służy tylko do natychmiastowego
   wyglądu przed zalogowaniem; po zalogowaniu wygrywa zapis z Firestore. */
const PREFERENCJE_UZYTKOWNIKA_KOLEKCJA = 'preferencje_uzytkownika';
const DOMYSLNY_RODZAJ_CZCIONKI = 'inter';
const RODZAJE_CZCIONEK = ['inter', 'roboto', 'opensans', 'lato', 'montserrat', 'poppins'];
let ladowaniePreferencji = false;
let biometriaUzytkownika = false;

window.pobierzBiometrieUzytkownika = function () { return !!biometriaUzytkownika; };
window.ustawFlageBiometrii = function (wlaczone) {
    biometriaUzytkownika = !!wlaczone;
    const pole = document.getElementById('biometria-dd');
    if (pole) pole.checked = biometriaUzytkownika;
};

function prawidlowyRodzajCzcionki(rodzaj) {
    return RODZAJE_CZCIONEK.includes(rodzaj) ? rodzaj : DOMYSLNY_RODZAJ_CZCIONKI;
}

function identyfikatorUzytkownikaPreferencji() {
    if (!currentUserData) return "";
    return String(currentUserData.uid || currentUserData.id || "");
}

async function zapiszPreferencjeDoFirestore() {
    if (ladowaniePreferencji) return;
    const uid = identyfikatorUzytkownikaPreferencji();
    if (!uid) return;
    try {
        await setDoc(doc(db, PREFERENCJE_UZYTKOWNIKA_KOLEKCJA, uid), {
            motyw: prawidlowyMotyw(localStorage.getItem("sklep_motyw") || MOTYW_DOMYSLNY),
            czcionka: localStorage.getItem("sklep_czcionka") || "normal",
            rodzajCzcionki: prawidlowyRodzajCzcionki(localStorage.getItem("sklep_rodzaj_czcionki")),
            biometria: window.pobierzBiometrieUzytkownika ? window.pobierzBiometrieUzytkownika() : false,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('Nie udało się zapisać preferencji użytkownika:', e);
    }
}

window.wczytajPreferencjeUzytkownika = async function() {
    const uid = identyfikatorUzytkownikaPreferencji();
    if (!uid) return;
    try {
        const snap = await getDoc(doc(db, PREFERENCJE_UZYTKOWNIKA_KOLEKCJA, uid));
        if (snap.exists()) {
            const dane = snap.data();
            ladowaniePreferencji = true;
            if (dane.motyw) {
                localStorage.setItem("sklep_motyw", dane.motyw);
                zastosujMotyw(dane.motyw);
            }
            const czcionka = dane.czcionka || "normal";
            localStorage.setItem("sklep_czcionka", czcionka);
            zastosujCzcionke(czcionka);
            const rodzaj = prawidlowyRodzajCzcionki(dane.rodzajCzcionki);
            localStorage.setItem("sklep_rodzaj_czcionki", rodzaj);
            zastosujRodzajCzcionki(rodzaj);
            if (typeof window.ustawFlageBiometrii === 'function') window.ustawFlageBiometrii(!!dane.biometria);
            ladowaniePreferencji = false;
        } else {
            // Pierwsze logowanie — ustawienia dotychczas używane na tym urządzeniu
            // stają się domyślnymi dla tego konta.
            await zapiszPreferencjeDoFirestore();
        }
    } catch (e) {
        ladowaniePreferencji = false;
        console.warn('Nie udało się wczytać preferencji użytkownika:', e);
    }
};

window.zmienMotyw = (tryb) => {
    const poprawny = prawidlowyMotyw(tryb);
    localStorage.setItem("sklep_motyw", poprawny);
    zastosujMotyw(poprawny);
    zapiszPreferencjeDoFirestore();
};
function zastosujMotyw(tryb) {
    const poprawny = prawidlowyMotyw(tryb);
    if (localStorage.getItem("sklep_motyw") !== poprawny) localStorage.setItem("sklep_motyw", poprawny);
    document.documentElement.setAttribute("data-theme", poprawny);
    const selectDD = document.getElementById('wybor-motywu-dd');
    if (selectDD) selectDD.value = poprawny;
}

window.zmienCzcionke = (rozmiar) => {
    localStorage.setItem("sklep_czcionka", rozmiar);
    zastosujCzcionke(rozmiar);
    zapiszPreferencjeDoFirestore();
};
function zastosujCzcionke(rozmiar) {
    if (rozmiar && rozmiar !== "normal") document.documentElement.setAttribute("data-fontsize", rozmiar);
    else document.documentElement.removeAttribute("data-fontsize");
    const selectDD = document.getElementById('wybor-czcionki-dd');
    if (selectDD) selectDD.value = rozmiar || "normal";
}

window.zmienRodzajCzcionki = (rodzaj) => {
    const poprawny = prawidlowyRodzajCzcionki(rodzaj);
    localStorage.setItem("sklep_rodzaj_czcionki", poprawny);
    zastosujRodzajCzcionki(poprawny);
    zapiszPreferencjeDoFirestore();
};
function zastosujRodzajCzcionki(rodzaj) {
    const poprawny = prawidlowyRodzajCzcionki(rodzaj);
    document.documentElement.setAttribute("data-font", poprawny);
    const selectDD = document.getElementById('wybor-rodzaju-czcionki-dd');
    if (selectDD) selectDD.value = poprawny;
}

/* TRYB PEŁNOEKRANOWY (KIOSK) – domyślnie włączony */
// Kolejny klucz celowo ignoruje poprzednie zapisy (v1/v2), żeby przywrócić
// kiosk jako domyślnie włączony. Świadome wyłączenie zapisuje „0" i jest szanowane.
const KLUCZ_TRYBU_KIOSKU = "sklep_tryb_kiosk_v3";

function jestTrybemKiosk() {
    return document.body.classList.contains("tryb-kiosk");
}

function pelnyEkranAktywny() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function ustawKlaseKiosku(wlaczony) {
    const aktywny = !!wlaczony;
    document.body.classList.toggle("tryb-kiosk", aktywny);
    document.documentElement.classList.toggle("tryb-kiosk", aktywny);
    const toggleMenu = document.getElementById('kiosk-toggle-dd');
    if (toggleMenu) toggleMenu.checked = aktywny;
}

async function poproszOSFullscreen() {
    if (pelnyEkranAktywny()) return;
    const element = document.documentElement;
    try {
        if (element.requestFullscreen) {
            try { await element.requestFullscreen({ navigationUI: "hide" }); }
            catch (e) { await element.requestFullscreen(); }
        } else if (element.webkitRequestFullscreen) {
            await element.webkitRequestFullscreen();
        }
    } catch (e) {
        // iPhone Safari nie obsługuje Fullscreen API poza wideo —
        // PWA dodana do ekranu głównego i tak ukrywa pasek Safari.
    }
}

function kioskPopstate() {
    if (!jestTrybemKiosk()) return;
    history.pushState({ kiosk: true }, "");
    poproszOSFullscreen();
}

let blokadaWsteczAktywna = false;
function ustawBlokadeWstecz(aktywny) {
    if (aktywny && !blokadaWsteczAktywna) {
        blokadaWsteczAktywna = true;
        history.pushState({ kiosk: true }, "");
        window.addEventListener("popstate", kioskPopstate);
    } else if (!aktywny && blokadaWsteczAktywna) {
        blokadaWsteczAktywna = false;
        window.removeEventListener("popstate", kioskPopstate);
    }
}

window.ustawTrybKiosku = async function(wlaczony, probujFullscreen = false) {
    const aktywny = !!wlaczony;
    try { localStorage.setItem(KLUCZ_TRYBU_KIOSKU, aktywny ? "1" : "0"); } catch (e) { }
    ustawKlaseKiosku(aktywny);
    ustawBlokadeWstecz(aktywny);
    if (!probujFullscreen) return;

    if (aktywny) {
        await poproszOSFullscreen();
    } else if (pelnyEkranAktywny()) {
        try {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        } catch (e) { }
    }
};

// Gdy system wyjdzie z fullscreenu, wracamy do niego przy najbliższej interakcji.
document.addEventListener("fullscreenchange", () => {
    if (jestTrybemKiosk() && !pelnyEkranAktywny()) poproszOSFullscreen();
});
["pointerdown", "keydown"].forEach(typZdarzenia => {
    document.addEventListener(typZdarzenia, () => {
        if (jestTrybemKiosk() && !pelnyEkranAktywny()) poproszOSFullscreen();
    });
});

zastosujMotyw(localStorage.getItem("sklep_motyw") || MOTYW_DOMYSLNY);
zastosujCzcionke(localStorage.getItem("sklep_czcionka") || "normal");
zastosujRodzajCzcionki(prawidlowyRodzajCzcionki(localStorage.getItem("sklep_rodzaj_czcionki")));

const kioskZapisany = localStorage.getItem(KLUCZ_TRYBU_KIOSKU);
// Tryb kiosku jest domyślnie włączony; wyłączenie zapisuje „0".
const kioskDomyslnieWlaczony = kioskZapisany !== "0";
ustawKlaseKiosku(kioskDomyslnieWlaczony);
ustawBlokadeWstecz(kioskDomyslnieWlaczony);
if (kioskZapisany === null) {
    try { localStorage.setItem(KLUCZ_TRYBU_KIOSKU, "1"); } catch (e) { }
}

/* ZMIANA HASŁA */
window.otworzModalZmianyHasla = () => {
    ['stare-haslo', 'nowe-haslo-1', 'nowe-haslo-2'].forEach(id => document.getElementById(id).value = "");
    document.getElementById('haslo-msg').innerText = "";
    document.getElementById('modal-zmien-haslo').classList.remove('hidden');
};
window.zamknijModalZmianyHasla = () => document.getElementById('modal-zmien-haslo').classList.add('hidden');

window.zmienWlasneHasloPotwierdz = async function() {
    const stareHaslo = document.getElementById('stare-haslo').value;
    const h1 = document.getElementById('nowe-haslo-1').value;
    const h2 = document.getElementById('nowe-haslo-2').value;
    const msg = document.getElementById('haslo-msg');
    msg.style.color = "var(--danger)"; msg.innerText = "";

    if (!stareHaslo || !h1 || !h2) { msg.innerText = "Wypełnij wszystkie pola!"; return; }
    if (h1 !== h2) { msg.innerText = "Hasła się nie zgadzają!"; return; }
    if (h1.length < 6) { msg.innerText = "Nowe hasło musi mieć min. 6 znaków!"; return; }

    const user = auth.currentUser;
    if (!user) return;

    try {
        const credential = EmailAuthProvider.credential(user.email, stareHaslo);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, h1);
        msg.style.color = "var(--success)";
        msg.innerText = "Hasło zostało pomyślnie zmienione!";
        setTimeout(window.zamknijModalZmianyHasla, 1400);
    } catch (error) {
        msg.innerText = (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')
            ? "Błąd: Podano niepoprawne aktualne hasło." : "Błąd: " + error.message;
    }
};
