'use strict';
// Moduł Misje (zadania dla pracowników).

/* ==================== MISJE ==================== */
async function sprawdzPowiadomieniaMisje(imieKrotkie, czyAdmin) {
    try {
        const snap = await getDocs(collection(db, "misje"));
        let noweCnt = 0;
        snap.forEach(d => {
            const data = d.data();
            if (czyAdmin && data.status === "nowe") noweCnt++;
            else if (!czyAdmin && data.pracownik === imieKrotkie && data.status === "nowe") noweCnt++;
        });
        const badge = document.getElementById('misje-badge');
        if (noweCnt > 0) { badge.innerText = noweCnt; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    } catch (e) { console.error(e); }
}

async function wypelnijSelectPracownikow(selectId) {
    const sel = document.getElementById(selectId);
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let html = `<option value="">Wybierz pracownika</option>`;
        snap.forEach(d => { html += `<option value="${d.data().imie.split(' ')[0]}">${d.data().imie}</option>`; });
        sel.innerHTML = html;
    } catch (e) { sel.innerHTML = `<option value="">Błąd ładowania</option>`; }
}

window.dodajMisje = async function() {
    const pracownik = document.getElementById('misja-pracownik-select').value;
    const zadanie = document.getElementById('misja-tresc').value.trim();
    const doKiedy = document.getElementById('misja-termin').value;
    if (!pracownik || !zadanie || !doKiedy) return alert("Wypełnij wszystkie pola misji!");
    try {
        await addDoc(collection(db, "misje"), { pracownik, zadanie, doKiedy, status: "nowe", uwagi: "", dataUtworzenia: new Date().toLocaleString() });
        alert("Misja przypisana!");
        document.getElementById('misja-tresc').value = "";
        document.getElementById('misja-termin').value = "";
        window.zaladujMisje();
    } catch (e) { alert("Błąd zapisu."); }
};

window.zaladujMisje = async function() {
    const container = document.getElementById('misje-lista-container');
    container.innerHTML = "Pobieranie misji...";
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    if (czyAdmin) wypelnijSelectPracownikow('misja-pracownik-select');

    try {
        const snap = await getDocs(collection(db, "misje"));
        let html = `<div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Zadanie</th><th style="width: 95px;">Do kiedy</th><th>Status</th><th>Uwagi</th></tr>`;
        let count = 0, noweDlaMnie = 0;
        const mojeImie = currentUserData ? currentUserData.imie.split(' ')[0] : "";
        const dzisiajStr = pobierzDzisiejszaDateStr();

        const badgeMap = {
            'zrobione': 'badge-done', 'zaliczone': 'badge-done',
            'po czasie': 'badge-danger', 'do wyjaśnienia': 'badge-danger',
            'odebrane': 'badge-info', 'nowe': 'badge-pending'
        };

        for (const docSnap of snap.docs) {
            const id = docSnap.id, d = docSnap.data();
            if (!czyAdmin && d.pracownik !== mojeImie) continue;
            
            let aktualnyStatus = d.status;
            if (d.doKiedy && d.doKiedy < dzisiajStr && !['zrobione', 'zaliczone', 'po czasie'].includes(aktualnyStatus)) {
                aktualnyStatus = 'po czasie';
                await setDoc(doc(db, "misje", id), { status: 'po czasie' }, { merge: true });
            }

            count++;
            if (aktualnyStatus === "nowe") noweDlaMnie++;

            const statusBadge = `<span class="badge ${badgeMap[aktualnyStatus] || 'badge-pending'}">${aktualnyStatus}</span>`;
            html += `<tr class="cleaning-row" onclick="window.otworzModalUniwersalnaMisja('${id}', '${d.pracownik}', '${encodeURIComponent(d.zadanie)}', '${d.doKiedy}', '${aktualnyStatus}', '${encodeURIComponent(d.uwagi || '')}')">
                <td><strong>${d.pracownik}</strong></td>
                <td style="text-align:left; white-space:normal; min-width:160px;">${ucieczkaHtml(d.zadanie)}</td>
                <td>${d.doKiedy}</td>
                <td>${statusBadge}</td>
                <td style="text-align:left; white-space:normal; min-width:120px;">${ucieczkaHtml(d.uwagi) || '-'}</td>
            </tr>`;
        }

        const alertHtml = noweDlaMnie > 0
            ? `<div class="field-group" style="background:var(--warning-bg); color:var(--warning-text); border-color:var(--warning); font-weight:600;">⚠️ ${czyAdmin ? `W systemie jest ${noweDlaMnie} nowych zadań!` : `Masz ${noweDlaMnie} nowe zadanie(-a)!`}</div>`
            : '';

        container.innerHTML = alertHtml + (count === 0 ? "<p class='text-muted'>Brak misji.</p>" : html + `</table></div>`);
        sprawdzPowiadomieniaMisje(mojeImie, czyAdmin);
    } catch (e) { container.innerHTML = "Błąd pobierania."; }
};

window.otworzModalUniwersalnaMisja = async function(id, pracownik, zadanie, doKiedy, status, uwagi) {
    document.getElementById('m-edit-misja-id').value = id;
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const statusSel = document.getElementById('m-edit-misja-status');

    if (status === "nowe" && !czyAdmin) {
        status = "odebrane";
        try { await setDoc(doc(db, "misje", id), { status: "odebrane" }, { merge: true }); } catch(e) {}
    }

    document.getElementById('admin-edit-misja-sekcja').classList.toggle('hidden', !czyAdmin);
    document.getElementById('pracownik-view-misja-sekcja').classList.toggle('hidden', czyAdmin);
    document.getElementById('btn-usun-misja-admin').style.display = czyAdmin ? 'inline-flex' : 'none';

    if (czyAdmin) {
        await wypelnijSelectPracownikow('m-edit-misja-pracownik');
        document.getElementById('m-edit-misja-pracownik').value = pracownik;
        document.getElementById('m-edit-misja-tresc-admin').value = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-admin').value = doKiedy;
        statusSel.innerHTML = `
            <option value="nowe">nowe</option>
            <option value="odebrane">odebrane</option>
            <option value="zrobione">zrobione</option>
            <option value="zaliczone">zaliczone</option>
            <option value="do wyjaśnienia">do wyjaśnienia</option>`;
    } else {
        document.getElementById('m-edit-misja-tresc-pracownik').innerText = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-pracownik').innerText = doKiedy;
        statusSel.innerHTML = `
            <option value="${status}">${status}</option>
            <option value="zrobione">zrobione</option>`;
    }

    statusSel.value = status;
    document.getElementById('m-edit-misja-uwagi').value = decodeURIComponent(uwagi);
    document.getElementById('modal-uniwersalna-misja').classList.remove('hidden');
};

window.zamknijModalUniwersalnaMisja = () => {
    document.getElementById('modal-uniwersalna-misja').classList.add('hidden');
    window.zaladujMisje();
};

window.zapiszUniwersalnaMisja = async function() {
    const id = document.getElementById('m-edit-misja-id').value;
    const status = document.getElementById('m-edit-misja-status').value;
    const uwagi = document.getElementById('m-edit-misja-uwagi').value.trim();
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    const daneZapisu = { status, uwagi };
    if (czyAdmin) {
        daneZapisu.pracownik = document.getElementById('m-edit-misja-pracownik').value;
        daneZapisu.zadanie = document.getElementById('m-edit-misja-tresc-admin').value.trim();
        daneZapisu.doKiedy = document.getElementById('m-edit-misja-termin-admin').value;
    }

    try {
        await setDoc(doc(db, "misje", id), daneZapisu, { merge: true });
        window.zamknijModalUniwersalnaMisja();
        alert("Zaktualizowano zadanie!");
    } catch (e) { alert("Błąd zapisu zadania."); }
};

window.usunMisjeZModala = async function() {
    if (confirm("Czy na pewno chcesz usunąć tę misję?")) {
        try {
            await deleteDoc(doc(db, "misje", document.getElementById('m-edit-misja-id').value));
            document.getElementById('modal-uniwersalna-misja').classList.add('hidden');
            window.zaladujMisje();
        } catch (e) { alert("Błąd usuwania misji."); }
    }
};
