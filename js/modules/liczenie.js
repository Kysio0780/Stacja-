'use strict';
// Moduł Liczenie (kategorie towarowe, plusy/minusy, historia i sumy).

const DOMYSLNE_KATEGORIE_LICZENIA = [
    'Napoje', 'Piwo', 'Alkohole', 'Papierosy', 'Oleje',
    'Akcesoria', 'Farmacja', 'Słodycze', 'Chemia'
];
const LICZENIE_KATEGORIE_DOK = 'liczenie_kategorie';

// Kategorie są dostępne od razu — otwarcie modalu nie może zależeć od tego,
// czy udało się już pobrać dokument z Firestore.
let kategorieLiczenia = [...DOMYSLNE_KATEGORIE_LICZENIA];
let wynikiLiczenia = [];
let widoczneLiczenia = [];

function czyAdminLiczenia() {
    return !!(currentUserData && currentUserData.rola === 'admin');
}

function formatujLiczbeLiczenia(wartosc) {
    return new Intl.NumberFormat('pl-PL').format(Number(wartosc) || 0);
}

function pobierzLiczbeZLicznegoPola(id, nazwaPola) {
    const surowa = String(document.getElementById(id)?.value ?? '').trim();
    if (surowa === '') return 0;
    const liczba = Number(surowa);
    if (!Number.isFinite(liczba) || liczba < 0) {
        throw new Error(`Pole „${nazwaPola}” musi być liczbą nieujemną.`);
    }
    return Math.round(liczba);
}

function posortujLiczeniaMalejaco(liczenia) {
    return [...liczenia].sort((a, b) => {
        const dataA = String(a.data || '');
        const dataB = String(b.data || '');
        if (dataA !== dataB) return dataB.localeCompare(dataA);
        const czasA = String(a.updatedAt || a.createdAt || '');
        const czasB = String(b.updatedAt || b.createdAt || '');
        if (czasA !== czasB) return czasB.localeCompare(czasA);
        return String(a.kategoria || '').localeCompare(String(b.kategoria || ''), 'pl');
    });
}

async function pobierzKategorieLiczenia() {
    try {
        const ref = doc(db, 'system_ustawienia', LICZENIE_KATEGORIE_DOK);
        const snap = await getDoc(ref);
        if (snap.exists() && Array.isArray(snap.data().lista) && snap.data().lista.length > 0) {
            return [...snap.data().lista];
        }
        await setDoc(ref, { lista: [...DOMYSLNE_KATEGORIE_LICZENIA] });
    } catch (e) {
        console.warn('Nie udało się pobrać kategorii liczenia — używam listy domyślnej:', e);
    }
    return kategorieLiczenia.length > 0 ? [...kategorieLiczenia] : [...DOMYSLNE_KATEGORIE_LICZENIA];
}

async function zapiszKategorieLiczenia(lista) {
    await setDoc(doc(db, 'system_ustawienia', LICZENIE_KATEGORIE_DOK), { lista: [...lista] }, { merge: true });
}

function wyswietlKategorieLiczenia() {
    const kontener = document.getElementById('liczenie-kategorie-lista');
    if (!kontener) return;
    if (kategorieLiczenia.length === 0) {
        kontener.innerHTML = '<span class="text-muted">Brak kategorii — dodaj pierwszą powyżej.</span>';
        return;
    }
    kontener.innerHTML = kategorieLiczenia.map(k =>
        `<span class="badge badge-info" style="display:inline-flex; align-items:center; gap:6px; padding:5px 8px;">
            ${ucieczkaHtml(k)}
            <button type="button" onclick="window.usunKategorieLiczenia('${ucieczkaHtml(ucieczkaJs(k))}')"
                    class="btn-danger btn-sm" style="margin:0; padding:0 5px; line-height:1.2;"
                    title="Usuń kategorię">×</button>
        </span>`
    ).join('');
}

function wyswietlWynikiLiczenia() {
    const kontener = document.getElementById('liczenie-container');
    if (!kontener) return;

    let sumaPlus = 0;
    let sumaMinus = 0;
    let wiersze = '';

    widoczneLiczenia.forEach(w => {
        const plusy = Number(w.plusy) || 0;
        const minusy = Number(w.minusy) || 0;
        sumaPlus += plusy;
        sumaMinus += minusy;

        wiersze += `<tr>
            <td style="text-align:left; cursor:pointer;" onclick="window.otworzModalLiczenia('${ucieczkaHtml(ucieczkaJs(w.id))}')" title="Kliknij, aby otworzyć szczegóły">
                <strong>${ucieczkaHtml(w.kategoria || '—')}</strong>
            </td>
            <td>${ucieczkaHtml(formatujDateDoWyswietlenia(w.data) || '—')}</td>
            <td>${ucieczkaHtml(w.osoba || '—')}</td>
            <td>${formatujLiczbeLiczenia(plusy)}</td>
            <td>${formatujLiczbeLiczenia(minusy)}</td>
            <td><strong>${formatujLiczbeLiczenia(plusy - minusy)}</strong></td>
        </tr>`;
    });

    const sumaNetto = sumaPlus - sumaMinus;
    const stopka = `<tr class="sum-row">
        <td style="text-align:left;">SUMA</td>
        <td colspan="2"></td>
        <td>${formatujLiczbeLiczenia(sumaPlus)}</td>
        <td>${formatujLiczbeLiczenia(sumaMinus)}</td>
        <td><strong>${formatujLiczbeLiczenia(sumaNetto)}</strong></td>
    </tr>`;

    const pustyKomunikat = widoczneLiczenia.length === 0
        ? '<p class="text-muted">Brak zapisanych liczeń.</p>'
        : '';

    kontener.innerHTML = `${pustyKomunikat}
        <div class="table-responsive">
            <table class="standard-table">
                <thead><tr>
                    <th style="text-align:left;">Kategoria</th>
                    <th>Data</th>
                    <th>Osoba</th>
                    <th>Plusy</th>
                    <th>Minusy</th>
                    <th>Total</th>
                </tr></thead>
                <tbody>${wiersze}${stopka}</tbody>
            </table>
        </div>`;
}

window.zaladujLiczenie = async function() {
    const panelAdmina = document.getElementById('admin-liczenie-kategorie-panel');
    if (panelAdmina) panelAdmina.classList.toggle('hidden', !czyAdminLiczenia());

    // Kategorie i wyniki pobieramy osobno — błąd odczytu jednej kolekcji
    // nie może zablokować drugiej ani samego przycisku „Dodaj liczenie".
    kategorieLiczenia = await pobierzKategorieLiczenia();
    wyswietlKategorieLiczenia();

    try {
        const snap = await getDocs(collection(db, 'liczenie'));
        wynikiLiczenia = posortujLiczeniaMalejaco(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        console.warn('Nie udało się pobrać wyników liczenia:', e);
        wynikiLiczenia = [];
        const kontener = document.getElementById('liczenie-container');
        if (kontener) kontener.innerHTML = `<span class="error">Błąd ładowania wyników: ${ucieczkaHtml(e.message)}</span>`;
    }

    // Tabela pokazuje tylko najnowsze liczenie z każdej kategorii.
    widoczneLiczenia = [];
    const widzianeKategorie = new Set();
    wynikiLiczenia.forEach(w => {
        const klucz = String(w.kategoria || '');
        if (!widzianeKategorie.has(klucz)) {
            widzianeKategorie.add(klucz);
            widoczneLiczenia.push(w);
        }
    });
    wyswietlWynikiLiczenia();
};

window.dodajKategorieLiczenia = async function() {
    if (!czyAdminLiczenia()) return alert('Brak uprawnień!');
    const pole = document.getElementById('nowa-kategoria-liczenie');
    const nazwa = String(pole?.value || '').trim();
    if (!nazwa) return alert('Wpisz nazwę kategorii.');
    if (kategorieLiczenia.some(k => String(k).toLowerCase() === nazwa.toLowerCase())) {
        return alert('Taka kategoria już istnieje.');
    }
    try {
        await zapiszKategorieLiczenia([...kategorieLiczenia, nazwa]);
        pole.value = '';
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd zapisu kategorii: ' + e.message); }
};

window.usunKategorieLiczenia = async function(nazwa) {
    if (!czyAdminLiczenia()) return alert('Brak uprawnień!');
    if (!confirm(`Usunąć kategorię „${nazwa}”? Istniejące wyniki liczenia pozostaną w bazie.`)) return;
    try {
        await zapiszKategorieLiczenia(kategorieLiczenia.filter(k => k !== nazwa));
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd usuwania kategorii: ' + e.message); }
};

window.otworzModalLiczenia = async function(id = null) {
    const edycja = !!id;
    const admin = czyAdminLiczenia();
    const rekord = edycja ? wynikiLiczenia.find(w => w.id === id) : null;
    if (edycja && !rekord) return alert('Nie znaleziono tego liczenia.');
    if (kategorieLiczenia.length === 0) kategorieLiczenia = [...DOMYSLNE_KATEGORIE_LICZENIA];

    const moznaEdytowac = !edycja || admin;

    document.getElementById('modal-liczenie-tytul').innerText = edycja
        ? (moznaEdytowac ? 'Edytuj liczenie' : 'Liczenie – podgląd')
        : 'Nowe liczenie';
    document.getElementById('liczenie-id').value = id || '';

    const info = document.getElementById('liczenie-tryb-info');
    if (edycja && !moznaEdytowac) {
        info.innerText = 'Podgląd — edycja i usuwanie są dostępne tylko dla administratora.';
        info.classList.remove('hidden');
    } else {
        info.innerText = '';
        info.classList.add('hidden');
    }

    const selectKategorii = document.getElementById('liczenie-kategoria');
    selectKategorii.innerHTML = '<option value="">Wybierz kategorię</option>' +
        kategorieLiczenia.map(k => `<option value="${ucieczkaHtml(k)}">${ucieczkaHtml(k)}</option>`).join('');
    if (rekord?.kategoria && !kategorieLiczenia.includes(rekord.kategoria)) {
        selectKategorii.innerHTML += `<option value="${ucieczkaHtml(rekord.kategoria)}">${ucieczkaHtml(rekord.kategoria)} (usunięta z listy)</option>`;
    }
    selectKategorii.value = rekord?.kategoria || '';

    document.getElementById('liczenie-data').value = rekord?.data || pobierzDzisiejszaDateStr();
    document.getElementById('liczenie-plusy').value = rekord?.plusy ?? '';
    document.getElementById('liczenie-minusy').value = rekord?.minusy ?? '';

    const wybranaOsoba = rekord
        ? { id: rekord.osobaId, imie: rekord.osoba }
        : (currentUserData ? { id: currentUserData.uid, imie: currentUserData.imie } : null);

    const historia = document.getElementById('liczenie-historia');
    historia.classList.add('hidden');
    historia.innerHTML = '';

    // Modal pojawia się natychmiast — lista pracowników może się dograć później.
    document.getElementById('modal-liczenie').classList.remove('hidden');

    if (typeof wypelnijSelectPracownikow === 'function') {
        try { await wypelnijSelectPracownikow('liczenie-osoba', wybranaOsoba); }
        catch (e) { console.warn('Nie udało się pobrać listy pracowników:', e); }
    }

    const selectOsob = document.getElementById('liczenie-osoba');
    if (!selectOsob.value && rekord?.osoba) {
        const opcja = document.createElement('option');
        opcja.value = rekord.osobaId || rekord.osoba;
        opcja.textContent = `${rekord.osoba} (nie w bazie pracowników)`;
        opcja.dataset.imie = rekord.osoba;
        selectOsob.appendChild(opcja);
        selectOsob.value = opcja.value;
    }

    ['liczenie-kategoria', 'liczenie-data', 'liczenie-osoba', 'liczenie-plusy', 'liczenie-minusy']
        .forEach(poleId => { document.getElementById(poleId).disabled = !moznaEdytowac; });

    document.getElementById('liczenie-btn-zapisz').classList.toggle('hidden', !moznaEdytowac);
    document.getElementById('liczenie-btn-usun').classList.toggle('hidden', !(edycja && admin));
};

window.zamknijModalLiczenia = function() {
    document.getElementById('modal-liczenie').classList.add('hidden');
};

window.zapiszLiczenie = async function() {
    const id = document.getElementById('liczenie-id').value;
    if (id && !czyAdminLiczenia()) return alert('Brak uprawnień do edycji!');

    const kategoria = document.getElementById('liczenie-kategoria').value;
    const data = document.getElementById('liczenie-data').value;
    const selectOsob = document.getElementById('liczenie-osoba');
    const opcjaOsoby = selectOsob?.options?.[selectOsob.selectedIndex];
    const osoba = {
        id: selectOsob?.value || '',
        imie: opcjaOsoby?.dataset?.imie || opcjaOsoby?.textContent?.trim() || ''
    };
    if (!kategoria) return alert('Wybierz kategorię.');
    if (!data) return alert('Podaj datę.');
    if (!osoba.id) return alert('Wybierz osobę.');

    try {
        const teraz = new Date().toISOString();
        const stary = id ? wynikiLiczenia.find(w => w.id === id) : null;
        const dane = {
            kategoria,
            data,
            osoba: osoba.imie,
            osobaId: osoba.id,
            plusy: pobierzLiczbeZLicznegoPola('liczenie-plusy', 'Plusy'),
            minusy: pobierzLiczbeZLicznegoPola('liczenie-minusy', 'Minusy'),
            createdAt: stary?.createdAt || teraz,
            updatedAt: teraz
        };

        if (id) {
            // Bez merge, żeby usunąć stare pole „liczenia" z istniejących dokumentów.
            await setDoc(doc(db, 'liczenie', id), dane);
        } else {
            await addDoc(collection(db, 'liczenie'), dane);
        }
        window.zamknijModalLiczenia();
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd zapisu liczenia: ' + e.message); }
};

window.usunLiczenieZModalu = async function() {
    const id = document.getElementById('liczenie-id').value;
    if (!id) return;
    await window.usunLiczenie(id);
    window.zamknijModalLiczenia();
};

window.usunLiczenie = async function(id) {
    if (!czyAdminLiczenia()) return alert('Brak uprawnień!');
    if (!confirm('Usunąć ten wpis liczenia? Tej operacji nie da się cofnąć.')) return;
    try {
        await deleteDoc(doc(db, 'liczenie', id));
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd usuwania liczenia: ' + e.message); }
};

window.otworzHistorieLiczenia = function() {
    const kategoria = document.getElementById('liczenie-kategoria').value;
    if (!kategoria) return alert('Wybierz kategorię, aby zobaczyć historię.');
    const kontener = document.getElementById('liczenie-historia');
    if (!kontener.classList.contains('hidden')) {
        kontener.classList.add('hidden');
        return;
    }

    const aktualneId = document.getElementById('liczenie-id').value;
    const historia = wynikiLiczenia.filter(w => String(w.kategoria || '') === kategoria);

    if (historia.length === 0) {
        kontener.innerHTML = '<p class="text-muted">Brak wcześniejszych liczeń dla tej kategorii.</p>';
    } else {
        const wiersze = historia.map(w => {
            const plusy = Number(w.plusy) || 0;
            const minusy = Number(w.minusy) || 0;
            const oznaczenie = w.id === aktualneId ? ' <span class="badge badge-info">(aktualne)</span>' : '';
            return `<tr>
                <td>${ucieczkaHtml(formatujDateDoWyswietlenia(w.data) || '—')}${oznaczenie}</td>
                <td>${ucieczkaHtml(w.osoba || '—')}</td>
                <td>${formatujLiczbeLiczenia(plusy)}</td>
                <td>${formatujLiczbeLiczenia(minusy)}</td>
                <td><strong>${formatujLiczbeLiczenia(plusy - minusy)}</strong></td>
            </tr>`;
        }).join('');

        kontener.innerHTML = `<h5 style="margin: 0 0 8px 0;">Historia: ${ucieczkaHtml(kategoria)}</h5>
            <div class="table-responsive">
                <table class="standard-table">
                    <thead><tr><th>Data</th><th>Osoba</th><th>Plusy</th><th>Minusy</th><th>Total</th></tr></thead>
                    <tbody>${wiersze}</tbody>
                </table>
            </div>`;
    }
    kontener.classList.remove('hidden');
};
