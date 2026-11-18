'use strict';
// Moduł Raporty operacyjne (paliwa, liczniki, historia i statystyki dla admina).

const RAPORTY_OPERACYJNE_KOLEKCJA = 'raporty_operacyjne';
const RAPORTY_LICZNIKI = [
    { klucz: 'kawaDuza', etykieta: 'Kawa duża' },
    { klucz: 'kawaMala', etykieta: 'Kawa mała' },
    { klucz: 'odkurzacz', etykieta: 'Odkurzacz' }
];
let raportTylkoPodglad = false;
let aktualnyRaportUpdatedAt = null;

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

/* Badge „!" na kafelku Raporty — tylko gdy pracownik jest dziś na zmianie
   i nie ma jeszcze raportu na bieżący dzień. */
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

window.odswiezRaportPaliwa = function() {
    const stan = document.getElementById('raport-paliwo-stan-ok')?.checked;
    const dostawa = document.getElementById('raport-paliwo-dostawa')?.checked;
    const dobrze = !!(stan || dostawa);
    const sekcja = document.getElementById('raport-sekcja-paliwa');
    if (sekcja) {
        sekcja.classList.toggle('raport-ok', dobrze);
        sekcja.classList.toggle('raport-blad', !dobrze);
    }
    const komunikat = document.getElementById('raport-stockout-msg');
    if (komunikat) komunikat.classList.toggle('hidden', dobrze);
};

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
        aktualnyRaportUpdatedAt = dane.updatedAt || null;

        document.getElementById('raport-paliwo-stan-ok').checked = !!(dane.paliwa && dane.paliwa.stanOk);
        document.getElementById('raport-paliwo-dostawa').checked = !!(dane.paliwa && dane.paliwa.dostawa);
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
            paliwa: {
                stanOk: document.getElementById('raport-paliwo-stan-ok').checked,
                dostawa: document.getElementById('raport-paliwo-dostawa').checked
            },
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

    try {
        const snap = await getDocs(collection(db, RAPORTY_OPERACYJNE_KOLEKCJA));
        const raporty = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.id.localeCompare(a.id));

        const stats = statystykiLicznikow(raporty);
        const statHtml = `<div class="table-responsive"><table class="standard-table">
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
                        const paliwaOpis = p.stanOk || p.dostawa ? 'OK' : 'STOCKOUT';
                        const licznikiOpis = RAPORTY_LICZNIKI.map(l => {
                            const v = r.liczniki && r.liczniki[l.klucz];
                            return v ? `${l.etykieta}: ${v.zgodne ? 'zgodne' : v.roznica}` : '';
                        }).filter(Boolean).join(' | ');
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

renderujWierszeLicznikow();
