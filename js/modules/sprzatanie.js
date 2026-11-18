'use strict';
// Moduł Sprzątanie (półki, potwierdzenia, reset).

/* ==================== SPRZĄTANIE ==================== */
function pobierzDanePolki(nazwa, index) {
    return aktualneDaneSprzatania[nazwa]
        || aktualneDaneSprzatania[String(index)]
        || aktualneDaneSprzatania[index]
        || {};
}

async function zapiszZmianePolki(nazwa, index, wpis) {
    const docId = `${document.getElementById('sprzatanie-miesiac').value}_${document.getElementById('sprzatanie-okres').value}`;
    const ref = doc(db, "sprzatanie", docId);
    const updatedAt = new Date().toISOString();

    await runTransaction(db, async (transakcja) => {
        const snap = await transakcja.get(ref);
        const zdalne = snap.exists() ? (snap.data().półki || {}) : {};
        const nowe = { ...zdalne, [nazwa]: wpis };
        // Usuwamy stary wpis zapisany pod indeksem tablicy (format sprzed migracji).
        if (index !== "" && index !== undefined && index !== null && String(index) !== nazwa) {
            delete nowe[String(index)];
        }
        transakcja.set(ref, { półki: nowe, updatedAt }, { merge: true });
    });

    aktualneDaneSprzatania = { ...aktualneDaneSprzatania, [nazwa]: wpis };
    if (index !== "" && index !== undefined && index !== null) delete aktualneDaneSprzatania[String(index)];
}

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
            const p = pobierzDanePolki(polka, index);
            const isDone = (p.czystosc && p.daty && p.planogram);
            const statusHtml = isDone ? `<span class="badge badge-done">✔ Gotowe</span>` : `<span class="badge badge-pending">⏳ Brak</span>`;
            const rowClass = (jestPrzyszlosc && !czyAdmin) ? "future-row" : "cleaning-row";
            const clickAttr = (jestPrzyszlosc && !czyAdmin) ? "" : `onclick="window.otworzModalPolki(${index}, '${ucieczkaJs(polka)}', ${jestBiezacy})"`;

            html += `<tr class="${rowClass}" ${clickAttr}>
                <td style="text-align:left;"><strong>${ucieczkaHtml(polka)}</strong></td>
                <td>${statusHtml}</td>
                <td>${ucieczkaHtml(formatujDateDoWyswietlenia(p.dataSprawdzenia) || '-')}</td>
                <td>${ucieczkaHtml(p.podpis || '-')}</td>
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.otworzModalPolki = function(index, nazwaPolki, jestBiezacy) {
    document.getElementById('modal-polka-index').value = index;
    document.getElementById('modal-polka-nazwa').value = nazwaPolki;
    document.getElementById('modal-polka-tytuł').innerText = `🧹 ${nazwaPolki}`;
    const p = pobierzDanePolki(nazwaPolki, index);
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const moznaEdytowac = jestBiezacy || czyAdmin;

    document.getElementById('m-czystosc').checked = p.czystosc || false;
    document.getElementById('m-daty').checked = p.daty || false;
    document.getElementById('m-planogram').checked = p.planogram || false;
    document.getElementById('m-komentarz').value = p.komentarz || "";
    document.getElementById('m-zdjecie').value = "";

    document.getElementById('m-zdjecie-preview').innerHTML = p.zdjecie
        ? `<p class="text-muted">Zapisane zdjęcie:</p><img src="${ucieczkaHtml(p.zdjecie)}" onclick="window.otworzZoomZdjecia('${ucieczkaJs(p.zdjecie)}')" style="max-width: 100%; max-height: 150px; border-radius: var(--radius-sm); cursor: pointer;">`
        : "";

    ['m-czystosc', 'm-daty', 'm-planogram', 'm-komentarz', 'm-zdjecie'].forEach(id => document.getElementById(id).disabled = !moznaEdytowac);
    document.getElementById('btn-zapisz-polka').style.display = moznaEdytowac ? 'inline-flex' : 'none';
    document.getElementById('btn-usun-polka').style.display = (czyAdmin && p.dataSprawdzenia) ? 'inline-flex' : 'none';
    document.getElementById('modal-polka').classList.remove('hidden');
};

window.zamknijModalPolki = () => {
    if (typeof window.zamknijAparat === 'function') window.zamknijAparat();
    document.getElementById('modal-polka').classList.add('hidden');
};

window.zapiszSzczegolyPolki = function(opcje = {}) {
    const index = document.getElementById('modal-polka-index').value;
    const nazwa = document.getElementById('modal-polka-nazwa').value;
    const fileInput = document.getElementById('m-zdjecie');
    if (!nazwa) return alert("Brak nazwy półki. Odśwież widok i spróbuj ponownie.");

    const executeSave = async (zdjecieBase64) => {
        const obecneDane = pobierzDanePolki(nazwa, index);
        const wpis = {
            nazwaPolki: nazwa,
            pracownikId: currentUserData ? (currentUserData.uid || currentUserData.id) : "",
            czystosc: document.getElementById('m-czystosc').checked,
            daty: document.getElementById('m-daty').checked,
            planogram: document.getElementById('m-planogram').checked,
            komentarz: document.getElementById('m-komentarz').value,
            zdjecie: zdjecieBase64 || obecneDane.zdjecie || null,
            dataSprawdzenia: pobierzDzisiejszaDateStr(),
            podpis: currentUserData ? currentUserData.imie : "",
            reset: false
        };
        try {
            await zapiszZmianePolki(nazwa, index, wpis);
            if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
            window.zamknijModalPolki();
            window.zaladujSprzatanie();
        } catch (e) { alert("Błąd zapisu: " + e.message); }
    };
    if (opcje.aparat) {
        window.otworzAparat(plik => kompresujObraz(plik, executeSave));
        return;
    }
    if (fileInput.files?.length > 0) kompresujObraz(fileInput.files[0], executeSave);
    else executeSave(null);
};

window.usunPotwierdzeniePolki = async function() {
    if (!confirm("Zresetować potwierdzenie kontroli dla tej półki?")) return;
    const index = document.getElementById('modal-polka-index').value;
    const nazwa = document.getElementById('modal-polka-nazwa').value;
    if (!nazwa) return;
    const wpis = {
        nazwaPolki: nazwa,
        pracownikId: currentUserData ? (currentUserData.uid || currentUserData.id) : "",
        czystosc: false, daty: false, planogram: false,
        komentarz: "", zdjecie: null,
        dataSprawdzenia: pobierzDzisiejszaDateStr(),
        podpis: "-",
        reset: true
    };
    try {
        await zapiszZmianePolki(nazwa, index, wpis);
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
        window.zamknijModalPolki();
        window.zaladujSprzatanie();
    } catch (e) { alert("Błąd resetowania."); }
};

window.usunPolkeZDanychSprzatania = async function(nazwa) {
    if (!nazwa) return;
    try {
        const snap = await getDocs(collection(db, "sprzatanie"));
        for (const d of snap.docs) {
            const dane = d.data();
            const polki = { ...(dane.półki || {}) };
            let zmiana = false;
            Object.keys(polki).forEach(klucz => {
                if (klucz === nazwa || polki[klucz]?.nazwaPolki === nazwa) {
                    delete polki[klucz];
                    zmiana = true;
                }
            });
            if (zmiana) {
                await setDoc(doc(db, "sprzatanie", d.id), {
                    półki: polki,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        }
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
    } catch (e) { console.warn("Nie udało się usunąć danych sprzątania dla półki:", e); }
};
