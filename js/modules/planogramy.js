'use strict';
// Moduł Planogramy (kategorie półek, zdjęcia).

/* ==================== PLANOGRAMY ==================== */
async function pobierzListePolokDlaPlanogramu() {
    try {
        const docSnap = await getDoc(doc(db, "system_ustawienia", "planogramy_kategorie"));
        if (docSnap.exists() && docSnap.data().lista) return [...docSnap.data().lista];
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista: [...DOMYSLNE_POLKI] });
        return [...DOMYSLNE_POLKI];
    } catch (e) { return [...DOMYSLNE_POLKI]; }
}

window.zaladujPlanogramyMenu = async function() {
    const container = document.getElementById('planogramy-lista-container');
    container.innerHTML = "Pobieranie listy półek...";
    try {
        const [listaPolok, querySnapshot] = await Promise.all([
            pobierzListePolokDlaPlanogramu(),
            getDocs(collection(db, "planogramy"))
        ]);
        const danePlanogramow = {};
        querySnapshot.forEach(docSnap => { danePlanogramow[docSnap.id] = docSnap.data(); });

        const czyAdmin = currentUserData && currentUserData.rola === 'admin';
        let html = `<div class="table-responsive"><table class="cleaning-table"><tr><th style="text-align:left;">Nazwa półki / strefy</th><th style="width: 120px;">Data modyf.</th><th style="width: 100px;">Status</th>${czyAdmin ? '<th style="width: 50px;">Akcja</th>' : ''}</tr>`;

        listaPolok.forEach(polka => {
            const pData = danePlanogramow[polka];
            let statusBadge = `<span class="badge badge-pending">Brak</span>`;
            let dataUmieszczenia = "-";
            if (pData) {
                const cnt = pData.zdjęcia?.length || (pData.plik ? 1 : 0);
                if (cnt > 0) {
                    dataUmieszczenia = pData.dataUmieszczenia || "-";
                    statusBadge = `<span class="badge badge-done">📷 ${cnt}</span>`;
                }
            }
            html += `<tr class="cleaning-row">
                <td style="text-align:left;" onclick="window.otworzModalPlanogramu('${ucieczkaJs(polka)}')"><strong>${ucieczkaHtml(polka)}</strong></td>
                <td onclick="window.otworzModalPlanogramu('${ucieczkaJs(polka)}')">${ucieczkaHtml(formatujDateDoWyswietlenia(dataUmieszczenia))}</td>
                <td onclick="window.otworzModalPlanogramu('${ucieczkaJs(polka)}')">${statusBadge}</td>
                ${czyAdmin ? `<td><button onclick="window.usunPolkeZListyPlanogramu('${ucieczkaJs(polka)}')" class="btn-danger btn-sm">🗑️</button></td>` : ''}
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.dodajNowaPolkeDoListy = async function() {
    const nazwa = document.getElementById('nowa-polka-nazwa').value.trim();
    if (!nazwa) return alert("Wpisz nazwę strefy!");
    if (nazwa.includes('/')) return alert("Nazwa strefy nie może zawierać znaku '/'.");
    try {
        const lista = await pobierzListePolokDlaPlanogramu();
        if (lista.includes(nazwa)) return alert("Taka strefa już istnieje!");
        lista.push(nazwa);
        lista.sort((a, b) => a.localeCompare(b));
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista });
        document.getElementById('nowa-polka-nazwa').value = "";
        window.zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd zapisu."); }
};

window.usunPolkeZListyPlanogramu = async function(nazwa) {
    if (!confirm(`Usunąć strefę "${nazwa}" z listy?`)) return;
    try {
        let lista = await pobierzListePolokDlaPlanogramu();
        lista = lista.filter(item => item !== nazwa);
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista });
        await deleteDoc(doc(db, "planogramy", nazwa));
        if (typeof window.usunPolkeZDanychSprzatania === 'function') {
            await window.usunPolkeZDanychSprzatania(nazwa);
        }
        window.zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd usuwania."); }
};

let aktualnieOtwartyPlanogram = null;
window.otworzModalPlanogramu = async function(nazwaPolki) {
    aktualnieOtwartyPlanogram = nazwaPolki;
    document.getElementById('modal-planogram-tytul').innerText = `📋 Planogram: ${nazwaPolki}`;
    document.getElementById('modal-planogram-tresc').innerHTML = "Pobieranie danych...";
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    document.getElementById('admin-planogram-edycja').classList.toggle('hidden', !czyAdmin);
    document.getElementById('admin-planogram-file').value = "";
    document.getElementById('modal-planogram-szczegoly').classList.remove('hidden');

    try {
        const docSnap = await getDoc(doc(db, "planogramy", nazwaPolki));
        const data = docSnap.exists() ? docSnap.data() : null;
        let zdjeciaList = data?.zdjęcia ? data.zdjęcia : (data?.plik ? [data.plik] : []);

        if (zdjeciaList.length > 0) {
            let galeriaHtml = `<p class="text-muted">Zaktualizowano: <strong>${ucieczkaHtml(formatujDateCzasDoWyswietlenia(data.dataUmieszczenia) || 'bd')}</strong> (${ucieczkaHtml(data.autor || 'Admin')})</p><div class="planogram-gallery">`;
            zdjeciaList.forEach((src, idx) => {
                const delBtn = czyAdmin ? `<button onclick="window.usunPojedynczeZdjeciePlanogramu(${idx})" class="btn-danger btn-sm" style="margin-top:6px; width:100%;">🗑️ Usuń</button>` : '';
                galeriaHtml += `<div class="planogram-thumb-box"><img src="${ucieczkaHtml(src)}" onclick="window.otworzZoomZdjecia('${ucieczkaJs(src)}')">${delBtn}</div>`;
            });
            document.getElementById('modal-planogram-tresc').innerHTML = galeriaHtml + `</div>`;
        } else {
            document.getElementById('modal-planogram-tresc').innerHTML = "<p class='text-muted'>Brak dodanych zdjęć dla tej półki.</p>";
        }
    } catch (e) { document.getElementById('modal-planogram-tresc').innerHTML = "<span class='error'>Błąd pobierania danych.</span>"; }
};

window.zamknijModalPlanogramu = () => {
    document.getElementById('modal-planogram-szczegoly').classList.add('hidden');
    aktualnieOtwartyPlanogram = null;
};

window.dodajZdjeciaDoPlanogramu = async function() {
    if (!aktualnieOtwartyPlanogram) return alert("Najpierw otwórz planogram wybranej półki.");
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");

    const fileInput = document.getElementById('admin-planogram-file');
    if (!fileInput.files || fileInput.files.length === 0) return alert("Wybierz przynajmniej jedno zdjęcie!");

    const compressedResults = await Promise.all(
        Array.from(fileInput.files).map(f => new Promise(res => kompresujObraz(f, res)))
    );
    const noweZdjecia = compressedResults.filter(Boolean);
    if (noweZdjecia.length === 0) return alert("Nie udało się przetworzyć zdjęć. Spróbuj ponownie.");

    const nazwa = aktualnieOtwartyPlanogram;
    try {
        const docRef = doc(db, "planogramy", nazwa);
        const teraz = new Date().toISOString();
        const autor = currentUserData.imie;
        const autorId = pobierzIdPracownika(currentUserData);

        // Transakcja chroni przed nadpisaniem zdjęć dodanych równolegle przez inną osobę.
        await runTransaction(db, async (transakcja) => {
            const snap = await transakcja.get(docRef);
            const dane = snap.exists() ? snap.data() : {};
            const obecne = Array.isArray(dane.zdjęcia) && dane.zdjęcia.length > 0
                ? dane.zdjęcia
                : (dane.plik ? [dane.plik] : []);
            transakcja.set(docRef, {
                nazwa,
                zdjęcia: [...obecne, ...noweZdjecia],
                dataUmieszczenia: teraz,
                autor,
                autorId,
                updatedAt: teraz
            }, { merge: true });
        });

        alert(`Dodano ${noweZdjecia.length} zdjęć!`);
        fileInput.value = "";
        window.otworzModalPlanogramu(nazwa);
        window.zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.usunPojedynczeZdjeciePlanogramu = async function(index) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    if (!confirm("Usunąć to zdjęcie?")) return;
    const nazwa = aktualnieOtwartyPlanogram;
    if (!nazwa) return;
    try {
        const docRef = doc(db, "planogramy", nazwa);
        const teraz = new Date().toISOString();
        await runTransaction(db, async (transakcja) => {
            const docSnap = await transakcja.get(docRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            const zdjecia = Array.isArray(data.zdjęcia) && data.zdjęcia.length > 0
                ? [...data.zdjęcia]
                : (data.plik ? [data.plik] : []);
            if (index < 0 || index >= zdjecia.length) return;
            zdjecia.splice(index, 1);
            if (zdjecia.length === 0) transakcja.delete(docRef);
            else transakcja.set(docRef, {
                zdjęcia: zdjecia,
                updatedAt: teraz,
                autorId: pobierzIdPracownika(currentUserData),
                autor: currentUserData.imie
            }, { merge: true });
        });
        window.otworzModalPlanogramu(nazwa);
        window.zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd usuwania: " + e.message); }
};
