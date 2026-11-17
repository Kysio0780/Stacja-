'use strict';
// Grafik: prośby o zmiany w grafiku.

/* Prośby o zmiany w grafiku */
window.wyslijProsbe = async function() {
    const wybranyMiesiac = document.getElementById('grafik-miesiac').value;
    const tekst = document.getElementById('nowa-prosba-tekst').value.trim();
    if (!wybranyMiesiac || !tekst) return alert("Uzupełnij miesiąc i treść prośby!");
    try {
        await addDoc(collection(db, "prosby_o_zmiany"), {
            miesiac: wybranyMiesiac, autor: currentUserData?.imie.split(' ')[0] || "Pracownik",
            tekst, status: "oczekujace", data: new Date().toLocaleString()
        });
        document.getElementById('nowa-prosba-tekst').value = "";
        zaladujProsby(wybranyMiesiac);
    } catch (e) { alert("Błąd."); }
};

window.zmienStatusProsby = async function(id, status) {
    await setDoc(doc(db, "prosby_o_zmiany", id), { status }, { merge: true });
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

        let html = "";
        prosby.reverse().forEach(p => {
            const badge = p.status === "zatwierdzone"
                ? `<span class="badge badge-done">👍 Zatwierdzone</span>`
                : (p.status === "odrzucone" ? `<span class="badge badge-danger">👎 Odrzucone</span>` : `<span class="badge badge-pending">⏳ Oczekuje</span>`);
            
            const actions = (currentUserData?.rola === 'admin')
                ? `<button onclick="window.zmienStatusProsby('${p.id}', 'zatwierdzone')" class="btn-success btn-sm">👍 Zatwierdź</button>
                   <button onclick="window.zmienStatusProsby('${p.id}', 'odrzucone')" class="btn-danger btn-sm">👎 Odrzuć</button>`
                : "";
            const delBtn = (currentUserData?.rola === 'admin' || currentUserData?.imie.split(' ')[0] === p.autor)
                ? `<button onclick="window.usunProsbe('${p.id}')" class="btn-neutral btn-sm">🗑️ Usuń</button>`
                : "";

            html += `<div class="request-item">
                <div style="display:flex; justify-content:space-between; align-items:center;"><strong>👤 ${p.autor}</strong>${badge}</div>
                <div class="text-muted" style="font-size:0.8em; margin-bottom:6px;">${p.data}</div>
                <div style="margin-bottom:8px;">${ucieczkaHtml(p.tekst)}</div>
                <div class="flex-row" style="gap:6px; flex-wrap:wrap;">${actions}${delBtn}</div>
            </div>`;
        });
        listaContainer.innerHTML = html;
    } catch (e) { listaContainer.innerHTML = "Błąd."; }
}
