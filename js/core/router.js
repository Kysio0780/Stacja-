'use strict';
// Routing po hashu (#menu, #grafik, ...) i otwieranie modułów.

/* ROUTING */
window.addEventListener("hashchange", () => {
    const hash = window.location.hash;
    ['modul-sprzedaz', 'modul-premia', 'modul-grafik', 'modul-pracownicy', 'modul-sprzatanie', 'modul-planogram', 'modul-misje', 'modul-statystyki', 'modul-wiadomosci', 'modul-tpsy', 'modul-liczenie', 'modul-raporty', 'modul-finanse', 'menu-tiles'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    if (hash === "#menu" || hash === "") {
        document.getElementById('menu-tiles').classList.remove('hidden');
        if (currentUserData) {
            const imieKrotkie = pobierzImieKrotkie(currentUserData.imie);
            sprawdzPowiadomieniaMisje(currentUserData.uid, imieKrotkie, currentUserData.rola === 'admin');
            sprawdzPowiadomieniaWiadomosci(currentUserData.uid, currentUserData.imie);
            sprawdzPowiadomieniaPracownicyGlobal();
            sprawdzPowiadomieniaTpsGlobal();
            if (typeof window.sprawdzObecnoscGrafikuGlobal === 'function') window.sprawdzObecnoscGrafikuGlobal();
            if (typeof window.sprawdzBadgeRaportu === 'function') window.sprawdzBadgeRaportu();
        }
    } else if (hash === "#tpsy") {
        document.getElementById('modul-tpsy').classList.remove('hidden');
        window.toggleFormularzDodajTps(false);
        window.zaladujModulTps();
    } else if (hash === "#sprzedaz") {
        document.getElementById('modul-sprzedaz').classList.remove('hidden');
        if (typeof window.pokazWidokMiesieczny === 'function') {
            window.pokazWidokMiesieczny();
        } else {
            const kontener = document.getElementById('monthly-table-container');
            if (kontener) kontener.innerHTML = "Moduł sprzedaży nie został załadowany. Odśwież stronę (Ctrl+F5).";
            console.error("Brak window.pokazWidokMiesieczny — nie wykonał się js/modules/sprzedaz.js.");
        }
    } else if (hash === "#premia") {
        document.getElementById('modul-premia').classList.remove('hidden');
        if (!document.getElementById('premia-miesiac').value) {
            document.getElementById('premia-miesiac').value = pobierzBiezacyOkresSystemowy().miesiacStr;
        }
        const czyAdmin = currentUserData && currentUserData.rola === 'admin';
        document.getElementById('admin-premia-panel').classList.toggle('hidden', !czyAdmin);
        document.getElementById('admin-dodatkowa-premia-wrapper').classList.toggle('hidden', !czyAdmin);
        if (czyAdmin) wypelnijSelectPracownikow('admin-dp-pracownik');
        window.zaladujModulPremia();
    } else if (hash === "#grafik") {
        document.getElementById('modul-grafik').classList.remove('hidden');
        const biezacyMiesiacGrafiku = (typeof pobierzBiezacyOkresSystemowy === 'function')
            ? pobierzBiezacyOkresSystemowy().miesiacStr
            : '';
        if (biezacyMiesiacGrafiku) document.getElementById('grafik-miesiac').value = biezacyMiesiacGrafiku;
        window.zaladujGrafikInteraktywny();
    } else if (hash === "#misje") {
        document.getElementById('modul-misje').classList.remove('hidden');
        document.getElementById('admin-misje-wrapper').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        window.zaladujMisje();
    } else if (hash === "#wiadomosci") {
        document.getElementById('modul-wiadomosci').classList.remove('hidden');
        document.getElementById('tab-wszystkie').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        window.zaladujWiadomosci();
    } else if (hash === "#sprzatanie") {
        document.getElementById('modul-sprzatanie').classList.remove('hidden');
        const b = pobierzBiezacyOkresSystemowy();
        document.getElementById('sprzatanie-miesiac').value = b.miesiacStr;
        document.getElementById('sprzatanie-okres').value = b.okresStr;
        window.zaladujSprzatanie();
    } else if (hash === "#planogram") {
        document.getElementById('modul-planogram').classList.remove('hidden');
        document.getElementById('admin-planogram-kategoria-panel').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        window.zaladujPlanogramyMenu();
    } else if (hash === "#pracownicy") {
        document.getElementById('modul-pracownicy').classList.remove('hidden');
        window.zaladujlistePracownikow();
    } else if (hash === "#statystyki") {
        if (!(currentUserData && currentUserData.rola === 'admin')) { window.location.hash = "#menu"; return; }
        document.getElementById('modul-statystyki').classList.remove('hidden');
    } else if (hash === "#liczenie") {
        document.getElementById('modul-liczenie').classList.remove('hidden');
        window.zaladujLiczenie();
    } else if (hash === "#raporty") {
        document.getElementById('modul-raporty').classList.remove('hidden');
        window.zaladujRaporty();
    } else if (hash === "#finanse") {
        if (!(currentUserData && currentUserData.rola === 'admin')) { window.location.hash = "#menu"; return; }
        document.getElementById('modul-finanse').classList.remove('hidden');
    } else if (hash === "#dzien") {
        document.getElementById('modul-sprzedaz').classList.remove('hidden');
        document.getElementById('view-monthly').classList.add('hidden');
        document.getElementById('view-daily').classList.remove('hidden');
    }
});

window.otworzModul = (nazwa) => { window.location.hash = "#" + nazwa; };
