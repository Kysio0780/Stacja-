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
    "slate-dark": "midnight-blue"
};
function prawidlowyMotyw(tryb) {
    return MOTYWY_PRZEKIEROWANE[tryb] || tryb || MOTYW_DOMYSLNY;
}

window.zmienMotyw = (tryb) => {
    const poprawny = prawidlowyMotyw(tryb);
    localStorage.setItem("sklep_motyw", poprawny);
    zastosujMotyw(poprawny);
};
function zastosujMotyw(tryb) {
    const poprawny = prawidlowyMotyw(tryb);
    if (localStorage.getItem("sklep_motyw") !== poprawny) localStorage.setItem("sklep_motyw", poprawny);
    document.documentElement.setAttribute("data-theme", poprawny);
    const selectDD = document.getElementById('wybor-motywu-dd');
    if (selectDD) selectDD.value = poprawny;
}

window.zmienCzcionke = (rozmiar) => { localStorage.setItem("sklep_czcionka", rozmiar); zastosujCzcionke(rozmiar); };
function zastosujCzcionke(rozmiar) {
    if (rozmiar && rozmiar !== "normal") document.documentElement.setAttribute("data-fontsize", rozmiar);
    else document.documentElement.removeAttribute("data-fontsize");
    const selectDD = document.getElementById('wybor-czcionki-dd');
    if (selectDD) selectDD.value = rozmiar || "normal";
}

/* TRYB PEŁNOEKRANOWY (KIOSK) */
const KLUCZ_TRYBU_KIOSKU = "sklep_tryb_kiosk";

function ustawKlaseKiosku(wlaczony) {
    const aktywny = !!wlaczony;
    document.body.classList.toggle("tryb-kiosk", aktywny);
    const toggleMenu = document.getElementById('kiosk-toggle-dd');
    const toggleModal = document.getElementById('kiosk-toggle-modal');
    if (toggleMenu) toggleMenu.checked = aktywny;
    if (toggleModal) toggleModal.checked = aktywny;
}

window.ustawTrybKiosku = async function(wlaczony, probujFullscreen = false) {
    const aktywny = !!wlaczony;
    try { localStorage.setItem(KLUCZ_TRYBU_KIOSKU, aktywny ? "1" : "0"); } catch (e) { }
    ustawKlaseKiosku(aktywny);
    if (!probujFullscreen) return;

    try {
        if (aktywny) {
            const element = document.documentElement;
            if (element.requestFullscreen) {
                try { await element.requestFullscreen({ navigationUI: "hide" }); }
                catch (e) { await element.requestFullscreen(); }
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            }
        } else if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
        }
    } catch (e) {
        // iPhone Safari nie obsługuje Fullscreen API dla zwykłych stron —
        // sam układ kiosk i tak działa, a przeglądarkę ukrywa PWA z ekranu głównego.
        console.warn("Fullscreen API niedostępne lub odrzucone:", e);
    }
};

window.otworzUstawieniaKiosku = function() {
    document.getElementById('modal-kiosk-ustawienia').classList.remove('hidden');
};
window.zamknijUstawieniaKiosku = function() {
    document.getElementById('modal-kiosk-ustawienia').classList.add('hidden');
};

zastosujMotyw(localStorage.getItem("sklep_motyw") || MOTYW_DOMYSLNY);
zastosujCzcionke(localStorage.getItem("sklep_czcionka") || "normal");
ustawKlaseKiosku(localStorage.getItem(KLUCZ_TRYBU_KIOSKU) === "1");

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
