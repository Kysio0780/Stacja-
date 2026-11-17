'use strict';
// Moduł Misje (zadania dla pracowników).

/* ==================== MISJE ==================== */
async function sprawdzPowiadomieniaMisje(pracownikId, imieKrotkie, czyAdmin) {
    try {
        const snap = await getDocs(collection(db, "misje"));
        let noweCnt = 0;
        snap.forEach(d => {
            const data = d.data();
            if (czyAdmin && data.status === STATUSY_MISJI.NOWE) noweCnt++;
            else if (!czyAdmin && data.status === STATUSY_MISJI.NOWE && czyPracownikPasuje(data, pracownikId, imieKrotkie)) noweCnt++;
        });
        const badge = document.getElementById('misje-badge');
        if (noweCnt > 0) { badge.innerText = noweCnt; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    } catch (e) { console.error(e); }
}

async function wypelnijSelectPracownikow(selectId, wybranaWartosc = null) {
    const sel = document.getElementById(selectId);
    try {
        const pracownicy = await pobierzListePracownikow();
        let html = `<option value="">Wybierz pracownika</option>`;
        pracownicy.forEach(u => {
            html += `<option value="${ucieczkaHtml(u.id)}" data-imie="${ucieczkaHtml(u.imie || '')}">${ucieczkaHtml(u.imie || u.login || '')}</option>`;
        });
        sel.innerHTML = html;
        if (wybranaWartosc) ustawWartoscSelectPracownika(selectId, wybranaWartosc.id, wybranaWartosc.imie);
    } catch (e) { sel.innerHTML = `<option value="">Błąd ładowania</option>`; }
}

function ustawWartoscSelectPracownika(selectId, pracownikId, imie) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    if (pracownikId && Array.from(sel.options).some(o => o.value === String(pracownikId))) {
        sel.value = String(pracownikId);
        return;
    }
    const opcja = Array.from(sel.options).find(o => o.dataset.imie === imie);
    if (opcja) sel.value = opcja.value;
}

function pobierzDaneWybranegoPracownika(selectId) {
    const sel = document.getElementById(selectId);
    const opcja = sel?.options?.[sel.selectedIndex];
    return {
        id: sel?.value || "",
        imie: opcja?.dataset?.imie || opcja?.textContent?.trim() || ""
    };
}

window.dodajMisje = async function() {
    const wybrany = pobierzDaneWybranegoPracownika('misja-pracownik-select');
    const zadanie = document.getElementById('misja-tresc').value.trim();
    const doKiedy = document.getElementById('misja-termin').value;
    if (!wybrany.id || !zadanie || !doKiedy) return alert("Wypełnij wszystkie pola misji!");
    try {
        await addDoc(collection(db, "misje"), {
            pracownikId: wybrany.id,
            pracownik: wybrany.imie,
            zadanie,
            doKiedy,
            status: STATUSY_MISJI.NOWE,
            uwagi: "",
            dataUtworzenia: new Date().toISOString(),
            timestamp: Date.now()
        });
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
        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        const mojeImie = currentUserData ? currentUserData.imie : "";
        const dzisiajStr = pobierzDzisiejszaDateStr();

        const badgeMap = {
            [STATUSY_MISJI.ZROBIONE]: 'badge-done',
            [STATUSY_MISJI.ZALICZONE]: 'badge-done',
            [STATUSY_MISJI.PO_CZASIE]: 'badge-danger',
            [STATUSY_MISJI.DO_WYJASNIENIA]: 'badge-danger',
            [STATUSY_MISJI.ODEBRANE]: 'badge-info',
            [STATUSY_MISJI.NOWE]: 'badge-pending'
        };

        for (const docSnap of snap.docs) {
            const id = docSnap.id, d = docSnap.data();
            if (!czyAdmin && !czyPracownikPasuje(d, mojId, mojeImie)) continue;

            let aktualnyStatus = d.status;
            if (d.doKiedy && d.doKiedy < dzisiajStr && ![
                STATUSY_MISJI.ZROBIONE, STATUSY_MISJI.ZALICZONE, STATUSY_MISJI.PO_CZASIE
            ].includes(aktualnyStatus)) {
                aktualnyStatus = STATUSY_MISJI.PO_CZASIE;
                await setDoc(doc(db, "misje", id), { status: STATUSY_MISJI.PO_CZASIE }, { merge: true });
            }

            count++;
            if (aktualnyStatus === STATUSY_MISJI.NOWE) noweDlaMnie++;

            const statusBadge = `<span class="badge ${badgeMap[aktualnyStatus] || 'badge-pending'}">${ucieczkaHtml(aktualnyStatus || 'brak')}</span>`;
            const pracownikId = d.pracownikId || "";
            const pracownik = d.pracownik || pracownikId || "-";
            html += `<tr class="cleaning-row" onclick="window.otworzModalUniwersalnaMisja('${ucieczkaJs(id)}', '${ucieczkaJs(pracownikId)}', '${ucieczkaJs(pracownik)}', '${ucieczkaJs(encodeURIComponent(d.zadanie || ''))}', '${ucieczkaJs(d.doKiedy || '')}', '${ucieczkaJs(aktualnyStatus || '')}', '${ucieczkaJs(encodeURIComponent(d.uwagi || ''))}')">
                <td><strong>${ucieczkaHtml(pracownik)}</strong></td>
                <td style="text-align:left; white-space:normal; min-width:160px;">${ucieczkaHtml(d.zadanie)}</td>
                <td>${ucieczkaHtml(d.doKiedy)}</td>
                <td>${statusBadge}</td>
                <td style="text-align:left; white-space:normal; min-width:120px;">${ucieczkaHtml(d.uwagi) || '-'}</td>
            </tr>`;
        }

        const alertHtml = noweDlaMnie > 0
            ? `<div class="field-group" style="background:var(--warning-bg); color:var(--warning-text); border-color:var(--warning); font-weight:600;">⚠️ ${czyAdmin ? `W systemie jest ${noweDlaMnie} nowych zadań!` : `Masz ${noweDlaMnie} nowe zadanie(-a)!`}</div>`
            : '';

        container.innerHTML = alertHtml + (count === 0 ? "<p class='text-muted'>Brak misji.</p>" : html + `</table></div>`);
        sprawdzPowiadomieniaMisje(mojId, pobierzImieKrotkie(mojeImie), czyAdmin);
    } catch (e) { container.innerHTML = "Błąd pobierania."; }
};

window.otworzModalUniwersalnaMisja = async function(id, pracownikId, pracownik, zadanie, doKiedy, status, uwagi) {
    document.getElementById('m-edit-misja-id').value = id;
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const statusSel = document.getElementById('m-edit-misja-status');

    if (status === STATUSY_MISJI.NOWE && !czyAdmin) {
        status = STATUSY_MISJI.ODEBRANE;
        try { await setDoc(doc(db, "misje", id), { status: STATUSY_MISJI.ODEBRANE }, { merge: true }); } catch (e) { console.warn(e); }
    }

    document.getElementById('admin-edit-misja-sekcja').classList.toggle('hidden', !czyAdmin);
    document.getElementById('pracownik-view-misja-sekcja').classList.toggle('hidden', czyAdmin);
    document.getElementById('btn-usun-misja-admin').style.display = czyAdmin ? 'inline-flex' : 'none';

    if (czyAdmin) {
        await wypelnijSelectPracownikow('m-edit-misja-pracownik', { id: pracownikId, imie: pracownik });
        document.getElementById('m-edit-misja-tresc-admin').value = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-admin').value = doKiedy;
        statusSel.innerHTML = `
            <option value="${STATUSY_MISJI.NOWE}">nowe</option>
            <option value="${STATUSY_MISJI.ODEBRANE}">odebrane</option>
            <option value="${STATUSY_MISJI.ZROBIONE}">zrobione</option>
            <option value="${STATUSY_MISJI.ZALICZONE}">zaliczone</option>
            <option value="${STATUSY_MISJI.DO_WYJASNIENIA}">do wyjaśnienia</option>
            <option value="${STATUSY_MISJI.PO_CZASIE}">po czasie</option>`;
    } else {
        document.getElementById('m-edit-misja-tresc-pracownik').innerText = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-pracownik').innerText = doKiedy;
        statusSel.innerHTML = `
            <option value="${ucieczkaHtml(status)}">${ucieczkaHtml(status)}</option>
            <option value="${STATUSY_MISJI.ZROBIONE}">zrobione</option>`;
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

    if (!status) return alert("Wybierz status zadania!");

    const daneZapisu = { status, uwagi, updatedAt: new Date().toISOString() };
    if (czyAdmin) {
        const wybrany = pobierzDaneWybranegoPracownika('m-edit-misja-pracownik');
        daneZapisu.pracownikId = wybrany.id;
        daneZapisu.pracownik = wybrany.imie;
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
