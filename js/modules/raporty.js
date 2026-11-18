'use strict';
// Moduł Raporty operacyjne (paliwa, liczniki, historia, statystyki i czyszczenie).

const RAPORTY_OPERACYJNE_KOLEKCJA = 'raporty_operacyjne';
const RAPORTY_PROGI_DOK = 'raporty_paliwa_min';
const RAPORTY_PALIWA = [
    { klucz: 'p95', etykieta: '95', domyslne: 4000 },
    { klucz: 'on', etykieta: 'ON', domyslne: 4000 },
    { klucz: 'v98', etykieta: 'V98', domyslne: 1000 },
    { klucz: 'von', etykieta: 'VON', domyslne: 1500 }
];
const RAPORTY_LICZNIKI = [
    { klucz: 'kawaDuza', etykieta: 'Kawa duża' },
    { klucz: 'kawaMala', etykieta: 'Kawa mała' },
    { klucz: 'odkurzacz', etykieta: 'Odkurzacz' }
];
let raportTylkoPodglad = false;
let progiPaliwRaportu = Object.fromEntries(RAPORTY_PALIWA.map(p => [p.klucz, p.domyslne]));

function dzisiejszaDataRaportu() {
    return pobierzDzisiejszaDateStr();
}

function czyAdminRaportow() {
    return !!(currentUserData && currentUserData.rola === 'admin');
}

function uidPracownikaRaportu() {
    return currentUserData ? String(pobierzIdPracownika(currentUserData)) : '';
}

async function czyPracownikMaZmianeWymaganaRaportu(uid, data) {
    const [rok, miesiac, dzien] = data.split('-').map(Number);
    const miesiacStr = `${rok}-${String(miesiac).padStart(2, '0')}`;
    const snap = await getDoc(doc(db, 'grafiki', miesiacStr));
    if (!snap.exists()) return false;
    const grafik = snap.data();
    const dzienTygodnia = new Date(rok, miesiac - 1, dzien).getDay();
    const swieto = !!(grafik.holidays && grafik.holidays[String(dzien)]);
    const zmiana = (dzienTygodnia === 0 || swieto) ? 'rano' : 'zamkniecie';
    const komorka = grafik.entries && grafik.entries[`${uid}_${dzien}_${zmiana}`];
    return !!(komorka && komorka.type === 'praca' && (Number(komorka.hours) || 0) > 0);
}

window.sprawdzBadgeRaportu = async function() {
    const badge = document.getElementById('raporty-badge');
    if (!badge) return;
    const ukryj = () => badge.classList.add('hidden');
    if (!currentUserData || czyAdminRaportow()) return ukryj();
    const uid = uidPracownikaRaportu();
    if (!uid) return ukryj();
    const dzis = dzisiejszaDataRaportu();
    try {
        if (!await czyPracownikMaZmianeWymaganaRaportu(uid, dzis)) return ukryj();
        const raport = await getDoc(doc(db, RAPORTY_OPERACYJNE_KOLEKCJA, dzis));
        badge.classList.toggle('hidden', raport.exists());
    } catch (e) {
        ukryj();
    }
};

/* ===== Progi minimalnych ilości paliw (tylko admin) ===== */

async function pobierzProgiPaliwRaportow() {
    try {
        const snap = await getDoc(doc(db, 'system_ustawienia', RAPORTY_PROGI_DOK));
        const dane = snap.exists() ? snap.data() : {};
        const progi = {};
        RAPORTY_PALIWA.forEach(p => {
            const wartosc = Number(dane[p.klucz]);
            progi[p.klucz] = Number.isFinite(wartosc) && wartosc >= 0 ? wartosc : p.domyslne;
        });
        return progi;
    } catch (e) {
        return Object.fromEntries(RAPORTY_PALIWA.map(p => [p.klucz, p.domyslne]));
    }
}

function wypelnijPolaProgow(progi) {
    RAPORTY_PALIWA.forEach(p => {
        const pole = document.getElementById(`raport-prog-${p.klucz}`);
        if (pole) pole.value = progi[p.klucz];
    });
}

window.zapiszProgiPaliwRaportow = async function() {
    if (!czyAdminRaportow()) return alert('Brak uprawnień!');
    const progi = {};
    for (const p of RAPORTY_PALIWA) {
        const surowa = String(document.getElementById(`raport-prog-${p.klucz}`)?.value || '').trim();
        const wartosc = Number(surowa);
        if (surowa === '' || !Number.isFinite(wartosc) || wartosc < 0) {
            return alert(`Podaj poprawną wartość minimalną dla ${p.etykieta}.`);
        }
        progi[p.klucz] = Math.round(wartosc);
    }
    try {
        await setDoc(doc(db, 'system_ustawienia', RAPORTY_PROGI_DOK), {
            ...progi,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        progiPaliwRaportu = progi;
        alert('Progi paliw zostały zapisane!');
        await window.zaladujRaporty();
    } catch (e) { alert('Błąd zapisu progów: ' + e.message); }
};

/* ===== Tabela paliw w modalu ===== */

function renderujWierszePaliw() {
    const kontener = document.getElementById('raport-paliwa-wiersze');
    if (!kontener) return;
    kontener.innerHTML = RAPORTY_PALIWA.map(p => `
        <tr class="raport-wiersz" id="raport-paliwo-wiersz-${p.klucz}">
            <td style="text-align:left;">${ucieczkaHtml(p.etykieta)}</td>
            <td><span id="raport-min-${p.klucz}">${ucieczkaHtml(String(progiPaliwRaportu[p.klucz]))}</span> L</td>
            <td>
                <input type="checkbox" id="raport-paliwo-${p.klucz}" onchange="window.odswiezRaportPaliwa()">
            </td>
        </tr>`).join('');
}

window.odswiezRaportPaliwa = function() {
    let wszystkie = true;
    RAPORTY_PALIWA.forEach(p => {
        const zaznaczone = !!document.getElementById(`raport-paliwo-${p.klucz}`)?.checked;
        if (!zaznaczone) wszystkie = false;
        const wiersz = document.getElementById(`raport-paliwo-wiersz-${p.klucz}`);
        if (wiersz) {
            wiersz.classList.toggle('raport-ok', zaznaczone);
            wiersz.classList.toggle('raport-blad', !zaznaczone);
        }
    });
    const sekcja = document.getElementById('raport-sekcja-paliwa');
    if (sekcja) {
        sekcja.classList.toggle('raport-ok', wszystkie);
        sekcja.classList.toggle('raport-blad', !wszystkie);
    }
    const komunikat = document.getElementById('raport-stockout-msg');
    if (komunikat) komunikat.classList.toggle('hidden', wszystkie);
};

/* ===== Liczniki w modalu ===== */

function renderujWierszeLicznikow() {
    const kontener = document.getElementById('raport-liczniki-wiersze');
    if (!kontener) return;
    kontener.innerHTML = RAPORTY_LICZNIKI.map(l => `
        <div class="raport-wiersz" id="raport-wiersz-${l.klucz}"
             style="display:grid; grid-template-columns: 1fr auto 120px; gap:10px; align-items:center; padding:8px; border-bottom:1px solid var(--border-color);">
            <strong>${ucieczkaHtml(l.etykieta)}</strong>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin:0;">
                <input type="checkbox" id="raport-${l.klucz}-zgodne" onchange="window.odswierzLicznikRaportu('${l.klucz}')">
                <span>Zgodne</span>
            </label>
            <input type="number" step="1" id="raport-${l.klucz}-roznica" placeholder="różnica +/-" style="margin:0;">
        </div>`).join('');
}

window.odswierzLicznikRaportu = function(klucz, zachowajWartosc = false) {
    const pole = document.getElementById(`raport-${klucz}-zgodne`);
    const roznica = document.getElementById(`raport-${klucz}-roznica`);
    const wiersz = document.getElementById(`raport-wiersz-${klucz}`);
    if (!pole || !roznica || !wiersz) return;

    if (pole.checked) {
        roznica.value = '0';
        roznica.disabled = true;
        wiersz.classList.remove('raport-blad');
        wiersz.classList.add('raport-ok');
    } else {
        roznica.disabled = false;
        if (!zachowajWartosc && roznica.value === '0') roznica.value = '';
        wiersz.classList.remove('raport-ok');
        wiersz.classList.add('raport-blad');
    }
};

/* ===== Modal raportu ===== */

window.zamknijModalRaportu = function() {
    document.getElementById('modal-raport').classList.add('hidden');
};

window.otworzModalRaportu = async function(data = null, tylkoPodglad = false) {
    const dataRaportu = data || dzisiejszaDataRaportu();
    if (!dataRaportu) return alert('Nie udało się ustalić daty raportu.');
    if (!tylkoPodglad && !czyAdminRaportow() && dataRaportu !== dzisiejszaDataRaportu()) {
        return alert('Pracownik może wypełniać tylko raport na bieżący dzień.');
    }

    raportTylkoPodglad = !!tylkoPodglad;
    progiPaliwRaportu = await pobierzProgiPaliwRaportow();
    renderujWierszePaliw();
    renderujWierszeLicznikow();

    document.getElementById('raport-data').value = dataRaportu;
    document.getElementById('modal-raport-tytul').innerText = tylkoPodglad
        ? `📄 Podgląd raportu z dnia ${formatujDateDoWyswietlenia(dataRaportu)}`
        : `📝 Raport operacyjny — ${formatujDateDoWyswietlenia(dataRaportu)}`;

    const info = document.getElementById('raport-tryb-info');
    if (tylkoPodglad) {
        info.innerText = 'Tryb podglądu — dane są tylko do odczytu.';
        info.classList.remove('hidden');
    } else {
        info.innerText = '';
        info.classList.add('hidden');
    }

    try {
        const snap = await getDoc(doc(db, RAPORTY_OPERACYJNE_KOLEKCJA, dataRaportu));
        const dane = snap.exists() ? snap.data() : {};
        const paliwa = dane.paliwa || {};

        const stareStanOk = !!paliwa.stanOk;
        RAPORTY_PALIWA.forEach(p => {
            const zapisane = paliwa[p.klucz];
            document.getElementById(`raport-paliwo-${p.klucz}`).checked =
                zapisane === undefined ? stareStanOk : !!zapisane;
        });
        document.getElementById('raport-paliwo-dostawa').checked = !!paliwa.dostawa;
        window.odswiezRaportPaliwa();

        RAPORTY_LICZNIKI.forEach(l => {
            const zapis = (dane.liczniki && dane.liczniki[l.klucz]) || {};
            document.getElementById(`raport-${l.klucz}-zgodne`).checked = !!zapis.zgodne;
            document.getElementById(`raport-${l.klucz}-roznica`).value = zapis.roznica ?? '';
            window.odswierzLicznikRaportu(l.klucz, true);
        });
    } catch (e) {
        alert('Błąd wczytania raportu: ' + e.message);
        return;
    }

    const modal = document.getElementById('modal-raport');
    modal.querySelectorAll('input').forEach(wejscie => { wejscie.disabled = tylkoPodglad; });
    document.getElementById('raport-btn-zapisz').classList.toggle('hidden', tylkoPodglad);
    modal.classList.remove('hidden');
};

window.zapiszRaport = async function() {
    if (raportTylkoPodglad) return;
    const data = document.getElementById('raport-data').value;
    if (!data) return alert('Brak daty raportu.');

    const paliwa = {};
    RAPORTY_PALIWA.forEach(p => {
        paliwa[p.klucz] = !!document.getElementById(`raport-paliwo-${p.klucz}`).checked;
    });
    paliwa.dostawa = !!document.getElementById('raport-paliwo-dostawa').checked;

    const liczniki = {};
    for (const l of RAPORTY_LICZNIKI) {
        const zgodne = document.getElementById(`raport-${l.klucz}-zgodne`).checked;
        const surowa = String(document.getElementById(`raport-${l.klucz}-roznica`).value || '').trim();
        let roznica = 0;
        if (zgodne) {
            roznica = 0;
        } else {
            if (surowa === '' || !Number.isFinite(Number(surowa))) {
                return alert(`Podaj różnicę (liczbę ze znakiem) dla: ${l.etykieta}.`);
            }
            roznica = Number(surowa);
        }
        liczniki[l.klucz] = { zgodne, roznica };
    }

    try {
        const istniejacy = await getDoc(doc(db, RAPORTY_OPERACYJNE_KOLEKCJA, data));
        const teraz = new Date().toISOString();
        await setDoc(doc(db, RAPORTY_OPERACYJNE_KOLEKCJA, data), {
            data,
            osobaId: uidPracownikaRaportu(),
            osoba: currentUserData ? currentUserData.imie : '',
            paliwa,
            liczniki,
            createdAt: (istniejacy.exists() && istniejacy.data().createdAt) || teraz,
            updatedAt: teraz
        }, { merge: true });

        window.zamknijModalRaportu();
        window.sprawdzBadgeRaportu();
        await window.zaladujRaporty();
        alert('Raport został zapisany!');
    } catch (e) { alert('Błąd zapisu raportu: ' + e.message); }
};

/* ===== Zakresy statystyk ===== */

window.odswiezZakresStatystykRaportow = function() {
    const wybor = document.getElementById('raporty-stat-zakres')?.value;
    const pole = document.getElementById('raporty-stat-custom-box');
    if (pole) pole.classList.toggle('hidden', wybor !== 'custom');
    window.zaladujRaporty();
};

function dataGranicznaStatystyk() {
    const wybor = document.getElementById('raporty-stat-zakres')?.value || 'current-month';
    const dzis = new Date();
    if (wybor === 'custom') {
        return document.getElementById('raporty-stat-custom-date')?.value || formatujDateLokalna(dzis);
    }
    if (wybor === 'previous-month') {
        return formatujDateLokalna(new Date(dzis.getFullYear(), dzis.getMonth() - 1, 1));
    }
    if (wybor === 'current-quarter') {
        const pierwszyMiesiacKwartalu = Math.floor(dzis.getMonth() / 3) * 3;
        return formatujDateLokalna(new Date(dzis.getFullYear(), pierwszyMiesiacKwartalu, 1));
    }
    return formatujDateLokalna(new Date(dzis.getFullYear(), dzis.getMonth(), 1));
}

function statystykiLicznikow(raporty) {
    return RAPORTY_LICZNIKI.map(l => {
        const wartosci = raporty
            .map(r => r.liczniki && r.liczniki[l.klucz] && r.liczniki[l.klucz].roznica)
            .filter(v => v !== null && v !== undefined && Number.isFinite(Number(v)))
            .map(Number);
        if (wartosci.length === 0) return { ...l, srednia: 0, min: 0, max: 0, liczba: 0 };
        const suma = wartosci.reduce((a, b) => a + b, 0);
        return {
            ...l,
            srednia: suma / wartosci.length,
            min: Math.min(...wartosci),
            max: Math.max(...wartosci),
            liczba: wartosci.length
        };
    });
}

/* ===== Czyszczenie danych raportów ===== */

window.odswiezZakresCzyszczeniaRaportow = function() {
    const wybor = document.getElementById('raporty-cleanup-zakres')?.value;
    const pole = document.getElementById('raporty-cleanup-custom-box');
    if (pole) pole.classList.toggle('hidden', wybor !== 'custom');
};

window.usunDaneRaportow = async function() {
    if (!czyAdminRaportow()) return alert('Brak uprawnień!');
    const wybor = document.getElementById('raporty-cleanup-zakres')?.value;
    let granica;
    if (wybor === 'custom') {
        granica = document.getElementById('raporty-cleanup-custom-date')?.value;
        if (!granica) return alert('Wybierz poprawną datę graniczną!');
    } else {
        const miesiace = parseInt(wybor, 10);
        if (!Number.isFinite(miesiace) || miesiace <= 0) return alert('Wybierz poprawny zakres czyszczenia.');
        const dzis = new Date();
        granica = formatujDateLokalna(new Date(dzis.getFullYear(), dzis.getMonth() - miesiace, dzis.getDate()));
    }

    if (!confirm(`⚠️ OSTRZEŻENIE: Zamierzasz trwale usunąć raporty starsze niż ${formatujDateDoWyswietlenia(granica)}.\nKontynuować?`)) return;
    if (!confirm('🔴 DRUGIE POTWIERDZENIE: Tej operacji NIE DA SIĘ cofnąć. Kliknij OK, aby wykonać usunięcie.')) return;

    try {
        const snap = await getDocs(collection(db, RAPORTY_OPERACYJNE_KOLEKCJA));
        let usunieto = 0;
        for (const d of snap.docs) {
            if (d.id && d.id < granica) {
                await deleteDoc(doc(db, RAPORTY_OPERACYJNE_KOLEKCJA, d.id));
                usunieto++;
            }
        }
        await window.zaladujRaporty();
        window.sprawdzBadgeRaportu();
        alert(`Usunięto ${usunieto} raportów.`);
    } catch (e) { alert('Błąd podczas usuwania danych: ' + e.message); }
};

/* ===== Widok modułu ===== */

window.zaladujRaporty = async function() {
    const admin = czyAdminRaportow();
    const panel = document.getElementById('raporty-admin-panel');
    if (panel) panel.classList.toggle('hidden', !admin);
    const info = document.getElementById('raporty-info');
    if (info) {
        info.innerHTML = admin
            ? ''
            : '<p class="text-muted">Raport operacyjny wypełniasz raz dziennie na zakończenie zmiany.</p>';
    }
    if (!admin) return;

    progiPaliwRaportu = await pobierzProgiPaliwRaportow();
    wypelnijPolaProgow(progiPaliwRaportu);

    try {
        const snap = await getDocs(collection(db, RAPORTY_OPERACYJNE_KOLEKCJA));
        const raporty = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.id.localeCompare(a.id));

        const granica = dataGranicznaStatystyk();
        const dzisStr = dzisiejszaDataRaportu();
        const doStatystyk = raporty.filter(r => r.id >= granica && r.id <= dzisStr);
        const stats = statystykiLicznikow(doStatystyk);
        const opisZakresu = document.getElementById('raporty-stat-zakres')?.selectedOptions?.[0]?.text || '';
        const statHtml = `<p class="text-muted">Zakres: ${ucieczkaHtml(opisZakresu)} (od ${ucieczkaHtml(formatujDateDoWyswietlenia(granica))})</p>
            <div class="table-responsive"><table class="standard-table">
                <tr><th>Licznik</th><th>Średnia różnica</th><th>Min</th><th>Max</th><th>Liczba raportów</th></tr>
                ${stats.map(s => `<tr>
                    <td style="text-align:left;">${ucieczkaHtml(s.etykieta)}</td>
                    <td>${s.srednia.toFixed(2)}</td>
                    <td>${s.min}</td>
                    <td>${s.max}</td>
                    <td>${s.liczba}</td>
                </tr>`).join('')}
            </table></div>`;
        const statContainer = document.getElementById('raporty-statystyki');
        if (statContainer) statContainer.innerHTML = statHtml;

        const historia = document.getElementById('raporty-historia');
        if (historia) {
            if (raporty.length === 0) {
                historia.innerHTML = '<p class="text-muted">Brak zapisanych raportów.</p>';
            } else {
                historia.innerHTML = `<div class="table-responsive"><table class="standard-table">
                    <tr><th>Data</th><th>Osoba</th><th>Paliwa</th><th>Liczniki</th><th>Podgląd</th></tr>
                    ${raporty.map(r => {
                        const p = r.paliwa || {};
                        const nieok = RAPORTY_PALIWA.filter(x => {
                            const zapisane = p[x.klucz];
                            return zapisane === undefined ? !p.stanOk : !zapisane;
                        }).map(x => x.etykieta);
                        const paliwaOpis = nieok.length === 0 ? 'OK' : 'STOCKOUT: ' + nieok.join(', ');
                        const licznikiOpis = RAPORTY_LICZNIKI.map(l => {
                            const v = r.liczniki && r.liczniki[l.klucz];
                            const wartosc = v ? (v.zgodne ? 'OK' : String(v.roznica ?? '')) : '—';
                            return `${l.etykieta}: ${wartosc}`;
                        }).join(' | ');
                        return `<tr>
                            <td>${ucieczkaHtml(formatujDateDoWyswietlenia(r.id))}</td>
                            <td>${ucieczkaHtml(r.osoba || '—')}</td>
                            <td>${ucieczkaHtml(paliwaOpis)}</td>
                            <td style="text-align:left;">${ucieczkaHtml(licznikiOpis)}</td>
                            <td><button onclick="window.otworzModalRaportu('${ucieczkaHtml(ucieczkaJs(r.id))}', true)" class="btn-info btn-sm" style="margin:0;">👁️</button></td>
                        </tr>`;
                    }).join('')}
                </table></div>`;
            }
        }
    } catch (e) {
        const statContainer = document.getElementById('raporty-statystyki');
        if (statContainer) statContainer.innerHTML = `<span class="error">Błąd ładowania statystyk: ${ucieczkaHtml(e.message)}</span>`;
    }
};

renderujWierszePaliw();
renderujWierszeLicznikow();
