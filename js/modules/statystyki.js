'use strict';
// Moduł Statystyki i czyszczenie danych (admin).

/* ==================== STATYSTYKI I CZYSZCZENIE ==================== */
window.pokazOpcjeStatystyk = () => document.getElementById('statystyki-opcje-panel').classList.remove('hidden');

window.toggleStatsCustomDates = () => {
    const typ = document.getElementById('stats-okres-typ').value;
    document.getElementById('stats-custom-dates-box').classList.toggle('hidden', typ !== 'custom');
};

window.przeliczIWygenerujStatystyki = async function() {
    const box = document.getElementById('statystyki-wynik-box');
    box.innerHTML = "Trwa przeliczanie i ładowanie danych...";

    const typOkresu = document.getElementById('stats-okres-typ').value;
    let dOd = "", dDo = "";
    const teraz = new Date();
    const rok = teraz.getFullYear();
    const miesiac = teraz.getMonth();

    if (typOkresu === 'biezacy') {
        dOd = formatujDateLokalna(new Date(rok, miesiac, 1));
        dDo = formatujDateLokalna(new Date(rok, miesiac + 1, 0));
    } else if (typOkresu === 'poprzedni') {
        dOd = formatujDateLokalna(new Date(rok, miesiac - 1, 1));
        dDo = formatujDateLokalna(new Date(rok, miesiac, 0));
    } else if (typOkresu === 'biezacy_kwartal') {
        const startMiesiacKwartalu = Math.floor(miesiac / 3) * 3;
        dOd = formatujDateLokalna(new Date(rok, startMiesiacKwartalu, 1));
        dDo = formatujDateLokalna(new Date(rok, startMiesiacKwartalu + 3, 0));
    } else if (typOkresu === 'poprzedni_kwartal') {
        const startMiesiacPoprzedniegoKwartalu = (Math.floor(miesiac / 3) - 1) * 3;
        dOd = formatujDateLokalna(new Date(rok, startMiesiacPoprzedniegoKwartalu, 1));
        dDo = formatujDateLokalna(new Date(rok, startMiesiacPoprzedniegoKwartalu + 3, 0));
    } else if (typOkresu === 'ten_rok') {
        dOd = formatujDateLokalna(new Date(rok, 0, 1));
        dDo = formatujDateLokalna(new Date(rok, 11, 31));
    } else if (typOkresu === '30dni') {
        const d30 = new Date(rok, miesiac, teraz.getDate() - 30);
        dOd = formatujDateLokalna(d30);
        dDo = formatujDateLokalna(teraz);
    } else if (typOkresu === 'custom') {
        dOd = document.getElementById('stats-date-from').value;
        dDo = document.getElementById('stats-date-to').value;
        if (!dOd || !dDo) return alert("Wybierz poprawny zakres dat (od-do)!");
    }

    try {
        const raportySnap = await getDocs(collection(db, "sprzedaz"));
        const przefiltrowaneRaporty = [];
        raportySnap.forEach(d => {
            const r = d.data();
            if (r.data >= dOd && r.data <= dDo) przefiltrowaneRaporty.push(r);
        });

        let htmlWynik = `<div style="display:flex; flex-direction:column; gap:14px;">
            <div style="background:var(--group-bg); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-weight:600;">📅 Wybrany okres: od ${dOd} do ${dDo}</div>`;

        if (document.getElementById('chk-stat-sprzedaz-ogolna').checked) {
            let sKawaW = 0, sHdW = 0, sSklepW = 0, sumaLaczna = 0;
            let najlepszyDzien = null, najgorszyDzien = null;

            przefiltrowaneRaporty.forEach(r => {
                const kawa = Number(r.kawa?.wartosc) || 0;
                const hd = Number(r.hd?.wartosc) || 0;
                const sklep = Number(r.sklep?.wartosc) || 0;
                const sumaDnia = kawa + hd + sklep;
                const sprzedawcyDnia = r.sprzedawcy ? r.sprzedawcy.join(', ') : 'Brak danych';

                sKawaW += kawa; sHdW += hd; sSklepW += sklep; sumaLaczna += sumaDnia;

                if (!najlepszyDzien || sumaDnia > najlepszyDzien.suma) najlepszyDzien = { data: r.data, suma: sumaDnia, sprzedawcy: sprzedawcyDnia };
                if (!najgorszyDzien || sumaDnia < najgorszyDzien.suma) najgorszyDzien = { data: r.data, suma: sumaDnia, sprzedawcy: sprzedawcyDnia };
            });

            const dniLiczba = przefiltrowaneRaporty.length || 1;
            htmlWynik += `<div class="field-group" style="border-left:4px solid var(--primary);">
                <h4>📊 Sprzedaż Ogólna i Kategoriowa</h4>
                <div class="table-responsive"><table class="standard-table" style="text-align: left;">
                    <tr><th>Kategoria</th><th>Wynik</th></tr>
                    <tr><td><strong>Łączny obrót</strong></td><td>${sumaLaczna.toFixed(2)} zł (Dni: ${przefiltrowaneRaporty.length})</td></tr>
                    <tr><td><strong>Średnia dzienna</strong></td><td>${(sumaLaczna / dniLiczba).toFixed(2)} zł/dzień</td></tr>
                    <tr><td><strong>☕ Kawa</strong></td><td>${sKawaW.toFixed(2)} zł | Śr: ${(sKawaW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                    <tr><td><strong>🌭 HD</strong></td><td>${sHdW.toFixed(2)} zł | Śr: ${(sHdW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                    <tr><td><strong>🛒 Sklep</strong></td><td>${sSklepW.toFixed(2)} zł | Śr: ${(sSklepW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                </table></div>
                ${najlepszyDzien ? `<p style="margin:6px 0;" class="val-green">🌟 Najlepszy dzień: <strong>${najlepszyDzien.data}</strong> (${najlepszyDzien.suma.toFixed(2)} zł) — ${najlepszyDzien.sprzedawcy}</p>` : ''}
                ${najgorszyDzien ? `<p style="margin:0;" class="val-red">🔻 Najgorszy dzień: <strong>${najgorszyDzien.data}</strong> (${najgorszyDzien.suma.toFixed(2)} zł) — ${najgorszyDzien.sprzedawcy}</p>` : ''}
            </div>`;
        }

        if (document.getElementById('chk-stat-sprzedaz-pracownicy').checked) {
            const pracownicyWyniki = {};
            przefiltrowaneRaporty.forEach(r => {
                const osoby = r.sprzedawcy || [];
                const cnt = osoby.length;
                if (cnt > 0) {
                    const kawaUdzial = (Number(r.kawa?.wartosc) || 0) / cnt;
                    const hdUdzial = (Number(r.hd?.wartosc) || 0) / cnt;
                    const sklepUdzial = (Number(r.sklep?.wartosc) || 0) / cnt;
                    osoby.forEach(p => {
                        if (!pracownicyWyniki[p]) pracownicyWyniki[p] = { suma: 0, kawa: 0, hd: 0, sklep: 0, dni: 0 };
                        pracownicyWyniki[p].suma += kawaUdzial + hdUdzial + sklepUdzial;
                        pracownicyWyniki[p].kawa += kawaUdzial;
                        pracownicyWyniki[p].hd += hdUdzial;
                        pracownicyWyniki[p].sklep += sklepUdzial;
                        pracownicyWyniki[p].dni += 1;
                    });
                }
            });

            const pRows = Object.keys(pracownicyWyniki).map(p => {
                const pw = pracownicyWyniki[p];
                return `<tr><td><strong>${p}</strong></td><td>${pw.dni}</td><td>${pw.kawa.toFixed(2)}</td><td>${pw.hd.toFixed(2)}</td><td>${pw.sklep.toFixed(2)}</td><td><strong>${pw.suma.toFixed(2)}</strong></td></tr>`;
            }).join('');

            htmlWynik += `<div class="field-group" style="border-left:4px solid var(--success);">
                <h4>👥 Sprzedaż na pracowników (Proporcjonalnie)</h4>
                ${pRows ? `<div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Dni</th><th>Kawa</th><th>HD</th><th>Sklep</th><th>Suma</th></tr>${pRows}</table></div>` : '<p class="text-muted">Brak danych sprzedażowych.</p>'}
            </div>`;
        }

        if (document.getElementById('chk-stat-plany').checked) {
            const miesiaceWZakresie = [];
            let [curRok, curMies] = dOd.slice(0, 7).split('-').map(Number);
            const [endRok, endMies] = dDo.slice(0, 7).split('-').map(Number);

            while (curRok < endRok || (curRok === endRok && curMies <= endMies)) {
                miesiaceWZakresie.push(`${curRok}-${String(curMies).padStart(2, '0')}`);
                curMies++;
                if (curMies > 12) { curMies = 1; curRok++; }
            }

            const planyDocs = await Promise.all(miesiaceWZakresie.map(mk => getDoc(doc(db, "plany_miesieczne", mk))));
            const plany = { kawa: 0, hd: 0, sklep: 0 };
            planyDocs.forEach(pd => {
                if (pd.exists()) {
                    const dataP = pd.data();
                    plany.kawa += Number(dataP.kawa) || 0;
                    plany.hd += Number(dataP.hd) || 0;
                    plany.sklep += Number(dataP.sklep) || 0;
                }
            });

            let sKawaW = 0, sHdW = 0, sSklepW = 0;
            let ostatniaDataRaportu = "";

            przefiltrowaneRaporty.forEach(r => {
                sKawaW += Number(r.kawa?.wartosc) || 0;
                sHdW += Number(r.hd?.wartosc) || 0;
                sSklepW += Number(r.sklep?.wartosc) || 0;
                if (r.data && r.data > ostatniaDataRaportu) ostatniaDataRaportu = r.data;
            });

            const [odR, odM, odD] = dOd.split('-').map(Number);
            const [doR, doM, doD] = dDo.split('-').map(Number);
            const startDate = new Date(odR, odM - 1, odD);
            const endDate = new Date(doR, doM - 1, doD);
            const dniWOkresie = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);

            let przepracowaneDni = 0;
            if (ostatniaDataRaportu) {
                const [ostR, ostM, ostD] = ostatniaDataRaportu.split('-').map(Number);
                const lastReportDate = new Date(ostR, ostM - 1, ostD);
                przepracowaneDni = Math.min(dniWOkresie, Math.max(0, Math.round((lastReportDate - startDate) / (1000 * 60 * 60 * 24)) + 1));
            }

            const ptProporcja = przepracowaneDni / dniWOkresie;
            const etykietaOkresuPlanu = miesiaceWZakresie.length === 1
                ? miesiaceWZakresie[0]
                : `${miesiaceWZakresie[0]} – ${miesiaceWZakresie[miesiaceWZakresie.length - 1]}`;

            const rowPlan = (nazwa, wyk, plan) => {
                const planProp = plan * ptProporcja;
                const diff100 = wyk - plan;
                const diffProp = wyk - planProp;
                const p100 = plan > 0 ? (wyk / plan) * 100 : 0;
                const pProp = planProp > 0 ? (wyk / planProp) * 100 : 0;
                return `<tr>
                    <td><strong>${nazwa}</strong></td>
                    <td>${wyk.toFixed(2)}</td>
                    <td>${plan.toFixed(2)}</td>
                    <td class="${p100>=100?'val-green':'val-red'}">${p100.toFixed(1)}%</td>
                    <td class="${diff100>=0?'val-green':'val-red'}">${diff100.toFixed(2)}</td>
                    <td>${planProp.toFixed(2)}</td>
                    <td class="${pProp>=100?'val-green':'val-red'}">${pProp.toFixed(1)}%</td>
                    <td class="${diffProp>=0?'val-green':'val-red'}">${diffProp.toFixed(2)}</td>
                </tr>`;
            };

            htmlWynik += `<div class="field-group" style="border-left:4px solid var(--info);">
                <h4>🎯 Realizacja Planów (${etykietaOkresuPlanu})</h4>
                <p class="text-muted">Proporcja wg ostatniego raportu: Dzień ${przepracowaneDni} z ${dniWOkresie} (${(ptProporcja*100).toFixed(1)}%)</p>
                <div class="table-responsive"><table class="standard-table">
                    <tr><th>Kategoria</th><th>Wykonano</th><th>Plan</th><th>% Planu</th><th>Różn.</th><th>Plan prop.</th><th>% Prop.</th><th>Różn. prop.</th></tr>
                    ${rowPlan('☕ KAWA', sKawaW, plany.kawa || 0)}
                    ${rowPlan('🌭 HD', sHdW, plany.hd || 0)}
                    ${rowPlan('🛒 SKLEP', sSklepW, plany.sklep || 0)}
                </table></div>
            </div>`;
        }

        if (document.getElementById('chk-stat-sprzatanie').checked) {
            const sprzatanieSnap = await getDocs(collection(db, "sprzatanie"));
            let wykonaneRazem = 0, niewykonaneRazem = 0, zresetowaneAdmin = 0;
            const pracownicySprzatanie = {};

            sprzatanieSnap.forEach(docS => {
                const mPart = docS.id.slice(0, 7);
                if (mPart >= dOd.slice(0, 7) && mPart <= dDo.slice(0, 7)) {
                    Object.values(docS.data().półki || {}).forEach(p => {
                        if (p.czystosc && p.daty && p.planogram) {
                            wykonaneRazem++;
                            const kto = p.podpis || "Nieznany";
                            if (kto !== "-") pracownicySprzatanie[kto] = (pracownicySprzatanie[kto] || 0) + 1;
                        } else {
                            niewykonaneRazem++;
                        }
                        if (p.podpis === "-" && p.dataSprawdzenia) zresetowaneAdmin++;
                    });
                }
            });

            const spRows = Object.keys(pracownicySprzatanie).map(kto =>
                `<tr><td><strong>${kto}</strong></td><td>✔ ${pracownicySprzatanie[kto]}</td></tr>`
            ).join('');

            htmlWynik += `<div class="field-group" style="border-left:4px solid var(--warning);">
                <h4>🧹 Kontrola Czystości i Półek</h4>
                <p style="margin:4px 0;"><strong>Wykonane:</strong> <span class="val-green">${wykonaneRazem}</span> | <strong>Niewykonane:</strong> <span class="val-red">${niewykonaneRazem}</span> | <strong>Zresetowane:</strong> ${zresetowaneAdmin}</p>
                ${spRows ? `<div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Kontrole</th></tr>${spRows}</table></div>` : ''}
            </div>`;
        }

        box.innerHTML = htmlWynik + `</div>`;
    } catch (e) {
        box.innerHTML = `<span class='error'>Błąd podczas obliczania statystyk: ${e.message}</span>`;
    }
};

window.toggleCleanupCustomDate = () => {
    const val = document.getElementById('cleanup-zakres').value;
    document.getElementById('cleanup-custom-box').classList.toggle('hidden', val !== 'custom');
};

window.uruchomProcedureUsuwaniaDanych = async function() {
    const wybor = document.getElementById('cleanup-zakres').value;
    let dataGraniczna = new Date();

    if (wybor === 'custom') {
        const customVal = document.getElementById('cleanup-custom-date').value;
        if (!customVal) return alert("Wybierz poprawną datę graniczną!");
        dataGraniczna = new Date(customVal);
    } else {
        dataGraniczna.setMonth(dataGraniczna.getMonth() - parseInt(wybor));
    }

    if (!confirm(`⚠️ OSTRZEŻENIE: Zamierzasz trwale usunąć dane starsze niż ${formatujDateLokalna(dataGraniczna)}.\nKontynuować?`)) return;
    if (!confirm(`🔴 DRUGIE POTWIERDZENIE: Tej operacji NIE DA SIĘ cofnąć. Kliknij OK, aby wykonać usunięcie.`)) return;

    try {
        for (const kol of ['sprzedaz', 'misje', 'prosby_o_zmiany', 'wiadomosci']) {
            const snap = await getDocs(collection(db, kol));
            for (const d of snap.docs) {
                const dataD = d.data();
                const rawDate = dataD.data || dataD.doKiedy || dataD.dataUtworzenia;
                if (rawDate && new Date(rawDate) < dataGraniczna) {
                    await deleteDoc(doc(db, kol, d.id));
                }
            }
        }
        alert("Operacja czyszczenia zakończona pomyślnie.");
    } catch (e) { alert("Błąd podczas usuwania danych: " + e.message); }
};
