'use strict';
// Grafik: prośby o zmiany w grafiku.

/* Prośby o zmiany w grafiku */
window.wyslijProsbe = async function() {
    const wybranyMiesiac = document.getElementById('grafik-miesiac').value;
    const tekst = document.getElementById('nowa-prosba-tekst').value.trim();
    if (!wybranyMiesiac || !tekst) return alert("Uzupełnij miesiąc i treść prośby!");
    try {
        await addDoc(collection(db, "prosby_o_zmiany"), {
            miesiac: wybranyMiesiac,
            autorId: currentUserData ? (currentUserData.uid || currentUserData.id) : "",
            autor: currentUserData ? currentUserData.imie : "Pracownik",
            tekst,
            status: STATUSY_PROSB.OCZEKUJACE,
            data: new Date().toISOString(),
            timestamp: Date.now()
        });
        document.getElementById('nowa-prosba-tekst').value = "";
        zaladujProsby(wybranyMiesiac);
    } catch (e) { alert("Błąd."); }
};

window.zmienStatusProsby = async function(id, status) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    await setDoc(doc(db, "prosby_o_zmiany", id), {
        status,
        updatedAt: new Date().toISOString()
    }, { merge: true });
    zaladujProsby(document.getElementById('grafik-miesiac').value);
};

window.usunProsbe = async function(id) {
    if (confirm("Usunąć prośbę?")) {
        await deleteDoc(doc(db, "prosby_o_zmiany", id));
        zaladujProsby(document.getElementById('grafik-miesiac').value);
    }
};

async function zaladujProsby(miesiac) {
    const listaContainer = document.getElementById('prośby-lista-container');
    listaContainer.innerHTML = "Pobieranie próśb...";
    try {
        const snap = await getDocs(collection(db, "prosby_o_zmiany"));
        const prosby = [];
        snap.forEach(d => { if (d.data().miesiac === miesiac) prosby.push({ id: d.id, ...d.data() }); });
        if (prosby.length === 0) { listaContainer.innerHTML = "<p class='text-muted'>Brak próśb w tym miesiącu.</p>"; return; }

        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        const mojeImie = currentUserData ? currentUserData.imie : "";
        let html = "";
        prosby.reverse().forEach(p => {
            const badge = p.status === STATUSY_PROSB.ZATWIERDZONE
                ? `<span class="badge badge-done">👍 Zatwierdzone</span>`
                : (p.status === STATUSY_PROSB.ODRZUCONE ? `<span class="badge badge-danger">👎 Odrzucone</span>` : `<span class="badge badge-pending">⏳ Oczekuje</span>`);

            const actions = (currentUserData?.rola === 'admin')
                ? `<button onclick="window.zmienStatusProsby('${ucieczkaJs(p.id)}', '${STATUSY_PROSB.ZATWIERDZONE}')" class="btn-success btn-sm">👍 Zatwierdź</button>
                   <button onclick="window.zmienStatusProsby('${ucieczkaJs(p.id)}', '${STATUSY_PROSB.ODRZUCONE}')" class="btn-danger btn-sm">👎 Odrzuć</button>`
                : "";
            const delBtn = (currentUserData?.rola === 'admin' || czyPracownikPasuje(p, mojId, mojeImie))
                ? `<button onclick="window.usunProsbe('${ucieczkaJs(p.id)}')" class="btn-neutral btn-sm">🗑️ Usuń</button>`
                : "";

            html += `<div class="request-item">
                <div style="display:flex; justify-content:space-between; align-items:center;"><strong>👤 ${ucieczkaHtml(p.autor || '')}</strong>${badge}</div>
                <div class="text-muted" style="font-size:0.8em; margin-bottom:6px;">${ucieczkaHtml(formatujDateCzasDoWyswietlenia(p.data))}</div>
                <div style="margin-bottom:8px;">${ucieczkaHtml(p.tekst)}</div>
                <div class="flex-row" style="gap:6px; flex-wrap:wrap;">${actions}${delBtn}</div>
            </div>`;
        });
        listaContainer.innerHTML = html;
    } catch (e) { listaContainer.innerHTML = "Błąd."; }
}
