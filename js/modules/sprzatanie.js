'use strict';
// Moduł Sprzątanie (półki, potwierdzenia, reset).

/* ==================== SPRZĄTANIE ==================== */
window.zaladujSprzatanie = async function() {
    const wybranyMiesiac = document.getElementById('sprzatanie-miesiac').value;
    const wybranyOkres = document.getElementById('sprzatanie-okres').value;
    const container = document.getElementById('sprzatanie-container');
    const infoTryb = document.getElementById('info-tryb-pracy');
    if (!wybranyMiesiac) return;
    container.innerHTML = "Pobieranie danych...";

    const biezacy = pobierzBiezacyOkresSystemowy();
    const jestBiezacy = (wybranyMiesiac === biezacy.miesiacStr && wybranyOkres === biezacy.okresStr);
    const jestPrzyszlosc = (wybranyMiesiac > biezacy.miesiacStr) || (wybranyMiesiac === biezacy.miesiacStr && wybranyOkres === "16-koniec" && biezacy.okresStr === "1-15");
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    if (jestPrzyszlosc && !czyAdmin) infoTryb.innerHTML = `<span class="val-red">🔒 Okres przyszły: Zablokowany.</span>`;
    else if (jestBiezacy) infoTryb.innerHTML = `<span class="val-green">🟢 Okres bieżący: Kliknij wiersz, aby zapisać kontrolę.</span>`;
    else infoTryb.innerHTML = `<span style="color: var(--primary);">📖 ${czyAdmin ? 'Tryb Administratora: Pełna edycja i reset.' : 'Archiwum: Podgląd.'}</span>`;

    try {
        const [listaPolok, docSnap] = await Promise.all([
            pobierzListePolokDlaPlanogramu(),
            getDoc(doc(db, "sprzatanie", `${wybranyMiesiac}_${wybranyOkres}`))
        ]);
        aktualneDaneSprzatania = docSnap.exists() ? (docSnap.data().półki || {}) : {};
        let html = `<div class="table-responsive"><table class="cleaning-table"><tr><th style="text-align:left;">Półka / Strefa</th><th style="width: 100px;">Status</th><th style="width: 100px;">Data</th><th style="width: 110px;">Osoba</th></tr>`;
        
        listaPolok.forEach((polka, index) => {
            const p = aktualneDaneSprzatania[index] || {};
            const isDone = (p.czystosc && p.daty && p.planogram);
            const statusHtml = isDone ? `<span class="badge badge-done">✔ Gotowe</span>` : `<span class="badge badge-pending">⏳ Brak</span>`;
            const rowClass = (jestPrzyszlosc && !czyAdmin) ? "future-row" : "cleaning-row";
            const clickAttr = (jestPrzyszlosc && !czyAdmin) ? "" : `onclick="window.otworzModalPolki(${index}, '${polka}', ${jestBiezacy})"`;

            html += `<tr class="${rowClass}" ${clickAttr}>
                <td style="text-align:left;"><strong>${polka}</strong></td>
                <td>${statusHtml}</td>
                <td>${p.dataSprawdzenia || '-'}</td>
                <td>${p.podpis || '-'}</td>
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.otworzModalPolki = function(index, nazwaPolki, jestBiezacy) {
    document.getElementById('modal-polka-index').value = index;
    document.getElementById('modal-polka-tytuł').innerText = `🧹 ${nazwaPolki}`;
    const p = aktualneDaneSprzatania[index] || {};
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const moznaEdytowac = jestBiezacy || czyAdmin;

    document.getElementById('m-czystosc').checked = p.czystosc || false;
    document.getElementById('m-daty').checked = p.daty || false;
    document.getElementById('m-planogram').checked = p.planogram || false;
    document.getElementById('m-komentarz').value = p.komentarz || "";
    document.getElementById('m-zdjecie').value = "";

    document.getElementById('m-zdjecie-preview').innerHTML = p.zdjecie
        ? `<p class="text-muted">Zapisane zdjęcie:</p><img src="${p.zdjecie}" onclick="window.otworzZoomZdjecia('${p.zdjecie}')" style="max-width: 100%; max-height: 150px; border-radius: var(--radius-sm); cursor: pointer;">`
        : "";

    ['m-czystosc', 'm-daty', 'm-planogram', 'm-komentarz', 'm-zdjecie'].forEach(id => document.getElementById(id).disabled = !moznaEdytowac);
    document.getElementById('btn-zapisz-polka').style.display = moznaEdytowac ? 'inline-flex' : 'none';
    document.getElementById('btn-usun-polka').style.display = (czyAdmin && p.dataSprawdzenia) ? 'inline-flex' : 'none';
    document.getElementById('modal-polka').classList.remove('hidden');
};

window.zamknijModalPolki = () => document.getElementById('modal-polka').classList.add('hidden');

window.zapiszSzczegolyPolki = function() {
    const index = document.getElementById('modal-polka-index').value;
    const fileInput = document.getElementById('m-zdjecie');
    const executeSave = async (zdjecieBase64) => {
        const obecneDane = aktualneDaneSprzatania[index] || {};
        aktualneDaneSprzatania[index] = {
            czystosc: document.getElementById('m-czystosc').checked,
            daty: document.getElementById('m-daty').checked,
            planogram: document.getElementById('m-planogram').checked,
            komentarz: document.getElementById('m-komentarz').value,
            zdjecie: zdjecieBase64 || obecneDane.zdjecie || null,
            dataSprawdzenia: new Date().toLocaleDateString(),
            podpis: currentUserData.imie.split(' ')[0]
        };
        const docId = `${document.getElementById('sprzatanie-miesiac').value}_${document.getElementById('sprzatanie-okres').value}`;
        try {
            await setDoc(doc(db, "sprzatanie", docId), { półki: aktualneDaneSprzatania }, { merge: true });
            window.zamknijModalPolki();
            window.zaladujSprzatanie();
        } catch (e) { alert("Błąd zapisu: " + e.message); }
    };
    if (fileInput.files?.length > 0) kompresujObraz(fileInput.files[0], executeSave);
    else executeSave(null);
};

window.usunPotwierdzeniePolki = async function() {
    if (!confirm("Zresetować potwierdzenie kontroli dla tej półki?")) return;
    const index = document.getElementById('modal-polka-index').value;
    aktualneDaneSprzatania[index] = {
        czystosc: false, daty: false, planogram: false, komentarz: "", zdjecie: null,
        dataSprawdzenia: new Date().toLocaleDateString() + " (Reset)", podpis: "-"
    };
    const docId = `${document.getElementById('sprzatanie-miesiac').value}_${document.getElementById('sprzatanie-okres').value}`;
    try {
        await setDoc(doc(db, "sprzatanie", docId), { półki: aktualneDaneSprzatania }, { merge: true });
        window.zamknijModalPolki();
        window.zaladujSprzatanie();
    } catch (e) { alert("Błąd resetowania."); }
};
