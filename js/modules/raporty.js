'use strict';
// Moduł Raporty operacyjne — paliwa i liczniki jako osobne dokumenty.

const RAPORTY_PALIWA_KOLEKCJA = 'raporty_paliwa';
const RAPORTY_LICZNIKI_KOLEKCJA = 'raporty_liczniki';
const RAPORTY_STARE_KOLEKCJA = 'raporty_operacyjne'; // zgodność wsteczna
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

function dzisiejszaDataRaportu() { return pobierzDzisiejszaDateStr(); }
function czyAdminRaportow() { return !!(currentUserData && currentUserData.rola === 'admin'); }
function uidPracownikaRaportu() { return currentUserData ? String(pobierzIdPracownika(currentUserData)) : ''; }

async function czyPracownikMaZmianeWymaganaRaportu(uid, data) {
    const [rok, miesiac, dzien] = data.split('-').map(Number);
    const snap = await getDoc(doc(db, 'grafiki', `${rok}-${String(miesiac).padStart(2, '0')}`));
    if (!snap.exists()) return false;
    const grafik = snap.data();
    const dzi = new Date(rok, miesiac - 1, dzien).getDay();
    const swieto = !!(grafik.holidays && grafik.holidays[String(dzien)]);
    const zmiana = (dzi === 0 || swieto) ? 'rano' : 'zamkniecie';
    const c = grafik.entries && grafik.entries[`${uid}_${dzien}_${zmiana}`];
    return !!(c && c.type === 'praca' && (Number(c.hours) || 0) > 0);
}

async function pobierzDokument(kolekcja, data) {
    const snap = await getDoc(doc(db, kolekcja, data));
    return snap.exists() ? snap.data() : null;
}

async function pobierzWszystkieRaporty() {
    const [paliwaSnap, licznikiSnap, stareSnap] = await Promise.all([
        getDocs(collection(db, RAPORTY_PALIWA_KOLEKCJA)),
        getDocs(collection(db, RAPORTY_LICZNIKI_KOLEKCJA)),
        getDocs(collection(db, RAPORTY_STARE_KOLEKCJA)).catch(() => ({ docs: [] }))
    ]);
    const mapa = {};
    const wiersz = (id) => {
        if (!mapa[id]) mapa[id] = { id, paliwa: null, liczniki: null, osoba: '', osobaId: '', updatedAt: '' };
        return mapa[id];
    };

    stareSnap.forEach(d => {
        const r = d.data() || {};
        const w = wiersz(d.id);
        if (!w.paliwa && r.paliwa) w.paliwa = r.paliwa;
        if (!w.liczniki && r.liczniki) w.liczniki = r.liczniki;
        if (!w.osoba) { w.osoba = r.osoba || ''; w.osobaId = r.osobaId || ''; }
        if (!w.updatedAt) w.updatedAt = r.updatedAt || '';
    });
    paliwaSnap.forEach(d => {
        const r = d.data() || {};
        const w = wiersz(d.id);
        w.paliwa = r.paliwa || r;
        w.osoba = r.osoba || w.osoba;
        w.osobaId = r.osobaId || w.osobaId;
        w.updatedAt = r.updatedAt || w.updatedAt;
    });
    licznikiSnap.forEach(d => {
        const r = d.data() || {};
        const w = wiersz(d.id);
        w.liczniki = r.liczniki || r;
        w.osoba = r.osoba || w.osoba;
        w.osobaId = r.osobaId || w.osobaId;
        w.updatedAt = r.updatedAt || w.updatedAt;
    });
    return Object.values(mapa).sort((a, b) => b.id.localeCompare(a.id));
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
        const [p, l] = await Promise.all([
            pobierzDokument(RAPORTY_PALIWA_KOLEKCJA, dzis),
            pobierzDokument(RAPORTY_LICZNIKI_KOLEKCJA, dzis)
        ]);
        badge.classList.toggle('hidden', !!(p && l));
    } catch (e) { ukryj(); }
};

/* ===== Progi paliw (tylko admin) ===== */
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
        if (surowa === '' || !Number.isFinite(wartosc) || wartosc < 0) return alert(`Podaj poprawną wartość minimalną dla ${p.etykieta}.`);
        progi[p.klucz] = Math.round(wartosc);
    }
    try {
        await setDoc(doc(db, 'system_ustawienia', RAPORTY_PROGI_DOK), { ...progi, updatedAt: new Date().toISOString() }, { merge: true });
        progiPaliwRaportu = progi;
        alert('Progi paliw zostały zapisane!');
        await window.zaladujRaporty();
    } catch (e) { alert('Błąd zapisu progów: ' + e.message); }
};

/* ===== Tabela paliw ===== */
function renderujWierszePaliw() {
    const kontener = document.getElementById('raport-paliwa-wiersze');
    if (!kontener) return;
    kontener.innerHTML = RAPORTY_PALIWA.map(p => `
        <tr class="raport-wiersz" id="raport-paliwo-wiersz-${p.klucz}">
            <td style="text-align:left;">${ucieczkaHtml(p.etykieta)}</td>
            <td><span id="raport-min-${p.klucz}">${ucieczkaHtml(String(progiPaliwRaportu[p.klucz]))}</span> L
                <input type="checkbox" id="raport-paliwo-${p.klucz}" onchange="window.odswiezRaportPaliwa()" title="Stan OK" style="margin-left:6px;">
            </td>
            <td><input type="checkbox" id="raport-paliwo-${p.klucz}-dostawa" onchange="window.odswiezRaportPaliwa()" title="Dostawa"></td>
        </tr>`).join('');
}

function normalizujPaliwoRaportu(zapis, dostawaGlobalna, stareStanOk) {
    if (zapis && typeof zapis === 'object') return { stanOk: !!zapis.stanOk, dostawa: !!zapis.dostawa };
    if (typeof zapis === 'boolean') return { stanOk: zapis, dostawa: !!dostawaGlobalna };
    return { stanOk: !!stareStanOk, dostawa: !!dostawaGlobalna };
}

window.odswiezRaportPaliwa = function() {
    const ryzyko = [];
    RAPORTY_PALIWA.forEach(p => {
        const stanOk = !!document.getElementById(`raport-paliwo-${p.klucz}`)?.checked;
        const dostawa = !!document.getElementById(`raport-paliwo-${p.klucz}-dostawa`)?.checked;
        const dobrze = stanOk || dostawa;
        if (!dobrze) ryzyko.push(p.etykieta);
        const wiersz = document.getElementById(`raport-paliwo-wiersz-${p.klucz}`);
        if (wiersz) {
            wiersz.classList.toggle('raport-ok', dobrze);
            wiersz.classList.toggle('raport-blad', !dobrze);
        }
    });
    const sekcja = document.getElementById('raport-sekcja-paliwa');
    if (sekcja) {
        sekcja.classList.toggle('raport-ok', ryzyko.length === 0);
        sekcja.classList.toggle('raport-blad', ryzyko.length > 0);
    }
    const komunikat = document.getElementById('raport-stockout-msg');
    if (komunikat) {
        komunikat.innerText = ryzyko.length ? `Zgłoś ryzyko StockOut: ${ryzyko.join(', ')}` : '';
        komunikat.classList.toggle('hidden', ryzyko.length === 0);
    }
};

/* ===== Liczniki ===== */
function renderujWierszeLicznikow() {
    const kontener = document.getElementById('raport-liczniki-wiersze');
    if (!kontener) return;
    kontener.innerHTML = RAPORTY_LICZNIKI.map(l => `
        <div class="raport-wiersz" id="raport-wiersz-${l.klucz}"
             style="display:grid; grid-template-columns:1fr auto 120px; gap:10px; align-items:center; padding:8px; border-bottom:1px solid var(--border-color);">
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
        roznica.value = '0'; roznica.disabled = true;
        wiersz.classList.remove('raport-blad'); wiersz.classList.add('raport-ok');
    } else {
        roznica.disabled = false;
        if (!zachowajWartosc && roznica.value === '0') roznica.value = '';
        wiersz.classList.remove('raport-ok'); wiersz.classList.add('raport-blad');
    }
};

/* ===== Modal ===== */
window.zamknijModalRaportu = function() { document.getElementById('modal-raport').classList.add('hidden'); };

window.otworzModalRaportu = async function(data = null, tylkoPodglad = false, sekcja = 'paliwa') {
    const dataRaportu = data || dzisiejszaDataRaportu();
    if (!dataRaportu) return alert('Nie udało się ustalić daty raportu.');
    if (!tylkoPodglad && !czyAdminRaportow() && dataRaportu !== dzisiejszaDataRaportu()) {
        return alert('Pracownik może wypełniać tylko raport na bieżący dzień.');
    }

    raportTylkoPodglad = !!tylkoPodglad;
    progiPaliwRaportu = await pobierzProgiPaliwRaportow();
    renderujWierszePaliw();
    renderujWierszeLicznikow();

    const trybSekcji = sekcja === 'liczniki' ? 'liczniki' : (sekcja === 'paliwa' ? 'paliwa' : 'oba');
    const opisSekcji = trybSekcji === 'oba' ? '' : (trybSekcji === 'paliwa' ? ' — Paliwa' : ' — Liczniki');
    document.getElementById('raport-data').value = dataRaportu;
    document.getElementById('modal-raport-tytul').innerText = tylkoPodglad
        ? `📄 Podgląd raportów z dnia ${formatujDateDoWyswietlenia(dataRaportu)}`
        : `📝 Raporty operacyjne${opisSekcji} — ${formatujDateDoWyswietlenia(dataRaportu)}`;

    const info = document.getElementById('raport-tryb-info');
    info.innerText = tylkoPodglad ? 'Tryb podglądu — dane są tylko do odczytu.' : '';
    info.classList.toggle('hidden', !tylkoPodglad);

    try {
        const [pDoc, lDoc, stary] = await Promise.all([
            pobierzDokument(RAPORTY_PALIWA_KOLEKCJA, dataRaportu),
            pobierzDokument(RAPORTY_LICZNIKI_KOLEKCJA, dataRaportu),
            pobierzDokument(RAPORTY_STARE_KOLEKCJA, dataRaportu)
        ]);
        const p = (pDoc && (pDoc.paliwa || pDoc)) || (stary && stary.paliwa) || {};
        const l = (lDoc && (lDoc.liczniki || lDoc)) || (stary && stary.liczniki) || {};

        const stareStanOk = !!p.stanOk;
        RAPORTY_PALIWA.forEach(x => {
            const norm = normalizujPaliwoRaportu(p[x.klucz], p.dostawa, stareStanOk);
            document.getElementById(`raport-paliwo-${x.klucz}`).checked = norm.stanOk;
            document.getElementById(`raport-paliwo-${x.klucz}-dostawa`).checked = norm.dostawa;
        });
        window.odswiezRaportPaliwa();

        RAPORTY_LICZNIKI.forEach(x => {
            const zapis = l[x.klucz] || {};
            document.getElementById(`raport-${x.klucz}-zgodne`).checked = !!zapis.zgodne;
            document.getElementById(`raport-${x.klucz}-roznica`).value = zapis.roznica ?? '';
            window.odswierzLicznikRaportu(x.klucz, true);
        });
    } catch (e) { alert('Błąd wczytania raportów: ' + e.message); return; }

    const modal = document.getElementById('modal-raport');
    modal.querySelectorAll('input').forEach(i => { i.disabled = tylkoPodglad; });

    // W trybie wypełniania pokazujemy tylko wybraną sekcję.
    document.getElementById('raport-sekcja-paliwa').classList.toggle('hidden', trybSekcji === 'liczniki');
    document.getElementById('raport-sekcja-liczniki').classList.toggle('hidden', trybSekcji === 'paliwa');
    document.getElementById('raport-btn-zapisz-paliwa').classList.toggle('hidden', jestPodgladem() || trybSekcji === 'liczniki');
    document.getElementById('raport-btn-zapisz-liczniki').classList.toggle('hidden', jestPodgladem() || trybSekcji === 'paliwa');

    const moznaZarzadzac = tylkoPodglad && czyAdminRaportow();
    document.getElementById('raport-btn-edytuj').classList.toggle('hidden', !moznaZarzadzac);
    document.getElementById('raport-btn-usun').classList.toggle('hidden', !moznaZarzadzac);
    modal.classList.remove('hidden');
};

function jestPodgladem() { return !!raportTylkoPodglad; }

function daneNaglowka() {
    return {
        osobaId: uidPracownikaRaportu(),
        osoba: currentUserData ? currentUserData.imie : ''
    };
}

window.zapiszRaportPaliw = async function() {
    if (raportTylkoPodglad) return;
    const data = document.getElementById('raport-data').value;
    if (!data) return alert('Brak daty raportu.');
    const paliwa = {};
    RAPORTY_PALIWA.forEach(p => {
        paliwa[p.klucz] = {
            stanOk: !!document.getElementById(`raport-paliwo-${p.klucz}`).checked,
            dostawa: !!document.getElementById(`raport-paliwo-${p.klucz}-dostawa`).checked
        };
    });
    try {
        const istniejacy = await pobierzDokument(RAPORTY_PALIWA_KOLEKCJA, data);
        const teraz = new Date().toISOString();
        await setDoc(doc(db, RAPORTY_PALIWA_KOLEKCJA, data), {
            data, ...daneNaglowka(), paliwa,
            createdAt: (istniejacy && istniejacy.createdAt) || teraz,
            updatedAt: teraz
        }, { merge: true });
        alert('Raport paliw został zapisany!');
        window.zamknijModalRaportu();
        window.sprawdzBadgeRaportu();
        await window.zaladujRaporty();
    } catch (e) { alert('Błąd zapisu paliw: ' + e.message); }
};

window.zapiszRaportLicznikow = async function() {
    if (raportTylkoPodglad) return;
    const data = document.getElementById('raport-data').value;
    if (!data) return alert('Brak daty raportu.');
    const liczniki = {};
    for (const l of RAPORTY_LICZNIKI) {
        const zgodne = document.getElementById(`raport-${l.klucz}-zgodne`).checked;
        const surowa = String(document.getElementById(`raport-${l.klucz}-roznica`).value || '').trim();
        let roznica = 0;
        if (!zgodne) {
            if (surowa === '' || !Number.isFinite(Number(surowa))) return alert(`Podaj różnicę dla: ${l.etykieta}.`);
            roznica = Number(surowa);
        }
        liczniki[l.klucz] = { zgodne, roznica };
    }
    try {
        const istniejacy = await pobierzDokument(RAPORTY_LICZNIKI_KOLEKCJA, data);
        const teraz = new Date().toISOString();
        await setDoc(doc(db, RAPORTY_LICZNIKI_KOLEKCJA, data), {
            data, ...daneNaglowka(), liczniki,
            createdAt: (istniejacy && istniejacy.createdAt) || teraz,
            updatedAt: teraz
        }, { merge: true });
        alert('Raport liczników został zapisany!');
        window.zamknijModalRaportu();
        window.sprawdzBadgeRaportu();
        await window.zaladujRaporty();
    } catch (e) { alert('Błąd zapisu liczników: ' + e.message); }
};

window.edytujRaportZPodgladu = function() {
    const data = document.getElementById('raport-data').value;
    window.zamknijModalRaportu();
    window.otworzModalRaportu(data, false);
};

window.usunRaportZPodgladu = async function() {
    if (!czyAdminRaportow()) return alert('Brak uprawnień!');
    const data = document.getElementById('raport-data').value;
    if (!data) return;
    if (!confirm(`Usunąć oba raporty z dnia ${formatujDateDoWyswietlenia(data)}? Tej operacji nie da się cofnąć.`)) return;
    try {
        await Promise.all([
            deleteDoc(doc(db, RAPORTY_PALIWA_KOLEKCJA, data)),
            deleteDoc(doc(db, RAPORTY_LICZNIKI_KOLEKCJA, data)),
            deleteDoc(doc(db, RAPORTY_STARE_KOLEKCJA, data))
        ]);
        window.zamknijModalRaportu();
        await window.zaladujRaporty();
        window.sprawdzBadgeRaportu();
        alert('Raporty zostały usunięte.');
    } catch (e) { alert('Błąd usuwania raportów: ' + e.message); }
};

/* ===== Zakresy statystyk ===== */
window.odswiezZakresStatystykRaportow = function() {
    const wybor = document.getElementById('raporty-stat-zakres')?.value;
    document.getElementById('raporty-stat-custom-box')?.classList.toggle('hidden', wybor !== 'custom');
    window.zaladujRaporty();
};

function zakresStatystyk() {
    const dzis = new Date();
    const dzisStr = formatujDateLokalna(dzis);
    const pierwszyMiesiac = formatujDateLokalna(new Date(dzis.getFullYear(), dzis.getMonth(), 1));
    const wybor = document.getElementById('raporty-stat-zakres')?.value || 'current-month';
    if (wybor === 'custom') {
        const od = document.getElementById('raporty-stat-date-from')?.value || pierwszyMiesiac;
        const doDaty = document.getElementById('raporty-stat-date-to')?.value || dzisStr;
        return { od: od <= doDaty ? od : doDaty, do: od <= doDaty ? doDaty : od };
    }
    if (wybor === 'previous-month') {
        const start = new Date(dzis.getFullYear(), dzis.getMonth() - 1, 1);
        const koniec = new Date(dzis.getFullYear(), dzis.getMonth(), 0);
        return { od: formatujDateLokalna(start), do: formatujDateLokalna(koniec) };
    }
    if (wybor === 'current-quarter') {
        const start = new Date(dzis.getFullYear(), Math.floor(dzis.getMonth() / 3) * 3, 1);
        return { od: formatujDateLokalna(start), do: dzisStr };
    }
    return { od: pierwszyMiesiac, do: dzisStr };
}

function statystykiLicznikow(wiersze) {
    return RAPORTY_LICZNIKI.map(l => {
        const wartosci = wiersze
            .map(r => r.liczniki && r.liczniki[l.klucz] && r.liczniki[l.klucz].roznica)
            .filter(v => v !== null && v !== undefined && Number.isFinite(Number(v)))
            .map(Number);
        if (!wartosci.length) return { ...l, min: 0, max: 0, liczba: 0, suma: 0 };
        const suma = wartosci.reduce((a, b) => a + b, 0);
        return { ...l, min: Math.min(...wartosci), max: Math.max(...wartosci), liczba: wartosci.length, suma };
    });
}

/* ===== Czyszczenie danych ===== */
window.odswiezZakresCzyszczeniaRaportow = function() {
    const wybor = document.getElementById('raporty-cleanup-zakres')?.value;
    document.getElementById('raporty-cleanup-custom-box')?.classList.toggle('hidden', wybor !== 'custom');
};

window.usunDaneRaportow = async function() {
    if (!czyAdminRaportow()) return alert('Brak uprawnień!');
    const wybor = document.getElementById('raporty-cleanup-zakres')?.value;
    let granica;
    if (wybor === 'custom') {
        granica = document.getElementById('raporty-cleanup-custom-date')?.value;
        if (!granica) return alert('Wybierz datę graniczną!');
    } else {
        const miesiace = parseInt(wybor, 10);
        if (!Number.isFinite(miesiace) || miesiace <= 0) return alert('Wybierz poprawny zakres czyszczenia.');
        const d = new Date();
        granica = formatujDateLokalna(new Date(d.getFullYear(), d.getMonth() - miesiace, d.getDate()));
    }
    if (!confirm(`⚠️ Trwale usunąć raporty starsze niż ${formatujDateDoWyswietlenia(granica)}?`)) return;
    if (!confirm('🔴 DRUGIE POTWIERDZENIE: operacji nie da się cofnąć.')) return;
    try {
        let usunieto = 0;
        for (const kol of [RAPORTY_PALIWA_KOLEKCJA, RAPORTY_LICZNIKI_KOLEKCJA, RAPORTY_STARE_KOLEKCJA]) {
            const snap = await getDocs(collection(db, kol));
            for (const d of snap.docs) {
                if (d.id && d.id < granica) { await deleteDoc(doc(db, kol, d.id)); usunieto++; }
            }
        }
        await window.zaladujRaporty();
        window.sprawdzBadgeRaportu();
        alert(`Usunięto ${usunieto} dokumentów raportów.`);
    } catch (e) { alert('Błąd usuwania danych: ' + e.message); }
};

/* ===== Widok modułu ===== */
window.zaladujRaporty = async function() {
    const admin = czyAdminRaportow();
    document.getElementById('raporty-admin-panel')?.classList.toggle('hidden', !admin);
    const info = document.getElementById('raporty-info');
    if (info) info.innerHTML = admin ? '' : '<p class="text-muted">Raport paliw i liczników wypełniasz osobno, raz dziennie na zakończenie zmiany.</p>';

    if (admin) {
        progiPaliwRaportu = await pobierzProgiPaliwRaportow();
        wypelnijPolaProgow(progiPaliwRaportu);
    }

    try {
        const wiersze = await pobierzWszystkieRaporty();
        const zakres = zakresStatystyk();
        const doStatystyk = wiersze.filter(r => r.id >= zakres.od && r.id <= zakres.do && r.liczniki);
        const stats = statystykiLicznikow(doStatystyk);
        const opis = document.getElementById('raporty-stat-zakres')?.selectedOptions?.[0]?.text || '';
        const statContainer = document.getElementById('raporty-statystyki');
        if (statContainer) statContainer.innerHTML = `<p class="text-muted">Zakres: ${ucieczkaHtml(opis)} (od ${ucieczkaHtml(formatujDateDoWyswietlenia(zakres.od))} do ${ucieczkaHtml(formatujDateDoWyswietlenia(zakres.do))})</p>
            <div class="table-responsive"><table class="standard-table">
                <tr><th>Licznik</th><th>Liczba raportów</th><th>Min</th><th>Max</th><th>Total</th></tr>
                ${stats.map(s => `<tr><td style="text-align:left;">${ucieczkaHtml(s.etykieta)}</td><td>${s.liczba}</td><td>${s.min}</td><td>${s.max}</td><td><strong>${s.suma}</strong></td></tr>`).join('')}
            </table></div>`;

        const historia = document.getElementById('raporty-historia');
        if (historia) {
            if (!wiersze.length) {
                historia.innerHTML = '<p class="text-muted">Brak zapisanych raportów.</p>';
            } else {
                historia.innerHTML = `<div class="table-responsive"><table class="standard-table">
                    <tr><th>Data</th><th>Osoba</th><th>Paliwa</th><th>Liczniki</th></tr>
                    ${wiersze.map(r => {
                        let paliwaOpis = 'Brak';
                        if (r.paliwa) {
                            const p = r.paliwa;
                            const nieok = RAPORTY_PALIWA.filter(x => {
                                const norm = normalizujPaliwoRaportu(p[x.klucz], p.dostawa, p.stanOk);
                                return !(norm.stanOk || norm.dostawa);
                            }).map(x => x.etykieta);
                            paliwaOpis = nieok.length ? 'STOCKOUT: ' + nieok.join(', ') : 'OK';
                        }
                        let licznikiOpis = 'Brak';
                        if (r.liczniki) {
                            licznikiOpis = RAPORTY_LICZNIKI.map(l => {
                                const v = r.liczniki[l.klucz];
                                return `${l.etykieta}: ${v ? (v.zgodne ? 'OK' : String(v.roznica ?? '')) : '—'}`;
                            }).join(' | ');
                        }
                        return `<tr>
                            <td style="cursor:pointer; text-decoration:underline;"
                                onclick="window.otworzModalRaportu('${ucieczkaHtml(ucieczkaJs(r.id))}', true)"
                                title="Podgląd raportów">${ucieczkaHtml(formatujDateDoWyswietlenia(r.id))}</td>
                            <td>${ucieczkaHtml(r.osoba || '—')}</td>
                            <td>${ucieczkaHtml(paliwaOpis)}</td>
                            <td style="text-align:left;">${ucieczkaHtml(licznikiOpis)}</td>
                        </tr>`;
                    }).join('')}
                </table></div>`;
            }
        }
    } catch (e) {
        const statContainer = document.getElementById('raporty-statystyki');
        if (statContainer) statContainer.innerHTML = `<span class="error">Błąd ładowania raportów: ${ucieczkaHtml(e.message)}</span>`;
    }
};

renderujWierszePaliw();
renderujWierszeLicznikow();
