'use strict';
// Moduł Marketing — akcje promocyjne i wydarzenia sprzedażowe.

const MARKETING_KOLEKCJA = 'marketing';
let wybraneZdjecieMarketing = null;
let marketingEdycjaZdjecieIstnieje = false;
let marketingPodgladId = null;

function czyAdminMarketingu() {
    return !!(currentUserData && currentUserData.rola === 'admin');
}

function formatujDateBezpiecznie(wartosc) {
    return ucieczkaHtml(formatujDateDoWyswietlenia(wartosc) || '—');
}

function pokazPodgladZdjeciaMarketing(base64) {
    const kontener = document.getElementById('marketing-zdjecie-preview');
    if (!kontener) return;
    if (!base64) {
        kontener.innerHTML = '';
        return;
    }
    kontener.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:150px; border-radius:var(--radius-sm); cursor:pointer;"
        onclick="window.otworzZoomZdjecia('${ucieczkaJs(base64)}')" title="Kliknij, aby powiększyć">`;
}

window.zaladujMarketing = async function() {
    const kontener = document.getElementById('marketing-lista-container');
    if (!kontener) return;
    document.getElementById('marketing-admin-panel')?.classList.toggle('hidden', !czyAdminMarketingu());
    kontener.innerHTML = 'Ładowanie wpisów...';

    try {
        const snap = await getDocs(collection(db, MARKETING_KOLEKCJA));
        const wpisy = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
            const dataA = String(a.dataOd || '');
            const dataB = String(b.dataOd || '');
            if (dataA !== dataB) return dataB.localeCompare(dataA);
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });

        if (!wpisy.length) {
            kontener.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Brak aktualnych akcji marketingowych.</p>';
            return;
        }

        kontener.innerHTML = `<div class="table-responsive"><table class="standard-table">
            <tr><th>Nazwa</th><th>Obowiązuje od</th><th>Obowiązuje do</th><th style="width:80px;">Zdjęcie</th></tr>
            ${wpisy.map(w => {
                const miniatura = w.zdjecie
                    ? `<img src="${w.zdjecie}" class="marketing-mini" style="max-width:64px; max-height:44px; border-radius:4px; cursor:pointer;"
                            onclick="event.stopPropagation(); window.otworzZoomZdjecia('${ucieczkaJs(w.zdjecie)}')" title="Kliknij, aby powiększyć">`
                    : '<span class="text-muted">—</span>';
                return `<tr class="cleaning-row" onclick="window.otworzPodgladMarketing('${ucieczkaHtml(ucieczkaJs(w.id))}')">
                    <td style="text-align:left;"><strong>${ucieczkaHtml(w.nazwa || '—')}</strong></td>
                    <td>${formatujDateBezpiecznie(w.dataOd)}</td>
                    <td>${formatujDateBezpiecznie(w.dataDo)}</td>
                    <td>${miniatura}</td>
                </tr>`;
            }).join('')}
        </table></div>`;
    } catch (e) {
        kontener.innerHTML = `<span class="error">Błąd ładowania wpisów: ${ucieczkaHtml(e.message)}</span>`;
    }
};

window.otworzModalMarketing = async function(id = null) {
    if (!czyAdminMarketingu()) return alert('Brak uprawnień!');
    document.getElementById('modal-marketing-tytul').innerText = id ? '✏️ Edytuj promocję' : '➕ Nowa promocja';
    document.getElementById('marketing-id').value = id || '';
    document.getElementById('marketing-nazwa').value = '';
    document.getElementById('marketing-od').value = '';
    document.getElementById('marketing-do').value = '';
    document.getElementById('marketing-opis').value = '';
    document.getElementById('marketing-zdjecie-input').value = '';
    wybraneZdjecieMarketing = null;
    marketingEdycjaZdjecieIstnieje = false;

    if (id) {
        try {
            const snap = await getDoc(doc(db, MARKETING_KOLEKCJA, id));
            if (!snap.exists()) return alert('Nie znaleziono wpisu.');
            const w = snap.data();
            document.getElementById('marketing-nazwa').value = w.nazwa || '';
            document.getElementById('marketing-od').value = w.dataOd || '';
            document.getElementById('marketing-do').value = w.dataDo || '';
            document.getElementById('marketing-opis').value = w.opis || '';
            wybraneZdjecieMarketing = w.zdjecie || null;
            marketingEdycjaZdjecieIstnieje = !!w.zdjecie;
            pokazPodgladZdjeciaMarketing(w.zdjecie || null);
        } catch (e) { alert('Błąd wczytania wpisu: ' + e.message); return; }
    } else {
        pokazPodgladZdjeciaMarketing(null);
    }
    document.getElementById('modal-marketing').classList.remove('hidden');
};

window.zamknijModalMarketing = function() {
    document.getElementById('modal-marketing').classList.add('hidden');
};

window.dodajZdjecieMarketingAparatem = function() {
    if (typeof window.otworzAparat !== 'function') {
        alert('Aparat jest dostępny w aplikacji APK. Użyj wyboru pliku.');
        return;
    }
    window.otworzAparat(plik => kompresujObraz(plik, base64 => {
        wybraneZdjecieMarketing = base64;
        marketingEdycjaZdjecieIstnieje = false;
        pokazPodgladZdjeciaMarketing(base64);
    }));
};

document.addEventListener('DOMContentLoaded', () => {
    const pole = document.getElementById('marketing-zdjecie-input');
    if (!pole) return;
    pole.addEventListener('change', () => {
        const plik = pole.files?.[0];
        if (!plik) return;
        kompresujObraz(plik, base64 => {
            wybraneZdjecieMarketing = base64;
            marketingEdycjaZdjecieIstnieje = false;
            pokazPodgladZdjeciaMarketing(base64);
        });
    });
});

window.zapiszMarketing = async function() {
    if (!czyAdminMarketingu()) return alert('Brak uprawnień!');
    const id = document.getElementById('marketing-id').value;
    const nazwa = String(document.getElementById('marketing-nazwa').value || '').trim();
    const dataOd = document.getElementById('marketing-od').value;
    const dataDo = document.getElementById('marketing-do').value;
    const opis = String(document.getElementById('marketing-opis').value || '').trim();
    if (!nazwa) return alert('Wpisz nazwę akcji.');
    if (!dataOd || !dataDo) return alert('Podaj daty obowiązywania.');
    if (dataOd > dataDo) return alert('Data „od" nie może być późniejsza niż data „do".');

    const dane = {
        nazwa, dataOd, dataDo, opis,
        zdjecie: wybraneZdjecieMarketing || null,
        updatedAt: new Date().toISOString()
    };
    try {
        if (id) {
            await setDoc(doc(db, MARKETING_KOLEKCJA, id), { ...dane, updatedAt: new Date().toISOString() }, { merge: true });
        } else {
            await addDoc(collection(db, MARKETING_KOLEKCJA), {
                ...dane, createdAt: new Date().toISOString()
            });
        }
        window.zamknijModalMarketing();
        await window.zaladujMarketing();
        alert(id ? 'Promocja zaktualizowana.' : 'Promocja dodana.');
    } catch (e) { alert('Błąd zapisu: ' + e.message); }
};

window.usunMarketing = async function(id) {
    if (!czyAdminMarketingu()) return alert('Brak uprawnień!');
    if (!confirm('Usunąć tę promocję? Tej operacji nie da się cofnąć.')) return;
    try {
        await deleteDoc(doc(db, MARKETING_KOLEKCJA, id));
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
        await window.zaladujMarketing();
        alert('Promocja usunięta.');
    } catch (e) { alert('Błąd usuwania: ' + e.message); }
};

window.otworzPodgladMarketing = async function(id) {
    try {
        const snap = await getDoc(doc(db, MARKETING_KOLEKCJA, id));
        if (!snap.exists()) return alert('Nie znaleziono wpisu.');
        marketingPodgladId = id;
        const w = snap.data();
        document.getElementById('marketing-podglad-tytul').innerText = `📣 ${w.nazwa || ''}`;
        document.getElementById('marketing-podglad-okres').innerHTML =
            `Obowiązuje od <strong>${formatujDateBezpiecznie(w.dataOd)}</strong> do <strong>${formatujDateBezpiecznie(w.dataDo)}</strong>`;
        document.getElementById('marketing-podglad-opis').innerText = w.opis || '';
        document.getElementById('marketing-podglad-zdjecie').innerHTML = w.zdjecie
            ? `<img src="${w.zdjecie}" style="max-width:100%; max-height:320px; border-radius:var(--radius-sm); cursor:pointer;"
                 onclick="window.otworzZoomZdjecia('${ucieczkaJs(w.zdjecie)}')" title="Kliknij, aby powiększyć">`
            : '';
        const admin = czyAdminMarketingu();
        document.getElementById('marketing-podglad-edytuj')?.classList.toggle('hidden', !admin);
        document.getElementById('marketing-podglad-usun')?.classList.toggle('hidden', !admin);
        document.getElementById('modal-marketing-podglad').classList.remove('hidden');
    } catch (e) { alert('Błąd wczytania wpisu: ' + e.message); }
};

window.edytujMarketingZPodgladu = function() {
    if (!marketingPodgladId) return;
    const id = marketingPodgladId;
    window.zamknijPodgladMarketing();
    window.otworzModalMarketing(id);
};

window.usunMarketingZPodgladu = async function() {
    if (!marketingPodgladId) return;
    const id = marketingPodgladId;
    window.zamknijPodgladMarketing();
    await window.usunMarketing(id);
};

window.zamknijPodgladMarketing = function() {
    document.getElementById('modal-marketing-podglad').classList.add('hidden');
    marketingPodgladId = null;
};
