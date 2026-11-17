'use strict';
// Moduł Planogramy (kategorie półek, zdjęcia).

/* ==================== PLANOGRAMY ==================== */
async function pobierzListePolokDlaPlanogramu() {
    try {
        const docSnap = await getDoc(doc(db, "system_ustawienia", "planogramy_kategorie"));
        if (docSnap.exists() && docSnap.data().lista) return docSnap.data().lista;
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista: DOMYSLNE_POLKI });
        return DOMYSLNE_POLKI;
    } catch (e) { return DOMYSLNE_POLKI; }
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
                <td style="text-align:left;" onclick="window.otworzModalPlanogramu('${polka}')"><strong>${polka}</strong></td>
                <td onclick="window.otworzModalPlanogramu('${polka}')">${dataUmieszczenia}</td>
                <td onclick="window.otworzModalPlanogramu('${polka}')">${statusBadge}</td>
                ${czyAdmin ? `<td><button onclick="window.usunPolkeZListyPlanogramu('${polka}')" class="btn-danger btn-sm">🗑️</button></td>` : ''}
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.dodajNowaPolkeDoListy = async function() {
    const nazwa = document.getElementById('nowa-polka-nazwa').value.trim();
    if (!nazwa) return alert("Wpisz nazwę strefy!");
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
            let galeriaHtml = `<p class="text-muted">Zaktualizowano: <strong>${data.dataUmieszczenia || 'bd'}</strong> (${data.autor || 'Admin'})</p><div class="planogram-gallery">`;
            zdjeciaList.forEach((src, idx) => {
                const delBtn = czyAdmin ? `<button onclick="window.usunPojedynczeZdjeciePlanogramu(${idx})" class="btn-danger btn-sm" style="margin-top:6px; width:100%;">🗑️ Usuń</button>` : '';
                galeriaHtml += `<div class="planogram-thumb-box"><img src="${src}" onclick="window.otworzZoomZdjecia('${src}')">${delBtn}</div>`;
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
    const fileInput = document.getElementById('admin-planogram-file');
    if (!fileInput.files || fileInput.files.length === 0) return alert("Wybierz przynajmniej jedno zdjęcie!");

    const compressedResults = await Promise.all(
        Array.from(fileInput.files).map(f => new Promise(res => kompresujObraz(f, res)))
    );

    try {
        const docRef = doc(db, "planogramy", aktualnieOtwartyPlanogram);
        const docSnap = await getDoc(docRef);
        let obecneZdjecia = [];
        if (docSnap.exists()) {
            const data = docSnap.data();
            obecneZdjecia = data.zdjęcia ? data.zdjęcia : (data.plik ? [data.plik] : []);
        }
        const zaktualizowaneZdjecia = [...obecneZdjecia, ...compressedResults];
        await setDoc(docRef, {
            nazwa: aktualnieOtwartyPlanogram, zdjęcia: zaktualizowaneZdjecia,
            dataUmieszczenia: new Date().toLocaleDateString(), autor: currentUserData.imie
        });
        alert(`Dodano ${compressedResults.length} zdjęć!`);
        window.otworzModalPlanogramu(aktualnieOtwartyPlanogram);
        window.zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.usunPojedynczeZdjeciePlanogramu = async function(index) {
    if (!confirm("Usunąć to zdjęcie?")) return;
    try {
        const docRef = doc(db, "planogramy", aktualnieOtwartyPlanogram);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            let zdj = data.zdjęcia ? data.zdjęcia : (data.plik ? [data.plik] : []);
            zdj.splice(index, 1);
            if (zdj.length === 0) await deleteDoc(docRef);
            else await setDoc(docRef, { zdjęcia: zdj }, { merge: true });
            window.otworzModalPlanogramu(aktualnieOtwartyPlanogram);
            window.zaladujPlanogramyMenu();
        }
    } catch (e) { alert("Błąd usuwania."); }
};
