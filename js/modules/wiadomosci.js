'use strict';
// Moduł Wiadomości (odebrane/wysłane, podgląd, odpowiedź, usuwanie).

async function sprawdzPowiadomieniaWiadomosci(pracownikId, mojeImie = "") {
    try {
        const snap = await getDocs(collection(db, "wiadomosci"));
        let nieprzeczytaneCnt = 0;
        snap.forEach(d => {
            const dane = d.data();
            const st = dane.odbiorcyStatus?.[pracownikId] || (mojeImie ? dane.odbiorcyStatus?.[mojeImie] : null);
            if (st && st.przeczytane === false) nieprzeczytaneCnt++;
        });
        const badge = document.getElementById('wiadomosci-badge');
        if (nieprzeczytaneCnt > 0) {
            badge.innerText = nieprzeczytaneCnt;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

window.przelaczTabWiadomosci = function(tab) {
    aktualnyTabWiadomosci = tab;
    ['odebrane', 'wyslane', 'wszystkie'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    window.zaladujWiadomosci();
};

async function wypelnijAdresatowDoCheckboxow(zaznaczeni = []) {
    const container = document.getElementById('msg-odbiorcy-checkboxes');
    container.innerHTML = "Wczytywanie użytkowników...";
    try {
        const pracownicy = await pobierzListePracownikow();
        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        const zestaw = new Set((zaznaczeni || []).filter(Boolean));
        let html = "";
        pracownicy.forEach(u => {
            if (u.id === mojId) return;
            const chk = (zestaw.has(u.id) || zestaw.has(u.imie) || zestaw.has(u.imieKrotkie)) ? 'checked' : '';
            html += `<label style="display:flex; align-items:center; gap:8px; margin:5px 0; cursor:pointer; font-weight:normal;">
                <input type="checkbox" name="msg-odbiorca-chk" value="${ucieczkaHtml(u.id)}" data-imie="${ucieczkaHtml(u.imie || '')}" ${chk}>
                ${ucieczkaHtml(u.imie || u.login || '')}
            </label>`;
        });
        container.innerHTML = html || "<p class='text-muted' style='margin:0;'>Brak innych użytkowników.</p>";
    } catch (e) { container.innerHTML = "Błąd wczytywania."; }
}

window.otworzFormularzNowejWiadomosci = async function(domyslnyOdbiorca = null) {
    document.getElementById('modal-msg-tytul').innerText = "✉️ Nowa Wiadomość";
    document.getElementById('msg-tresc-input').value = "";
    document.getElementById('msg-zdjecie-input').value = "";
    document.getElementById('msg-zdjecie-preview').innerHTML = "";
    document.getElementById('msg-wazne-checkbox').checked = false;
    await wypelnijAdresatowDoCheckboxow(domyslnyOdbiorca ? [domyslnyOdbiorca] : []);
    document.getElementById('modal-nowa-wiadomosc').classList.remove('hidden');
};

window.zamknijModalNowejWiadomosci = () => document.getElementById('modal-nowa-wiadomosc').classList.add('hidden');

window.wyslijWiadomosc = async function() {
    const odbiorcy = Array.from(document.querySelectorAll('input[name="msg-odbiorca-chk"]:checked')).map(cb => ({
        id: cb.value,
        imie: cb.dataset.imie || cb.parentElement?.textContent?.trim() || cb.value
    }));
    const tresc = document.getElementById('msg-tresc-input').value.trim();
    const wazne = document.getElementById('msg-wazne-checkbox').checked;
    const fileInput = document.getElementById('msg-zdjecie-input');

    if (odbiorcy.length === 0) return alert("Wybierz przynajmniej jednego odbiorcę!");
    if (!tresc) return alert("Treść wiadomości nie może być pusta!");

    const nadawcaId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const nadawca = currentUserData ? currentUserData.imie : "Anonim";
    const odbiorcyIds = odbiorcy.map(o => o.id);
    const odbiorcyImiona = odbiorcy.map(o => o.imie);
    const odbiorcyStatus = {};
    odbiorcyIds.forEach(o => { odbiorcyStatus[o] = { przeczytane: false, dataOdczytu: null }; });

    const stworzIWyslij = async (zdjecieBase64 = null) => {
        try {
            await addDoc(collection(db, "wiadomosci"), {
                nadawcaId,
                nadawca,
                odbiorcyIds,
                odbiorcy: odbiorcyImiona,
                odbiorcyStatus,
                tresc,
                zdjecie: zdjecieBase64 || null,
                wazne,
                data: new Date().toISOString(),
                timestamp: Date.now()
            });
            if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
            alert("Wiadomość została wysłana!");
            window.zamknijModalNowejWiadomosci();
            window.zaladujWiadomosci();
        } catch (e) { alert("Błąd wysyłania wiadomości: " + e.message); }
    };

    if (fileInput.files?.length > 0) kompresujObraz(fileInput.files[0], stworzIWyslij);
    else await stworzIWyslij(null);
};

function czyWiadomoscDlaMnie(w, mojId, mojeImie) {
    if (!w) return false;
    if (Array.isArray(w.odbiorcyIds) && w.odbiorcyIds.length > 0) return w.odbiorcyIds.includes(mojId);
    return Array.isArray(w.odbiorcy) && w.odbiorcy.includes(mojeImie);
}

function czyWiadomoscOdeMnie(w, mojId, mojeImie) {
    if (!w) return false;
    if (w.nadawcaId) return w.nadawcaId === mojId;
    return w.nadawca === mojeImie;
}

function pobierzStatusWiadomosci(w, mojId, mojeImie) {
    if (!w?.odbiorcyStatus) return null;
    return w.odbiorcyStatus[mojId] || (mojeImie ? w.odbiorcyStatus[mojeImie] : null) || null;
}

function pobierzNazweOdbiorcy(w, klucz) {
    const idx = Array.isArray(w?.odbiorcyIds) ? w.odbiorcyIds.indexOf(klucz) : -1;
    return idx >= 0 ? (w.odbiorcy?.[idx] || klucz) : klucz;
}

window.zaladujWiadomosci = async function() {
    const container = document.getElementById('wiadomosci-lista-container');
    container.innerHTML = "Pobieranie wiadomości...";
    const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const mojeImie = currentUserData ? currentUserData.imie : "";
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    try {
        const snap = await getDocs(collection(db, "wiadomosci"));
        const lista = [];
        snap.forEach(d => {
            const w = { id: d.id, ...d.data() };
            if (aktualnyTabWiadomosci === 'odebrane' && czyWiadomoscDlaMnie(w, mojId, mojeImie)) lista.push(w);
            else if (aktualnyTabWiadomosci === 'wyslane' && czyWiadomoscOdeMnie(w, mojId, mojeImie)) lista.push(w);
            else if (aktualnyTabWiadomosci === 'wszystkie' && czyAdmin) lista.push(w);
        });

        lista.sort((a, b) => (b.timestamp || pobierzTimestamp(b.data)) - (a.timestamp || pobierzTimestamp(a.data)));

        if (lista.length === 0) {
            container.innerHTML = `<p class="text-muted" style="text-align:center; padding:20px;">Brak wiadomości w tej kategorii.</p>`;
            return;
        }

        let html = "";
        lista.forEach(w => {
            const st = pobierzStatusWiadomosci(w, mojId, mojeImie);
            const czyNieprzeczytana = (aktualnyTabWiadomosci === 'odebrane' && st && !st.przeczytane);
            const badgeUnread = czyNieprzeczytana ? `<span class="badge badge-danger" style="margin-right:4px;">NOWA</span>` : '';
            const badgeWazne = w.wazne ? `<span class="badge badge-pending" style="margin-right:4px;">⭐ WAŻNE</span>` : '';
            const badgeZdjecie = w.zdjecie ? `<span class="badge badge-info">📷 Zdjęcie</span>` : '';
            const adminDeleteBtn = czyAdmin ? `<button onclick="event.stopPropagation(); window.usunWiadomoscAdminBezposrednio('${ucieczkaJs(w.id)}')" class="btn-danger btn-sm">🗑️</button>` : '';

            html += `<div class="msg-item ${czyNieprzeczytana ? 'unread' : ''} ${w.wazne ? 'important' : ''}" onclick="window.otworzPodgladWiadomosci('${ucieczkaJs(w.id)}')">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                    <span><strong>Od:</strong> ${ucieczkaHtml(w.nadawca)} ➔ <strong>Do:</strong> ${ucieczkaHtml((w.odbiorcy || []).join(', ') || '-')}</span>
                    <div class="flex-row" style="gap:6px;">
                        <span class="text-muted" style="font-size:0.8em;">${ucieczkaHtml(formatujDateCzasDoWyswietlenia(w.data))}</span>
                        ${adminDeleteBtn}
                    </div>
                </div>
                <div style="margin-bottom:6px;">${badgeUnread}${badgeWazne}${badgeZdjecie}</div>
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ucieczkaHtml(w.tresc)}</div>
            </div>`;
        });
        container.innerHTML = html;
        sprawdzPowiadomieniaWiadomosci(mojId, mojeImie);
    } catch (e) { container.innerHTML = "Błąd ładowania wiadomości."; }
};

window.otworzPodgladWiadomosci = async function(id) {
    try {
        const docRef = doc(db, "wiadomosci", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return alert("Nie znaleziono wiadomości!");

        const w = { id: docSnap.id, ...docSnap.data() };
        aktualniePodgladanaWiadomosc = w;
        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        const mojeImie = currentUserData ? currentUserData.imie : "";
        const czyAdmin = currentUserData && currentUserData.rola === 'admin';

        const kluczStatusu = w.odbiorcyStatus?.[mojId] ? mojId : (w.odbiorcyStatus?.[mojeImie] ? mojeImie : null);
        if (kluczStatusu && !w.odbiorcyStatus[kluczStatusu].przeczytane) {
            w.odbiorcyStatus[kluczStatusu].przeczytane = true;
            w.odbiorcyStatus[kluczStatusu].dataOdczytu = new Date().toISOString();
            await setDoc(docRef, { odbiorcyStatus: w.odbiorcyStatus }, { merge: true });
        }

        document.getElementById('podglad-msg-id').value = w.id;
        document.getElementById('podglad-msg-naglowek').innerHTML = `
            <p style="margin:2px 0;"><strong>Od:</strong> ${ucieczkaHtml(w.nadawca)}</p>
            <p style="margin:2px 0;"><strong>Do:</strong> ${ucieczkaHtml((w.odbiorcy || []).join(', ') || '-')}</p>
            <p class="text-muted" style="margin:2px 0;"><strong>Data wysłania:</strong> ${ucieczkaHtml(formatujDateCzasDoWyswietlenia(w.data))}</p>
            ${w.wazne ? '<p style="margin:6px 0 0 0;" class="val-red">⭐ Wiadomość oznaczona jako WAŻNA.</p>' : ''}`;

        document.getElementById('podglad-msg-tresc').innerText = w.tresc || '';
        document.getElementById('podglad-msg-zdjecie-container').innerHTML = w.zdjecie
            ? `<img src="${w.zdjecie}" onclick="window.otworzZoomZdjecia('${ucieczkaJs(w.zdjecie)}')" style="max-width:100%; max-height:220px; border-radius:var(--radius-sm); cursor:pointer;" title="Kliknij, aby powiększyć">` : '';

        let statusyHtml = `<ul style="margin:4px 0 0 0; padding-left:20px;">`;
        if (w.odbiorcyStatus) {
            Object.keys(w.odbiorcyStatus).forEach(odb => {
                const st = w.odbiorcyStatus[odb];
                const nazwa = pobierzNazweOdbiorcy(w, odb);
                statusyHtml += st.przeczytane
                    ? `<li style="color:var(--success);">👁️ <strong>${ucieczkaHtml(nazwa)}</strong> — Odczytano (${ucieczkaHtml(formatujDateCzasDoWyswietlenia(st.dataOdczytu) || 'bd')})</li>`
                    : `<li style="color:var(--warning);">⏳ <strong>${ucieczkaHtml(nazwa)}</strong> — Nieprzeczytane</li>`;
            });
        }
        document.getElementById('podglad-msg-odbiorcy-statusy').innerHTML = statusyHtml + `</ul>`;

        document.getElementById('btn-usun-wiadomosc-admin').style.display = czyAdmin ? 'inline-flex' : 'none';
        document.getElementById('modal-podglad-wiadomosci').classList.remove('hidden');
    } catch (e) { alert("Błąd pobierania wiadomości."); }
};

window.zamknijModalPodgladuWiadomosci = () => {
    document.getElementById('modal-podglad-wiadomosci').classList.add('hidden');
    window.zaladujWiadomosci();
};

window.otworzOdpowiedzWiadomosc = function() {
    if (!aktualniePodgladanaWiadomosc) return;
    window.zamknijModalPodgladuWiadomosci();
    const nadawcaWiadomosci = aktualniePodgladanaWiadomosc.nadawca;
    const nadawcaId = aktualniePodgladanaWiadomosc.nadawcaId || nadawcaWiadomosci;
    window.otworzFormularzNowejWiadomosci(nadawcaId);
    document.getElementById('modal-msg-tytul').innerText = `↩️ Odpowiedź do: ${nadawcaWiadomosci}`;
    const tresc = String(aktualniePodgladanaWiadomosc.tresc || '');
    document.getElementById('msg-tresc-input').value = `\n\n--- Odpowiedź na wiadomość z dnia ${formatujDateCzasDoWyswietlenia(aktualniePodgladanaWiadomosc.data)} ---\n> ${tresc.replace(/\n/g, '\n> ')}`;
};

window.usunWiadomoscAdminBezposrednio = async function(id) {
    if (!confirm("Czy na pewno chcesz trwale usunąć tę wiadomość?")) return;
    try {
        await deleteDoc(doc(db, "wiadomosci", id));
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
        window.zaladujWiadomosci();
    } catch (e) { alert("Błąd usuwania: " + e.message); }
};

window.usunWiadomoscPrzezAdmina = async function() {
    const id = document.getElementById('podglad-msg-id').value;
    if (id && confirm("Czy na pewno chcesz usunąć tę wiadomość?")) {
        try {
            await deleteDoc(doc(db, "wiadomosci", id));
            if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
            document.getElementById('modal-podglad-wiadomosci').classList.add('hidden');
            window.zaladujWiadomosci();
        } catch (e) { alert("Błąd usuwania: " + e.message); }
    }
};
