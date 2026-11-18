'use strict';
// Elementy wspólne UI: modal informacji, menu użytkownika, sekcje rozwijane, przycisk cofania/Esc.

window.otworzModalInfo = () => document.getElementById('modal-info-app').classList.remove('hidden');
window.zamknijModalInfo = () => document.getElementById('modal-info-app').classList.add('hidden');

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
    // W trybie kiosku Esc i przycisk wstecz nie mogą wyprowadzić z aplikacji.
    if (typeof jestTrybemKiosk === 'function' && jestTrybemKiosk()) return;
    window.zamknijDropdownMenu();
    window.zamknijModalInfo();
    const oknoZoom = document.getElementById('modal-zoom-zdjecia');
    if (oknoZoom && !oknoZoom.classList.contains('hidden')) {
        if (typeof window.zamknijZoomZdjecia === 'function') window.zamknijZoomZdjecia();
        else oknoZoom.classList.add('hidden');
        return;
    }
    const modals = [
        'modal-polka', 'modal-planogram-szczegoly', 
        'modal-zmien-haslo', 'modal-uniwersalna-misja', 'modal-szczegoly-pracownika', 
        'modal-nowa-wiadomosc', 'modal-podglad-wiadomosci', 'modal-premia-warunki',
        'modal-grafik-komorka', 'modal-grafik-druk', 'modal-liczenie'
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
