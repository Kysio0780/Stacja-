'use strict';
// Moduł Sprzedaż (widok miesięczny/dzienny, raporty, plan).

/* ==================== SPRZEDAŻ ==================== */
window.pokazWidokMiesieczny = function() {
    document.getElementById('view-daily').classList.add('hidden');
    document.getElementById('view-monthly').classList.remove('hidden');
    if(!document.getElementById('wybrany-miesiac').value) document.getElementById('wybrany-miesiac').value = pobierzBiezacyOkresSystemowy().miesiacStr;
    window.zaladujMiesiacTabela();
    if (currentUserData?.rola === 'admin') pobierzRaportyDlaAdmina();
};

window.otworzDzien = async function(dataStr) {
    window.location.hash = "#dzien";
    document.getElementById('raport-data').value = dataStr;
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    document.getElementById('raport-data').disabled = !czyAdmin;
    await zaladujCheckboxySprzedawcow(dataStr);
};

async function zaladujCheckboxySprzedawcow(dataStr) {
    const container = document.getElementById('sprzedawcy-checkboxes-container');
    container.innerHTML = "Pobieranie listy...";
    try {
        const [uSnap, rDoc] = await Promise.all([
            getDocs(collection(db, "uzytkownicy")),
            getDoc(doc(db, "sprzedaz", dataStr))
        ]);
        const zapisani = rDoc.exists() ? (rDoc.data().sprzedawcy || []) : [];

        if (rDoc.exists()) {
            const d = rDoc.data();
            document.getElementById('kawa-ilosc').value = d.kawa?.ilosc || "";
            document.getElementById('kawa-wartosc').value = d.kawa?.wartosc || "";
            document.getElementById('hd-ilosc').value = d.hd?.ilosc || "";
            document.getElementById('hd-wartosc').value = d.hd?.wartosc || "";
            document.getElementById('sklep-wartosc').value = d.sklep?.wartosc || "";
        } else {
            ['kawa-ilosc', 'kawa-wartosc', 'hd-ilosc', 'hd-wartosc', 'sklep-wartosc'].forEach(id => document.getElementById(id).value = "");
        }

        let html = "";
        uSnap.forEach(docSnap => {
            const imieKrotkie = docSnap.data().imie.split(' ')[0];
            const isChecked = zapisani.length > 0
                ? zapisani.includes(imieKrotkie)
                : (currentUserData && imieKrotkie === currentUserData.imie.split(' ')[0]);
            html += `<label style="display:flex; align-items:center; gap:8px; margin:5px 0; cursor:pointer; font-weight:normal;"><input type="checkbox" name="raport-sprzedawca" value="${imieKrotkie}" ${isChecked ? 'checked' : ''}> ${docSnap.data().imie}</label>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
}

window.zmienDateWFormularzu = () => zaladujCheckboxySprzedawcow(document.getElementById('raport-data').value);

window.zaladujMiesiacTabela = async function() {
    const wybranyMiesiac = document.getElementById('wybrany-miesiac').value;
    if (!wybranyMiesiac) return;
    const tableContainer = document.getElementById('monthly-table-container');
    const plansContainer = document.getElementById('plans-container');
    tableContainer.innerHTML = "Pobieranie danych...";
    const [rok, miesiac] = wybranyMiesiac.split('-').map(Number);
    const dniWMiesiacu = new Date(rok, miesiac, 0).getDate();

    try {
        const [snap, planDoc] = await Promise.all([
            getDocs(collection(db, "sprzedaz")),
            getDoc(doc(db, "plany_miesieczne", wybranyMiesiac))
        ]);

        const raporty = {};
        let sKawaI = 0, sKawaW = 0, sHdI = 0, sHdW = 0, sSklepW = 0, sTotalW = 0;

        snap.forEach(d => {
            if (d.id.startsWith(wybranyMiesiac)) {
                const r = d.data();
                raporty[d.id] = r;
                const kI = Number(r.kawa?.ilosc)||0, kW = Number(r.kawa?.wartosc)||0;
                const hI = Number(r.hd?.ilosc)||0, hW = Number(r.hd?.wartosc)||0;
                const sW = Number(r.sklep?.wartosc)||0;
                sKawaI += kI; sKawaW += kW; sHdI += hI; sHdW += hW; sSklepW += sW; sTotalW += (kW + hW + sW);
            }
        });

        const czyAdmin = currentUserData && currentUserData.rola === 'admin';
        const plany = planDoc.exists() ? planDoc.data() : { kawa: 0, hd: 0, sklep: 0 };
        let ostatniDzienRaportu = 0;
        for (let d = 1; d <= dniWMiesiacu; d++) {
            if (raporty[`${wybranyMiesiac}-${String(d).padStart(2, '0')}`]) ostatniDzienRaportu = d;
        }
        const pt = ostatniDzienRaportu / dniWMiesiacu;

        const rowPlan = (nazwa, katKey, wyk, plan) => {
            const pProp = plan * pt, d100 = wyk - plan, dProp = wyk - pProp;
            const p100 = plan > 0 ? (wyk / plan) * 100 : 0, pP = pProp > 0 ? (wyk / pProp) * 100 : 0;
            const planCell = czyAdmin ? `<input type="number" step="0.01" id="plan-input-${katKey}" value="${plan}" onchange="window.zapiszPlanMiesieczny()" class="compact-input">` : `${plan.toFixed(2)}`;
            return `<tr><td><strong>${nazwa}</strong></td><td>${wyk.toFixed(2)}</td><td>${planCell}</td><td class="${p100>=100?'val-green':'val-red'}">${p100.toFixed(1)}%</td><td class="${d100>=0?'val-green':'val-red'}">${d100.toFixed(2)}</td><td>${pProp.toFixed(2)}</td><td class="${pP>=100?'val-green':'val-red'}">${pP.toFixed(1)}%</td><td class="${dProp>=0?'val-green':'val-red'}">${dProp.toFixed(2)}</td></tr>`;
        };

        plansContainer.innerHTML = `<p class="text-muted">Proporcja wg ostatniego raportu: Dzień ${ostatniDzienRaportu} z ${dniWMiesiacu} (${(pt*100).toFixed(1)}%)</p>
        <div class="table-responsive"><table class="month-table"><tr><th>Kat.</th><th>Wykon.</th><th>Plan</th><th>% Planu</th><th>Różnica</th><th>Plan prop.</th><th>% Prop.</th><th>Różnica</th></tr>
        ${rowPlan('☕ Kawa', 'kawa', sKawaW, plany.kawa || 0)}
        ${rowPlan('🌭 HD', 'hd', sHdW, plany.hd || 0)}
        ${rowPlan('🛒 Sklep', 'sklep', sSklepW, plany.sklep || 0)}</table></div>`;

        let tableHtml = `<div class="table-responsive"><table class="month-table"><tr><th style="width: 45px;">Dzień</th><th>Kawa (szt / zł)</th><th>HD (szt / zł)</th><th>Sklep (zł)</th><th>Suma (zł)</th></tr>`;
        for (let d = 1; d <= dniWMiesiacu; d++) {
            const dStr = `${wybranyMiesiac}-${String(d).padStart(2, '0')}`;
            const r = raporty[dStr];
            if (r) {
                const sumD = (Number(r.kawa?.wartosc)||0) + (Number(r.hd?.wartosc)||0) + (Number(r.sklep?.wartosc)||0);
                tableHtml += `<tr class="cleaning-row" onclick="window.otworzDzien('${dStr}')"><td><strong>${d}</strong></td><td>${r.kawa?.ilosc||0} / ${(Number(r.kawa?.wartosc)||0).toFixed(2)}</td><td>${r.hd?.ilosc||0} / ${(Number(r.hd?.wartosc)||0).toFixed(2)}</td><td>${(Number(r.sklep?.wartosc)||0).toFixed(2)}</td><td><strong>${sumD.toFixed(2)}</strong></td></tr>`;
            } else {
                tableHtml += `<tr class="cleaning-row" style="opacity:0.75;" onclick="window.otworzDzien('${dStr}')"><td>${d}</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
            }
        }
        tableHtml += `<tr class="sum-row"><td>SUMA</td><td>${sKawaI} / ${sKawaW.toFixed(2)}</td><td>${sHdI} / ${sHdW.toFixed(2)}</td><td>${sSklepW.toFixed(2)}</td><td>${sTotalW.toFixed(2)}</td></tr></table></div>`;
        tableContainer.innerHTML = tableHtml;
    } catch (e) { tableContainer.innerHTML = "Błąd ładowania."; }
};

window.zapiszPlanMiesieczny = async function() {
    const wybranyMiesiac = document.getElementById('wybrany-miesiac').value;
    try {
        await setDoc(doc(db, "plany_miesieczne", wybranyMiesiac), {
            kawa: Number(document.getElementById('plan-input-kawa').value) || 0,
            hd: Number(document.getElementById('plan-input-hd').value) || 0,
            sklep: Number(document.getElementById('plan-input-sklep').value) || 0
        });
        window.zaladujMiesiacTabela();
    } catch (e) { alert("Błąd zapisu planu."); }
};

window.zapiszSprzedaz = async function() {
    const data = document.getElementById('raport-data').value;
    const zaznaczeni = Array.from(document.querySelectorAll('input[name="raport-sprzedawca"]:checked')).map(cb => cb.value);
    if (!data || zaznaczeni.length === 0) return alert("Wybierz datę oraz zaznacz minimum jednego sprzedawcę!");

    const btn = document.getElementById('btn-zapisz-raport');
    btn.disabled = true; btn.innerText = "Zapisywanie...";

    try {
        await setDoc(doc(db, "sprzedaz", data), {
            data, sprzedawcy: zaznaczeni,
            kawa: { ilosc: Number(document.getElementById('kawa-ilosc').value)||0, wartosc: Number(document.getElementById('kawa-wartosc').value)||0 },
            hd: { ilosc: Number(document.getElementById('hd-ilosc').value)||0, wartosc: Number(document.getElementById('hd-wartosc').value)||0 },
            sklep: { wartosc: Number(document.getElementById('sklep-wartosc').value)||0 },
            ostatniaModyfikacjaPrzez: currentUserData ? currentUserData.imie.split(' ')[0] : "Pracownik",
            czasModyfikacji: new Date().toLocaleString()
        });
        alert("Raport został zapisany!");
        window.location.hash = "#sprzedaz";
    } catch (e) { alert("Błąd zapisu: " + e.message); }
    finally { btn.disabled = false; btn.innerText = "💾 Zapisz / Aktualizuj Raport"; }
};

async function pobierzRaportyDlaAdmina() {
    const list = document.getElementById('reports-list');
    const mStr = document.getElementById('wybrany-miesiac').value;
    try {
        const snap = await getDocs(collection(db, "sprzedaz"));
        let html = "";
        snap.forEach(d => {
            const r = d.data();
            if (r.data && r.data.startsWith(mStr)) {
                const osoby = r.sprzedawcy ? r.sprzedawcy.join(', ') : (r.pracownik || 'Brak');
                html += `<div class="report-box" onclick="window.otworzDzien('${r.data}')">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong>📅 ${r.data}</strong>
                        <span class="badge badge-info">${osoby}</span>
                    </div>
                    <div style="font-size:0.9em;">☕ ${r.kawa?.ilosc||0} (${(Number(r.kawa?.wartosc)||0).toFixed(2)} zł) | 🌭 ${r.hd?.ilosc||0} (${(Number(r.hd?.wartosc)||0).toFixed(2)} zł) | 🛒 ${(Number(r.sklep?.wartosc)||0).toFixed(2)} zł</div>
                    <div class="audit-info">Edycja: ${r.ostatniaModyfikacjaPrzez} (${r.czasModyfikacji})</div>
                </div>`;
            }
        });
        list.innerHTML = html || "<p class='text-muted'>Brak raportów w wybranym miesiącu.</p>";
    } catch (e) { list.innerHTML = "Błąd."; }
}
