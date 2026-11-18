'use strict';
// Moduł Liczenie (kategorie towarowe, stan faktyczny, plusy/minusy i sumy).

const DOMYSLNE_KATEGORIE_LICZENIA = [
    'Napoje', 'Piwo', 'Alkohole', 'Papierosy', 'Oleje',
    'Akcesoria', 'Farmacja', 'Słodycze', 'Chemia'
];
const LICZENIE_KATEGORIE_DOK = 'liczenie_kategorie';

let kategorieLiczenia = [];
let wynikiLiczenia = [];

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

async function pobierzKategorieLiczenia() {
    const ref = doc(db, 'system_ustawienia', LICZENIE_KATEGORIE_DOK);
    const snap = await getDoc(ref);
    if (snap.exists() && Array.isArray(snap.data().lista)) return [...snap.data().lista];
    await setDoc(ref, { lista: [...DOMYSLNE_KATEGORIE_LICZENIA] });
    return [...DOMYSLNE_KATEGORIE_LICZENIA];
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

    const admin = czyAdminLiczenia();
    let sumaPlus = 0;
    let sumaMinus = 0;
    let wiersze = '';

    wynikiLiczenia.forEach(w => {
        const plusy = Number(w.plusy) || 0;
        const minusy = Number(w.minusy) || 0;
        sumaPlus += plusy;
        sumaMinus += minusy;
        const akcje = admin
            ? `<button type="button" onclick="window.otworzModalLiczenia('${ucieczkaHtml(ucieczkaJs(w.id))}')" class="btn-info btn-sm" style="margin:0 3px 0 0;" title="Edytuj">✏️</button>
               <button type="button" onclick="window.usunLiczenie('${ucieczkaHtml(ucieczkaJs(w.id))}')" class="btn-danger btn-sm" style="margin:0;" title="Usuń">🗑️</button>`
            : '';

        wiersze += `<tr>
            <td style="text-align:left;">${ucieczkaHtml(w.kategoria || '—')}</td>
            <td>${ucieczkaHtml(formatujDateDoWyswietlenia(w.data) || '—')}</td>
            <td>${ucieczkaHtml(w.osoba || '—')}</td>
            <td>${formatujLiczbeLiczenia(w.liczenia)}</td>
            <td>${formatujLiczbeLiczenia(plusy)}</td>
            <td>${formatujLiczbeLiczenia(minusy)}</td>
            <td><strong>${formatujLiczbeLiczenia(plusy - minusy)}</strong></td>
            ${admin ? `<td style="white-space:nowrap;">${akcje}</td>` : ''}
        </tr>`;
    });

    const sumaNetto = sumaPlus - sumaMinus;
    const stopka = `<tr class="sum-row">
        <td style="text-align:left;">SUMA</td>
        <td colspan="3"></td>
        <td>${formatujLiczbeLiczenia(sumaPlus)}</td>
        <td>${formatujLiczbeLiczenia(sumaMinus)}</td>
        <td><strong>${formatujLiczbeLiczenia(sumaNetto)}</strong></td>
        ${admin ? '<td></td>' : ''}
    </tr>`;

    const pustyKomunikat = wynikiLiczenia.length === 0
        ? '<p class="text-muted">Brak zapisanych liczeń.</p>'
        : '';

    kontener.innerHTML = `${pustyKomunikat}
        <div class="table-responsive">
            <table class="standard-table">
                <thead><tr>
                    <th style="text-align:left;">Kategoria</th>
                    <th>Data</th>
                    <th>Osoba</th>
                    <th>Liczenia</th>
                    <th>Plusy</th>
                    <th>Minusy</th>
                    <th>Total</th>
                    ${admin ? '<th style="width:90px;">Akcja</th>' : ''}
                </tr></thead>
                <tbody>${wiersze}${stopka}</tbody>
            </table>
        </div>`;
}

window.zaladujLiczenie = async function() {
    const panelAdmina = document.getElementById('admin-liczenie-kategorie-panel');
    if (panelAdmina) panelAdmina.classList.toggle('hidden', !czyAdminLiczenia());

    try {
        const [kategorie, snap] = await Promise.all([
            pobierzKategorieLiczenia(),
            getDocs(collection(db, 'liczenie'))
        ]);
        kategorieLiczenia = kategorie;
        wynikiLiczenia = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
            const dataA = String(a.data || '');
            const dataB = String(b.data || '');
            if (dataA !== dataB) return dataB.localeCompare(dataA);
            return String(a.kategoria || '').localeCompare(String(b.kategoria || ''), 'pl');
        });
        wyswietlKategorieLiczenia();
        wyswietlWynikiLiczenia();
    } catch (e) {
        const kontener = document.getElementById('liczenie-container');
        if (kontener) kontener.innerHTML = `<span class="error">Błąd ładowania liczeń: ${ucieczkaHtml(e.message)}</span>`;
    }
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
    if (edycja && !czyAdminLiczenia()) return alert('Brak uprawnień do edycji!');
    if (kategorieLiczenia.length === 0) return alert('Brak kategorii. Najpierw dodaj kategorię w panelu admina.');

    const rekord = edycja ? wynikiLiczenia.find(w => w.id === id) : null;
    if (edycja && !rekord) return alert('Nie znaleziono tego liczenia.');

    document.getElementById('modal-liczenie-tytul').innerText = edycja ? 'Edytuj liczenie' : 'Nowe liczenie';
    document.getElementById('liczenie-id').value = id || '';

    const selectKategorii = document.getElementById('liczenie-kategoria');
    selectKategorii.innerHTML = '<option value="">Wybierz kategorię</option>' +
        kategorieLiczenia.map(k => `<option value="${ucieczkaHtml(k)}">${ucieczkaHtml(k)}</option>`).join('');
    selectKategorii.value = rekord?.kategoria || '';

    document.getElementById('liczenie-data').value = rekord?.data || pobierzDzisiejszaDateStr();
    document.getElementById('liczenie-liczba').value = rekord?.liczenia ?? '';
    document.getElementById('liczenie-plusy').value = rekord?.plusy ?? '';
    document.getElementById('liczenie-minusy').value = rekord?.minusy ?? '';

    const wybranaOsoba = rekord
        ? { id: rekord.osobaId, imie: rekord.osoba }
        : (currentUserData ? { id: currentUserData.uid, imie: currentUserData.imie } : null);
    await wypelnijSelectPracownikow('liczenie-osoba', wybranaOsoba);

    document.getElementById('modal-liczenie').classList.remove('hidden');
};

window.zamknijModalLiczenia = function() {
    document.getElementById('modal-liczenie').classList.add('hidden');
};

window.zapiszLiczenie = async function() {
    const id = document.getElementById('liczenie-id').value;
    if (id && !czyAdminLiczenia()) return alert('Brak uprawnień do edycji!');

    const kategoria = document.getElementById('liczenie-kategoria').value;
    const data = document.getElementById('liczenie-data').value;
    const osoba = pobierzDaneWybranegoPracownika('liczenie-osoba');
    if (!kategoria) return alert('Wybierz kategorię.');
    if (!data) return alert('Podaj datę.');
    if (!osoba.id) return alert('Wybierz osobę.');

    try {
        const dane = {
            kategoria,
            data,
            osoba: osoba.imie,
            osobaId: osoba.id,
            liczenia: pobierzLiczbeZLicznegoPola('liczenie-liczba', 'Liczenia'),
            plusy: pobierzLiczbeZLicznegoPola('liczenie-plusy', 'Plusy'),
            minusy: pobierzLiczbeZLicznegoPola('liczenie-minusy', 'Minusy'),
            updatedAt: new Date().toISOString()
        };

        if (id) {
            await setDoc(doc(db, 'liczenie', id), dane, { merge: true });
        } else {
            await addDoc(collection(db, 'liczenie'), { ...dane, createdAt: dane.updatedAt });
        }
        window.zamknijModalLiczenia();
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd zapisu liczenia: ' + e.message); }
};

window.usunLiczenie = async function(id) {
    if (!czyAdminLiczenia()) return alert('Brak uprawnień!');
    if (!confirm('Usunąć to wyniki liczenia? Tej operacji nie da się cofnąć.')) return;
    try {
        await deleteDoc(doc(db, 'liczenie', id));
        await window.zaladujLiczenie();
    } catch (e) { alert('Błąd usuwania liczenia: ' + e.message); }
};
