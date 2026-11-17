'use strict';
// Moduł TPSy (powiadomienia, lista, komentarze, przecena).

/* ==================== MODUŁ TPSy ==================== */

async function sprawdzPowiadomieniaTpsGlobal() {
    try {
        const dzisiajStr = pobierzDzisiejszaDateStr();
        const snap = await getDocs(collection(db, "tpsy"));
        let jestDzisiaj = false;
        snap.forEach(d => { if (d.data().tps === dzisiajStr) jestDzisiaj = true; });
        const badge = document.getElementById('tpsy-badge');
        if (badge) badge.classList.toggle('hidden', !jestDzisiaj);
    } catch (e) { console.error(e); }
}

window.toggleFormularzDodajTps = function(forceState) {
    const form = document.getElementById('tpsy-dodaj-form');
    if (typeof forceState === 'boolean') form.classList.toggle('hidden', !forceState);
    else form.classList.toggle('hidden');

    if (!form.classList.contains('hidden')) {
        document.getElementById('tps-nowy-nazwa').value = "";
        document.getElementById('tps-nowy-data').value = "";
        document.getElementById('tps-nowy-nazwa').focus();
    }
};

window.zapiszNowyTps = async function() {
    const nazwa = document.getElementById('tps-nowy-nazwa').value.trim();
    const tps = document.getElementById('tps-nowy-data').value;
    if (!nazwa || !tps) return alert("Wpisz nazwę towaru oraz wybierz datę TPS!");

    try {
        await addDoc(collection(db, "tpsy"), {
            nazwa, tps, przeceniony: false, komentarz: "", timestamp: Date.now()
        });
        window.toggleFormularzDodajTps(false);
        await window.zaladujModulTps();
        sprawdzPowiadomieniaTpsGlobal();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.zaladujModulTps = async function() {
    const container = document.getElementById('tpsy-lista-container');
    container.innerHTML = "Pobieranie listy towarów...";
    try {
        const snap = await getDocs(collection(db, "tpsy"));
        listaTowarowTps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        listaTowarowTps.sort((a, b) => (a.tps || "").localeCompare(b.tps || ""));
        window.renderujListeTps();
        sprawdzPowiadomieniaTpsGlobal();
    } catch (e) {
        container.innerHTML = `<span class='error'>Błąd ładowania listy TPS: ${e.message}</span>`;
    }
};

window.renderujListeTps = function() {
    const container = document.getElementById('tpsy-lista-container');
    const ukryjPrzeterminowane = document.getElementById('tpsy-filtr-ukryj-przeterminowane').checked;
    const dzisiajStr = pobierzDzisiejszaDateStr();
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    const przefiltrowane = listaTowarowTps.filter(item => !(ukryjPrzeterminowane && item.tps && item.tps < dzisiajStr));

    if (przefiltrowane.length === 0) {
        container.innerHTML = `<p class="text-muted" style="text-align:center; padding:20px;">Brak pozycji do wyświetlenia.</p>`;
        return;
    }

    let html = `<div class="table-responsive"><table class="standard-table">
        <tr>
            <th style="text-align:left;">Nazwa towaru</th>
            <th style="width: 100px;">TPS</th>
            <th style="width: 120px;">Komentarz</th>
            <th style="width: 70px;">Przecena</th>
            ${czyAdmin ? '<th style="width: 50px;">Usuń</th>' : ''}
        </tr>`;

    przefiltrowane.forEach(item => {
        const czyDzisiaj = item.tps === dzisiajStr;
        const czyPrzeterminowany = item.tps && item.tps < dzisiajStr;

        let ikonaStatusu = "";
        let dateStyle = "";
        if (czyPrzeterminowany) {
            ikonaStatusu = `<span class="badge badge-danger" style="margin-right:4px;" title="TPS przekroczony">!</span>`;
            dateStyle = "color: var(--danger); font-weight: 700;";
        } else if (czyDzisiaj) {
            ikonaStatusu = `<span class="badge badge-pending" style="margin-right:4px;" title="TPS do dzisiaj">!</span>`;
            dateStyle = "color: var(--warning); font-weight: 700;";
        }

        const rowClass = item.przeceniony ? "tps-row-discounted" : "";
        const przecenaInput = `<input type="checkbox" ${item.przeceniony ? 'checked' : ''} ${!czyAdmin ? 'disabled' : ''} onchange="window.zmienPrzeceneTps('${item.id}', this.checked)">`;
        const adminCols = czyAdmin ? `<td><button onclick="window.usunTps('${item.id}')" class="btn-danger btn-sm">🗑️</button></td>` : '';

        html += `<tr class="${rowClass}">
            <td style="text-align:left;">${ikonaStatusu}<strong>${ucieczkaHtml(item.nazwa)}</strong></td>
            <td style="${dateStyle}">${ucieczkaHtml(item.tps)}</td>
            <td><input type="text" value="${ucieczkaHtml(item.komentarz || '')}" onchange="window.zapiszKomentarzTps('${item.id}', this.value)" class="tps-comment-input"></td>
            <td>${przecenaInput}</td>
            ${adminCols}
        </tr>`;
    });

    container.innerHTML = html + `</table></div>`;
};

window.zmienPrzeceneTps = async function(id, czyPrzeceniony) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    try {
        await setDoc(doc(db, "tpsy", id), { przeceniony: czyPrzeceniony }, { merge: true });
        const pozycja = listaTowarowTps.find(x => x.id === id);
        if (pozycja) pozycja.przeceniony = czyPrzeceniony;
        window.renderujListeTps();
    } catch (e) { alert("Błąd zapisu przeceny: " + e.message); }
};

window.zapiszKomentarzTps = async function(id, komentarz) {
    try {
        await setDoc(doc(db, "tpsy", id), { komentarz }, { merge: true });
        const pozycja = listaTowarowTps.find(x => x.id === id);
        if (pozycja) pozycja.komentarz = komentarz;
    } catch (e) { alert("Błąd zapisu komentarza: " + e.message); }
};

window.usunTps = async function(id) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    if (!confirm("Czy na pewno chcesz usunąć ten towar z listy TPS?")) return;
    try {
        await deleteDoc(doc(db, "tpsy", id));
        listaTowarowTps = listaTowarowTps.filter(x => x.id !== id);
        window.renderujListeTps();
        sprawdzPowiadomieniaTpsGlobal();
    } catch (e) { alert("Błąd usuwania: " + e.message); }
};
