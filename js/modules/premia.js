'use strict';
// Moduł Premia (warunki, pula, dodatkowa premia, wliczanie pracowników).

/* ==================== MODUŁ PREMIA ==================== */
let tymczasoweWarunkiAdmin = [];

async function pobierzUzytkownikowMap() {
    const snap = await getDocs(collection(db, "uzytkownicy"));
    const lista = [];
    const adminSet = new Set();
    snap.forEach(d => {
        const data = d.data();
        const imieKrotkie = data.imie.split(' ')[0];
        if (!lista.includes(imieKrotkie)) lista.push(imieKrotkie);
        if (data.rola === 'admin') adminSet.add(imieKrotkie);
    });
    return { lista, adminSet };
}

function aktualizujSelectDocelowoWarunku(pracownicyList) {
    const sel = document.getElementById('admin-nowy-warunek-docelowo');
    if (!sel) return;
    let html = `<option value="wszyscy">Wszyscy pracownicy</option>`;
    pracownicyList.forEach(p => { html += `<option value="${p}">${p}</option>`; });
    sel.innerHTML = html;
}

window.dodajWarunekPremiaAdmin = function() {
    const opis = document.getElementById('admin-nowy-warunek-opis').value.trim();
    const docelowo = document.getElementById('admin-nowy-warunek-docelowo').value;
    if (!opis) return alert("Wpisz opis warunku!");

    tymczasoweWarunkiAdmin.push({ id: 'w_' + Date.now(), opis, docelowo });
    document.getElementById('admin-nowy-warunek-opis').value = "";
    wyswietlWarunkiWPaneluAdmina();
};

window.usunWarunekPremiaAdmin = function(id) {
    tymczasoweWarunkiAdmin = tymczasoweWarunkiAdmin.filter(w => w.id !== id);
    wyswietlWarunkiWPaneluAdmina();
};

function wyswietlWarunkiWPaneluAdmina() {
    const container = document.getElementById('admin-warunki-lista-container');
    if (!container) return;
    if (tymczasoweWarunkiAdmin.length === 0) {
        container.innerHTML = `<p class="text-muted" style="margin:0;">Brak zdefiniowanych warunków premii.</p>`;
        return;
    }

    let html = "";
    tymczasoweWarunkiAdmin.forEach((w, idx) => {
        const docLabel = w.docelowo === 'wszyscy' ? 'Wszyscy' : `Pracownik: ${w.docelowo}`;
        html += `<div style="background:var(--card-bg); padding:10px; margin-bottom:6px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div><strong>${idx + 1}. ${w.opis}</strong> <span style="font-size:0.82em; color:var(--primary);">(${docLabel})</span></div>
            <div class="flex-row" style="gap:6px; flex-shrink:0;">
                <button onclick="window.otworzSzczegolyWarunkuAdmin('${w.id}')" class="btn-info btn-sm">📋 Statusy</button>
                <button onclick="window.usunWarunekPremiaAdmin('${w.id}')" class="btn-danger btn-sm">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

window.otworzSzczegolyWarunkuAdmin = async function(warunekId) {
    const m = document.getElementById('premia-miesiac').value;
    const warunek = tymczasoweWarunkiAdmin.find(w => w.id === warunekId);
    if (!warunek) return;

    const { lista: pracownicyList } = await pobierzUzytkownikowMap();
    let html = `<p style="margin-top:0;"><strong>Warunek:</strong> ${warunek.opis}</p>`;
    html += `<p class="text-muted">Zaznacz pracowników, którzy spełnili warunek:</p>`;
    html += `<div style="max-height:250px; overflow-y:auto; border:1px solid var(--border-color); padding:10px; border-radius:var(--radius-sm); background:var(--card-bg);">`;

    const dotyczeni = pracownicyList.filter(p => warunek.docelowo === 'wszyscy' || warunek.docelowo === p);
    dotyczeni.forEach(p => {
        const spelnione = warunek.spelnioneMap ? !!warunek.spelnioneMap[p] : false;
        html += `<label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer; font-weight:normal;"><input type="checkbox" ${spelnione ? 'checked' : ''} onchange="window.toggleSpelnienieWarunkuAdminModal('${m}', '${warunekId}', '${p}', this.checked)"> ${p}</label>`;
    });
    html += `</div>`;

    document.getElementById('modal-pw-tytul').innerText = "📋 Spełnienie warunku";
    document.getElementById('modal-pw-tresc').innerHTML = html;
    document.getElementById('modal-premia-warunki').classList.remove('hidden');
};

window.toggleSpelnienieWarunkuAdminModal = async function(m, warunekId, pracownik, spelnione) {
    tymczasoweWarunkiAdmin.forEach(w => {
        if (w.id === warunekId) {
            if (!w.spelnioneMap) w.spelnioneMap = {};
            w.spelnioneMap[pracownik] = spelnione;
        }
    });
    await window.zapiszStanWarunkuPracownika(m, tymczasoweWarunkiAdmin);
};

window.zamknijModalPremiaWarunki = () => {
    document.getElementById('modal-premia-warunki').classList.add('hidden');
    window.zaladujModulPremia();
};

window.zapiszPuleIPulaWarunkowAdmin = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    const m = document.getElementById('premia-miesiac').value;
    if (!m) return alert("Wybierz miesiąc!");

    try {
        await setDoc(doc(db, "premie_pule", m), {
            kawa: Number(document.getElementById('admin-pula-kawa').value) || 0,
            hd: Number(document.getElementById('admin-pula-hd').value) || 0,
            sklep: Number(document.getElementById('admin-pula-sklep').value) || 0,
            warunki: tymczasoweWarunkiAdmin
        }, { merge: true });
        alert("Zapisano konfigurację premii!");
        window.zaladujModulPremia();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.zapiszStanWarunkuPracownika = async function(m, warunkiZaktualizowane) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    try {
        await setDoc(doc(db, "premie_pule", m), { warunki: warunkiZaktualizowane }, { merge: true });
    } catch (e) { console.error(e); }
};

window.zapiszWliczenieDoPremiiAdmin = async function(m, pracownik, czyWliczony, powod) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    try {
        await setDoc(doc(db, "premie_statusy", `${m}_${pracownik}`), {
            wliczony: czyWliczony, powod: powod || ""
        }, { merge: true });
        window.zaladujModulPremia();
    } catch (e) { alert("Błąd zapisu statusu: " + e.message); }
};

window.zapiszDodatkowaPremiaAdmin = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    const m = document.getElementById('premia-miesiac').value;
    const pracownik = document.getElementById('admin-dp-pracownik').value;
    const kwota = Number(document.getElementById('admin-dp-kwota').value);
    const opis = document.getElementById('admin-dp-opis').value.trim();

    if (!m || !pracownik || isNaN(kwota)) return alert("Wybierz pracownika i podaj kwotę premii!");
    if (!opis) return alert("Musisz podać opis (za co) dla dodatkowej premii!");

    try {
        await setDoc(doc(db, "premie_dodatkowe", `${m}_${pracownik}`), {
            miesiac: m, pracownik, kwota, opis, autor: currentUserData.imie
        });
        alert("Dodatkowa premia została zapisana!");
        document.getElementById('admin-dp-kwota').value = "";
        document.getElementById('admin-dp-opis').value = "";
        window.zaladujModulPremia();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.usunDodatkowaPremiaAdmin = async function(docId) {
    if (!confirm("Czy na pewno chcesz usunąć tę dodatkową premię?")) return;
    try {
        await deleteDoc(doc(db, "premie_dodatkowe", docId));
        window.zaladujModulPremia();
    } catch (e) { alert("Błąd usuwania: " + e.message); }
};

window.zaladujModulPremia = async function() {
    const m = document.getElementById('premia-miesiac').value;
    const container = document.getElementById('premia-wyniki-container');
    if (!m) return;
    container.innerHTML = "Pobieranie i obliczanie danych premii...";

    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    try {
        const [{ lista: pracownicyList, adminSet }, puleDoc, sprzedazSnap, dpSnap] = await Promise.all([
            pobierzUzytkownikowMap(),
            getDoc(doc(db, "premie_pule", m)),
            getDocs(collection(db, "sprzedaz")),
            getDocs(collection(db, "premie_dodatkowe"))
        ]);

        if (czyAdmin) aktualizujSelectDocelowoWarunku(pracownicyList);

        const pule = puleDoc.exists() ? puleDoc.data() : { kawa: 0, hd: 0, sklep: 0, warunki: [] };
        tymczasoweWarunkiAdmin = pule.warunki || [];

        if (czyAdmin) {
            document.getElementById('admin-pula-kawa').value = pule.kawa || '';
            document.getElementById('admin-pula-hd').value = pule.hd || '';
            document.getElementById('admin-pula-sklep').value = pule.sklep || '';
            wyswietlWarunkiWPaneluAdmina();
        }

        const statusyDocs = await Promise.all(pracownicyList.map(p => getDoc(doc(db, "premie_statusy", `${m}_${p}`))));
        const statusyPremiaMap = {};
        pracownicyList.forEach((p, idx) => {
            statusyPremiaMap[p] = statusyDocs[idx].exists()
                ? statusyDocs[idx].data()
                : { wliczony: !adminSet.has(p), powod: "" };
        });

        let sumaKawaSklep = 0, sumaHdSklep = 0, sumaSklepSklep = 0;
        const sprzedazPracownikow = {};

        sprzedazSnap.forEach(d => {
            const r = d.data();
            if (r.data && r.data.startsWith(m)) {
                const kVal = Number(r.kawa?.wartosc) || 0;
                const hVal = Number(r.hd?.wartosc) || 0;
                const sVal = Number(r.sklep?.wartosc) || 0;

                sumaKawaSklep += kVal;
                sumaHdSklep += hVal;
                sumaSklepSklep += sVal;

                const osoby = r.sprzedawcy || [];
                const cnt = osoby.length;
                if (cnt > 0) {
                    osoby.forEach(osoba => {
                        if (!sprzedazPracownikow[osoba]) sprzedazPracownikow[osoba] = { kawa: 0, hd: 0, sklep: 0 };
                        sprzedazPracownikow[osoba].kawa += kVal / cnt;
                        sprzedazPracownikow[osoba].hd += hVal / cnt;
                        sprzedazPracownikow[osoba].sklep += sVal / cnt;
                    });
                }
            }
        });

        const dodatkowePremieMap = {};
        dpSnap.forEach(d => {
            const dp = d.data();
            if (dp.miesiac === m) {
                if (!dodatkowePremieMap[dp.pracownik]) dodatkowePremieMap[dp.pracownik] = [];
                dodatkowePremieMap[dp.pracownik].push({ id: d.id, ...dp });
            }
        });

        const wliczeniPracownicy = pracownicyList.filter(p => statusyPremiaMap[p]?.wliczony);
        const danePracownikowWyniki = {};

        pracownicyList.forEach(prac => {
            const czyWliczony = statusyPremiaMap[prac]?.wliczony ?? true;
            if (!czyWliczony) {
                danePracownikowWyniki[prac] = { kawa: 0, hd: 0, sklep: 0, dodatkowe: 0, total: 0, wliczony: false };
                return;
            }

            const pSprzedaz = sprzedazPracownikow[prac] || { kawa: 0, hd: 0, sklep: 0 };
            const kwotaKawa = (Number(pule.kawa) || 0) * (sumaKawaSklep > 0 ? pSprzedaz.kawa / sumaKawaSklep : 0);
            const kwotaHd = (Number(pule.hd) || 0) * (sumaHdSklep > 0 ? pSprzedaz.hd / sumaHdSklep : 0);
            const kwotaSklep = (Number(pule.sklep) || 0) * (sumaSklepSklep > 0 ? pSprzedaz.sklep / sumaSklepSklep : 0);

            const sumaDodatkowych = (dodatkowePremieMap[prac] || []).reduce((acc, dp) => acc + (Number(dp.kwota) || 0), 0);

            danePracownikowWyniki[prac] = {
                kawa: kwotaKawa, hd: kwotaHd, sklep: kwotaSklep,
                dodatkowe: sumaDodatkowych,
                total: kwotaKawa + kwotaHd + kwotaSklep + sumaDodatkowych,
                wliczony: true
            };
        });

        const rankingKawa = [...wliczeniPracownicy].sort((a, b) => danePracownikowWyniki[b].kawa - danePracownikowWyniki[a].kawa);
        const rankingHd = [...wliczeniPracownicy].sort((a, b) => danePracownikowWyniki[b].hd - danePracownikowWyniki[a].hd);
        const rankingSklep = [...wliczeniPracownicy].sort((a, b) => danePracownikowWyniki[b].sklep - danePracownikowWyniki[a].sklep);
        const rankingTotal = [...wliczeniPracownicy].sort((a, b) => danePracownikowWyniki[b].total - danePracownikowWyniki[a].total);

        const pobierzMiejsce = (prac, ranking) => {
            if (!danePracownikowWyniki[prac]?.wliczony) return "-";
            const idx = ranking.indexOf(prac);
            return idx !== -1 ? idx + 1 : "-";
        };

        let html = "";

        if (czyAdmin) {
            html += `<h4>📊 Podsumowanie Premii Zespołu (${m})</h4>`;
            html += `<div class="table-responsive"><table class="standard-table">
                <tr><th style="text-align:left;">Pracownik</th><th>☕ Kawa</th><th>🌭 HD</th><th>🛒 Sklep</th><th>➕ Dodatkowa</th><th>💰 RAZEM</th></tr>`;
            
            let sumTotalAll = 0, sumKawaAll = 0, sumHdAll = 0, sumSklepAll = 0, sumDodAll = 0;

            pracownicyList.forEach(prac => {
                const w = danePracownikowWyniki[prac];
                const st = statusyPremiaMap[prac] || { wliczony: true, powod: "" };

                if (w.wliczony) {
                    sumKawaAll += w.kawa; sumHdAll += w.hd; sumSklepAll += w.sklep; sumDodAll += w.dodatkowe; sumTotalAll += w.total;
                }

                const dodatkoweOpisyHtml = (dodatkowePremieMap[prac] || []).map(dp =>
                    `<br><span class="text-muted" style="font-size:0.8em;">${dp.opis}: <strong>${Number(dp.kwota).toFixed(2)} zł</strong> <button onclick="window.usunDodatkowaPremiaAdmin('${dp.id}')" class="btn-danger" style="padding:1px 5px; font-size:0.75em; width:auto; margin:0;">x</button></span>`
                ).join('');

                const powodInput = !st.wliczony
                    ? `<br><input type="text" value="${st.powod || ''}" placeholder="Powód braku premii..." onchange="window.zapiszPowodBrakPremiiAdmin('${m}', '${prac}', this.value)" style="font-size:0.8em; padding:4px; margin:4px 0 0 0; width:145px;">`
                    : '';

                html += `<tr>
                    <td style="text-align:left;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" ${st.wliczony ? 'checked' : ''} onchange="window.zmienWliczeniePracownikaAdmin('${m}', '${prac}', this.checked)" title="Kwalifikacja do premii">
                            <div><strong>${prac}</strong>${powodInput}</div>
                        </div>
                    </td>
                    <td>${w.wliczony ? `${w.kawa.toFixed(2)} <span class="text-muted">(#${pobierzMiejsce(prac, rankingKawa)})</span>` : '-'}</td>
                    <td>${w.wliczony ? `${w.hd.toFixed(2)} <span class="text-muted">(#${pobierzMiejsce(prac, rankingHd)})</span>` : '-'}</td>
                    <td>${w.wliczony ? `${w.sklep.toFixed(2)} <span class="text-muted">(#${pobierzMiejsce(prac, rankingSklep)})</span>` : '-'}</td>
                    <td>${w.dodatkowe.toFixed(2)} ${dodatkoweOpisyHtml}</td>
                    <td class="val-green">${w.wliczony ? `${w.total.toFixed(2)} <span class="text-muted">(#${pobierzMiejsce(prac, rankingTotal)})</span>` : '0.00 (Brak)'}</td>
                </tr>`;
            });

            html += `<tr class="sum-row">
                <td style="text-align:left;">SUMA (TOTAL)</td>
                <td>${sumKawaAll.toFixed(2)} zł</td>
                <td>${sumHdAll.toFixed(2)} zł</td>
                <td>${sumSklepAll.toFixed(2)} zł</td>
                <td>${sumDodAll.toFixed(2)} zł</td>
                <td class="val-green">${sumTotalAll.toFixed(2)} zł</td>
            </tr></table></div>`;

        } else {
            const mojeImieKrotkie = (currentUserData?.imie || "").split(' ')[0];
            const mojeSt = statusyPremiaMap[mojeImieKrotkie] || { wliczony: true, powod: "" };
            const mojeW = danePracownikowWyniki[mojeImieKrotkie] || { kawa: 0, hd: 0, sklep: 0, dodatkowe: 0, total: 0, wliczony: false };

            let komunikatBrakPremii = "";
            if (!mojeSt.wliczony) {
                const powodSekcja = mojeSt.powod ? `<p class="text-muted" style="margin:6px 0 0 0;"><strong>Powód:</strong> ${mojeSt.powod}</p>` : '';
                komunikatBrakPremii = `
                    <div class="field-group" style="border-left: 4px solid var(--danger); background: var(--card-bg);">
                        <h4 style="color: var(--danger); margin-bottom:6px;">❌ Brak kwalifikacji do premii (${m})</h4>
                        <p style="font-weight: 600; margin: 0;">W bieżącym okresie nie kwalifikujesz się do otrzymania premii.</p>
                        ${powodSekcja}
                    </div>`;
            }

            const dodatkoweOpisyPracownikaHtml = (dodatkowePremieMap[mojeImieKrotkie] || []).map(dp =>
                `<div style="background:var(--group-bg); padding:6px 8px; margin-top:6px; border-radius:4px; font-size:0.85em;">📝 ${dp.opis}: <strong>${Number(dp.kwota).toFixed(2)} zł</strong></div>`
            ).join('');

            let warunkiPracownikaHtml = `<div class="field-group" style="margin-top:14px; background:var(--card-bg);"><label style="margin-bottom:8px;">📋 Status warunków premii w tym miesiącu:</label>`;
            let maWarunki = false;
            tymczasoweWarunkiAdmin.forEach(war => {
                if (war.docelowo === 'wszyscy' || war.docelowo === mojeImieKrotkie) {
                    maWarunki = true;
                    const spelnione = war.spelnioneMap ? !!war.spelnioneMap[mojeImieKrotkie] : false;
                    const statusB = spelnione ? `<span class="badge badge-done">Spełniony</span>` : `<span class="badge badge-pending">Do spełnienia</span>`;
                    warunkiPracownikaHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color); gap:8px;"><span>${war.opis}</span>${statusB}</div>`;
                }
            });
            if (!maWarunki) warunkiPracownikaHtml += `<p class="text-muted" style="margin:0;">Brak wymaganych dodatkowych warunków.</p>`;
            warunkiPracownikaHtml += `</div>`;

            html += `
                ${komunikatBrakPremii}
                <div class="field-group" style="border-left: 4px solid var(--success);">
                    <h4>👤 Twoja Premia Za Miesiąc: ${m}</h4>
                    <div class="grid-2" style="margin-top: 10px;">
                        <div style="background:var(--card-bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                            <label>☕ Kawa:</label>
                            <div style="font-size: 1.25em; font-weight: 700; color: var(--primary);">${mojeW.wliczony ? mojeW.kawa.toFixed(2) + ' zł' : '0.00 zł'}</div>
                            <div class="text-muted">Pozycja: <strong>#${pobierzMiejsce(mojeImieKrotkie, rankingKawa)}</strong></div>
                        </div>
                        <div style="background:var(--card-bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                            <label>🌭 HD:</label>
                            <div style="font-size: 1.25em; font-weight: 700; color: var(--primary);">${mojeW.wliczony ? mojeW.hd.toFixed(2) + ' zł' : '0.00 zł'}</div>
                            <div class="text-muted">Pozycja: <strong>#${pobierzMiejsce(mojeImieKrotkie, rankingHd)}</strong></div>
                        </div>
                        <div style="background:var(--card-bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                            <label>🛒 Sklep:</label>
                            <div style="font-size: 1.25em; font-weight: 700; color: var(--primary);">${mojeW.wliczony ? mojeW.sklep.toFixed(2) + ' zł' : '0.00 zł'}</div>
                            <div class="text-muted">Pozycja: <strong>#${pobierzMiejsce(mojeImieKrotkie, rankingSklep)}</strong></div>
                        </div>
                        <div style="background:var(--card-bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                            <label>➕ Premia dodatkowa:</label>
                            <div style="font-size: 1.25em; font-weight: 700; color: var(--info);">${mojeW.wliczony ? mojeW.dodatkowe.toFixed(2) + ' zł' : '0.00 zł'}</div>
                            ${dodatkoweOpisyPracownikaHtml}
                        </div>
                    </div>

                    ${warunkiPracownikaHtml}

                    <div style="margin-top: 14px; background: var(--card-bg); padding: 16px; border-radius: var(--radius-sm); border: 2px solid var(--success); text-align: center;">
                        <label style="font-size: 0.95em;">💰 SUMA TWOJEJ PREMII (ŁĄCZNIE):</label>
                        <div style="font-size: 1.85em; font-weight: 800; color: var(--success); margin-top: 4px;">${mojeW.total.toFixed(2)} zł</div>
                        <div class="text-muted" style="margin-top: 4px;">Pozycja w klasyfikacji ogólnej: <strong>#${pobierzMiejsce(mojeImieKrotkie, rankingTotal)}</strong></div>
                    </div>
                </div>`;
        }

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<span class='error'>Błąd podczas ładowania premii: ${e.message}</span>`;
    }
};

window.zmienWliczeniePracownikaAdmin = (m, pracownik, wliczony) => window.zapiszWliczenieDoPremiiAdmin(m, pracownik, wliczony, "");
window.zapiszPowodBrakPremiiAdmin = (m, pracownik, powod) => window.zapiszWliczenieDoPremiiAdmin(m, pracownik, false, powod);
