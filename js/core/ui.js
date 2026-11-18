'use strict';
// Elementy wspólne UI: modal informacji, menu użytkownika, sekcje rozwijane, przycisk cofania/Esc.

window.otworzModalInfo = () => document.getElementById('modal-info-app').classList.remove('hidden');
window.zamknijModalInfo = () => document.getElementById('modal-info-app').classList.add('hidden');

/* Wyłączenie aplikacji — jedyny sposób na jej zamknięcie (własne okno potwierdzenia,
   bo natywny confirm() bywa zablokowany w WebView i zwraca undefined). */
window.wylaczAplikacje = function() {
    window.zamknijDropdownMenu();
    const modal = document.getElementById('modal-wylaczenie');
    if (modal) modal.classList.remove('hidden');
};

window.anulujWylaczenie = function() {
    const modal = document.getElementById('modal-wylaczenie');
    if (modal) modal.classList.add('hidden');
};

window.potwierdzWylaczenie = function() {
    window.anulujWylaczenie();
    sessionStorage.setItem("sklep_wylaczone", "1");
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');
    const ekran = document.getElementById('ekran-wylaczone');
    if (login) login.classList.add('hidden');
    if (app) app.classList.add('hidden');
    if (ekran) ekran.classList.remove('hidden');
    try { window.close(); } catch (e) { /* przeglądarka może blokować zamknięcie karty */ }
};

window.uruchomPonownieAplikacje = function() {
    sessionStorage.removeItem("sklep_wylaczone");
    window.location.reload();
};

window.toggleDropdownMenu = (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown-menu').classList.toggle('hidden');
};

window.zamknijDropdownMenu = () => {
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.add('hidden');
};

document.addEventListener('click', window.zamknijDropdownMenu);

window.toggleCollapsible = function(id, arrowId) {
    const content = document.getElementById(id);
    const arrow = document.getElementById(arrowId);
    content.classList.toggle('open');
    arrow.innerText = content.classList.contains('open') ? "▲ Zwiń" : "▼ Rozwiń";
};

function obsluzCofanie() {
    window.zamknijDropdownMenu();
    window.zamknijModalInfo();
    const modals = [
        'modal-zoom-zdjecia', 'modal-polka', 'modal-planogram-szczegoly', 
        'modal-zmien-haslo', 'modal-uniwersalna-misja', 'modal-szczegoly-pracownika', 
        'modal-nowa-wiadomosc', 'modal-podglad-wiadomosci', 'modal-premia-warunki',
        'modal-grafik-komorka', 'modal-grafik-druk', 'modal-obecnosc-grafik', 'modal-wylaczenie'
    ];
    for (let mId of modals) {
        const el = document.getElementById(mId);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            return;
        }
    }
    const hash = window.location.hash;
    if (hash === '#dzien') window.location.hash = '#sprzedaz';
    else if (hash && hash !== '#menu') window.location.hash = '#menu';
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') obsluzCofanie();
});

window.addEventListener('contextmenu', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    e.preventDefault();
    obsluzCofanie();
});

/* Wstecz nigdy nie zamyka aplikacji — zatrzymujemy ją na widoku #menu. */
if (!window.location.hash || window.location.hash === '#') {
    history.replaceState(null, '', '#menu');
}
history.pushState({ sklepSentinel: true }, '', window.location.hash || '#menu');

window.addEventListener('popstate', () => {
    if (sessionStorage.getItem("sklep_wylaczone") === "1") return;
    // Przycisk wstecz (także Android) — zawsze dodajemy nowy wpis strażnika,
    // żeby cofanie nigdy nie opuściło aplikacji.
    history.pushState({ sklepBackGuard: true }, '', window.location.href);
    if (!window.location.hash || window.location.hash === '#') {
        history.replaceState(null, '', '#menu');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
});

/* Po przeładowaniu strony stan wyłączenia pozostaje widoczny. */
if (sessionStorage.getItem("sklep_wylaczone") === "1") {
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');
    const ekran = document.getElementById('ekran-wylaczone');
    if (login) login.classList.add('hidden');
    if (app) app.classList.add('hidden');
    if (ekran) ekran.classList.remove('hidden');
}
