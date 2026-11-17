'use strict';
// Moduł Statystyki i czyszczenie danych (admin).

/* ==================== STATYSTYKI I CZYSZCZENIE ==================== */

function utworzMapePracownikowStat(lista) {
    const poId = new Map();
    const poNazwie = new Map();
    (lista || []).forEach(u => {
        poId.set(String(u.id), u);
        if (u.imie) poNazwie.set(u.imie, u);
        if (u.imieKrotkie) poNazwie.set(u.imieKrotkie, u);
    });
    return { poId, poNazwie };
}

function rozwiazIdPracownikaStat(nazwa, mapa) {
    if (!nazwa) return "";
    const klucz = String(nazwa);
    const u = mapa.poId.get(klucz)
        || mapa.poNazwie.get(klucz)
        || mapa.poNazwie.get(pobierzImieKrotkie(klucz));
    return u ? String(u.id) : `nazwa:${klucz}`;
}

function nazwaPracownikaStat(id, mapa) {
    const klucz = String(id || "");
    if (klucz.startsWith("nazwa:")) return klucz.slice(6);
    const u = mapa.poId.get(klucz);
    return u ? (u.imie || u.login || klucz) : (klucz || "Nieznany");
}

function pobierzOsobyRaportuStat(r, mapa) {
    if (Array.isArray(r.sprzedawcyIds) && r.sprzedawcyIds.length > 0) {
        // Identyfikatory mogą być UID albo — w starszych zapisach — imieniem i nazwiskiem.
        return [...new Set(r.sprzedawcyIds.filter(Boolean).map(id => rozwiazIdPracownikaStat(id, mapa)))];
    }
    if (Array.isArray(r.sprzedawcy) && r.sprzedawcy.length > 0) {
        return [...new Set(r.sprzedawcy.filter(Boolean).map(n => rozwiazIdPracownikaStat(n, mapa)))];
    }
    if (r.pracownik) return [rozwiazIdPracownikaStat(r.pracownik, mapa)];
    return [];
}

function normalizujDzien(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

window.pokazOpcjeStatystyk = () => document.getElementById('statystyki-opcje-panel').classList.remove('hidden');

window.toggleStatsCustomDates = () => {
    const typ = document.getElementById('stats-okres-typ').value;
    document.getElementById('stats-custom-dates-box').classList.toggle('hidden', typ !== 'custom');
};

window.przeliczIWygenerujStatystyki = async function() {
    const box = document.getElementById('statystyki-wynik-box');
    box.innerHTML = "Trwa przeliczanie i ładowanie danych...";

    const typOkresu = document.getElementById('stats-okres-typ').value;
    let odData, doData;
    const teraz = new Date();
    const rok = teraz.getFullYear();
    const miesiac = teraz.getMonth();

    if (typOkresu === 'biezacy') {
        odData = new Date(rok, miesiac, 1);
        doData = new Date(rok, miesiac + 1, 0);
    } else if (typOkresu === 'poprzedni') {
        odData = new Date(rok, miesiac - 1, 1);
        doData = new Date(rok, miesiac, 0);
    } else if (typOkresu === 'biezacy_kwartal') {
        const startMiesiacKwartalu = Math.floor(miesiac / 3) * 3;
        odData = new Date(rok, startMiesiacKwartalu, 1);
        doData = new Date(rok, startMiesiacKwartalu + 3, 0);
    } else if (typOkresu === 'poprzedni_kwartal') {
        const startMiesiacPoprzedniegoKwartalu = (Math.floor(miesiac / 3) - 1) * 3;
        odData = new Date(rok, startMiesiacPoprzedniegoKwartalu, 1);
        doData = new Date(rok, startMiesiacPoprzedniegoKwartalu + 3, 0);
    } else if (typOkresu === 'ten_rok') {
        odData = new Date(rok, 0, 1);
        doData = new Date(rok, 11, 31);
    } else if (typOkresu === '30dni') {
        odData = new Date(rok, miesiac, teraz.getDate() - 30);
        doData = new Date(rok, miesiac, teraz.getDate());
    } else if (typOkresu === 'custom') {
        const odStr = document.getElementById('stats-date-from').value;
        const doStr = document.getElementById('stats-date-to').value;
        if (!odStr || !doStr) return alert("Wybierz poprawny zakres dat (od-do)!");
        const odP = pobierzDateDoObiektu(odStr);
        const doP = pobierzDateDoObiektu(doStr);
        if (!odP || !doP) return alert("Nieprawidłowy format daty. Użyj pola wyboru daty.");
        odData = normalizujDzien(odP);
        doData = normalizujDzien(doP);
        if (odData > doData) return alert("Data początkowa nie może być późniejsza niż data końcowa!");
    } else {
        return alert("Wybierz okres statystyk.");
    }

    const dOd = formatujDateLokalna(odData);
    const dDo = formatujDateLokalna(doData);
    const odZnacznik = odData.getTime();
    const doZnacznik = doData.getTime();

    try {
        const [raportySnap, pracownicyLista] = await Promise.all([
            getDocs(collection(db, "sprzedaz")),
            pobierzListePracownikow()
        ]);
        const mapaPracownikow = utworzMapePracownikowStat(pracownicyLista);

        const przefiltrowaneRaporty = [];
        raportySnap.forEach(d => {
            const r = d.data();
            const dataRaportu = r.data || d.id;
            const dt = pobierzDateDoObiektu(dataRaportu);
            if (!dt) return;
            const dzien = normalizujDzien(dt);
            if (dzien.getTime() >= odZnacznik && dzien.getTime() <= doZnacznik) {
                przefiltrowaneRaporty.push({ ...r, data: dataRaportu });
            }
        });

        const opisOsobRaportu = (r) => {
            const ids = pobierzOsobyRaportuStat(r, mapaPracownikow);
            if (ids.length > 0) return ids.map(id => nazwaPracownikaStat(id, mapaPracownikow)).join(', ');
            return 'Brak danych';
        };

        let htmlWynik = `<div style="display:flex; flex-direction:column; gap:14px;">
            <div style="background:var(--group-bg); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-weight:600;">📅 Wybrany okres: od ${ucieczkaHtml(formatujDateDoWyswietlenia(dOd))} do ${ucieczkaHtml(formatujDateDoWyswietlenia(dDo))}</div>`;

        if (document.getElementById('chk-stat-sprzedaz-ogolna').checked) {
            let sKawaW = 0, sHdW = 0, sSklepW = 0, sumaLaczna = 0;
            let najlepszyDzien = null, najgorszyDzien = null;

            przefiltrowaneRaporty.forEach(r => {
                const kawa = Number(r.kawa?.wartosc) || 0;
                const hd = Number(r.hd?.wartosc) || 0;
                const sklep = Number(r.sklep?.wartosc) || 0;
                const sumaDnia = kawa + hd + sklep;
                const sprzedawcyDnia = opisOsobRaportu(r);

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
                ${najlepszyDzien ? `<p style="margin:6px 0;" class="val-green">🌟 Najlepszy dzień: <strong>${ucieczkaHtml(formatujDateDoWyswietlenia(najlepszyDzien.data))}</strong> (${najlepszyDzien.suma.toFixed(2)} zł) — ${ucieczkaHtml(najlepszyDzien.sprzedawcy)}</p>` : ''}
                ${najgorszyDzien ? `<p style="margin:0;" class="val-red">🔻 Najgorszy dzień: <strong>${ucieczkaHtml(formatujDateDoWyswietlenia(najgorszyDzien.data))}</strong> (${najgorszyDzien.suma.toFixed(2)} zł) — ${ucieczkaHtml(najgorszyDzien.sprzedawcy)}</p>` : ''}
            </div>`;
        }

        if (document.getElementById('chk-stat-sprzedaz-pracownicy').checked) {
            const pracownicyWyniki = {};
            przefiltrowaneRaporty.forEach(r => {
                const osoby = pobierzOsobyRaportuStat(r, mapaPracownikow);
                const cnt = osoby.length;
                if (cnt > 0) {
                    const kawaUdzial = (Number(r.kawa?.wartosc) || 0) / cnt;
                    const hdUdzial = (Number(r.hd?.wartosc) || 0) / cnt;
                    const sklepUdzial = (Number(r.sklep?.wartosc) || 0) / cnt;
                    osoby.forEach(idOsoby => {
                        if (!pracownicyWyniki[idOsoby]) pracownicyWyniki[idOsoby] = { suma: 0, kawa: 0, hd: 0, sklep: 0, dni: 0 };
                        pracownicyWyniki[idOsoby].suma += kawaUdzial + hdUdzial + sklepUdzial;
                        pracownicyWyniki[idOsoby].kawa += kawaUdzial;
                        pracownicyWyniki[idOsoby].hd += hdUdzial;
                        pracownicyWyniki[idOsoby].sklep += sklepUdzial;
                        pracownicyWyniki[idOsoby].dni += 1;
                    });
                }
            });

            const pRows = Object.keys(pracownicyWyniki)
                .sort((a, b) => pracownicyWyniki[b].suma - pracownicyWyniki[a].suma)
                .map(idOsoby => {
                    const pw = pracownicyWyniki[idOsoby];
                    return `<tr><td><strong>${ucieczkaHtml(nazwaPracownikaStat(idOsoby, mapaPracownikow))}</strong></td><td>${pw.dni}</td><td>${pw.kawa.toFixed(2)}</td><td>${pw.hd.toFixed(2)}</td><td>${pw.sklep.toFixed(2)}</td><td><strong>${pw.suma.toFixed(2)}</strong></td></tr>`;
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
                    plany.kawa += Math.max(0, Number(dataP.kawa) || 0);
                    plany.hd += Math.max(0, Number(dataP.hd) || 0);
                    plany.sklep += Math.max(0, Number(dataP.sklep) || 0);
                }
            });

            let sKawaW = 0, sHdW = 0, sSklepW = 0;
            let ostatniaDataRaportu = null;

            przefiltrowaneRaporty.forEach(r => {
                sKawaW += Number(r.kawa?.wartosc) || 0;
                sHdW += Number(r.hd?.wartosc) || 0;
                sSklepW += Number(r.sklep?.wartosc) || 0;
                const dtR = pobierzDateDoObiektu(r.data);
                if (dtR && (!ostatniaDataRaportu || dtR > ostatniaDataRaportu)) ostatniaDataRaportu = dtR;
            });

            const dniWOkresie = Math.max(1, Math.round((doData - odData) / (1000 * 60 * 60 * 24)) + 1);

            let przepracowaneDni = 0;
            if (ostatniaDataRaportu) {
                przepracowaneDni = Math.min(
                    dniWOkresie,
                    Math.max(0, Math.round((normalizujDzien(ostatniaDataRaportu) - odData) / (1000 * 60 * 60 * 24)) + 1)
                );
            }

            const ptProporcja = przepracowaneDni / dniWOkresie;
            const etykietaOkresuPlanu = miesiaceWZakresie.length === 1
                ? miesiaceWZakresie[0]
                : `${miesiaceWZakresie[0]} – ${miesiaceWZakresie[miesiaceWZakresie.length - 1]}`;

            const rowPlan = (nazwa, wyk, plan) => {
                const planLiczba = Math.max(0, Number(plan) || 0);
                const planProp = planLiczba * ptProporcja;
                const diff100 = wyk - planLiczba;
                const diffProp = wyk - planProp;
                const p100 = planLiczba > 0 ? (wyk / planLiczba) * 100 : 0;
                const pProp = planProp > 0 ? (wyk / planProp) * 100 : 0;
                return `<tr>
                    <td><strong>${nazwa}</strong></td>
                    <td>${wyk.toFixed(2)}</td>
                    <td>${planLiczba.toFixed(2)}</td>
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

            const czyDataWZakresie = (wartosc) => {
                const d = pobierzDateDoObiektu(wartosc);
                if (!d) return null;
                const t = normalizujDzien(d).getTime();
                return t >= odZnacznik && t <= doZnacznik;
            };
            const czyMiesiacDokumentuWZakresie = (docId) => {
                const mPart = String(docId).slice(0, 7);
                if (!/^\d{4}-\d{2}$/.test(mPart)) return false;
                return mPart >= dOd.slice(0, 7) && mPart <= dDo.slice(0, 7);
            };

            sprzatanieSnap.forEach(docS => {
                const polki = docS.data().półki || {};
                Object.values(polki).forEach(p => {
                    if (!p || typeof p !== 'object') return;
                    const dataWpisu = p.dataSprawdzenia || p.data || null;
                    const wZakresie = dataWpisu
                        ? czyDataWZakresie(dataWpisu)
                        : czyMiesiacDokumentuWZakresie(docS.id);
                    if (!wZakresie) return;

                    const czyReset = p.reset === true || p.podpis === "-";
                    if (czyReset) {
                        zresetowaneAdmin++;
                        return;
                    }

                    if (p.czystosc && p.daty && p.planogram) {
                        wykonaneRazem++;
                        const idOsoby = p.pracownikId
                            ? String(p.pracownikId)
                            : (p.podpis ? `nazwa:${p.podpis}` : "");
                        if (idOsoby) {
                            pracownicySprzatanie[idOsoby] = (pracownicySprzatanie[idOsoby] || 0) + 1;
                        }
                    } else {
                        niewykonaneRazem++;
                    }
                });
            });

            const spRows = Object.keys(pracownicySprzatanie)
                .sort((a, b) => pracownicySprzatanie[b] - pracownicySprzatanie[a])
                .map(idOsoby =>
                    `<tr><td><strong>${ucieczkaHtml(nazwaPracownikaStat(idOsoby, mapaPracownikow))}</strong></td><td>✔ ${pracownicySprzatanie[idOsoby]}</td></tr>`
                ).join('');

            htmlWynik += `<div class="field-group" style="border-left:4px solid var(--warning);">
                <h4>🧹 Kontrola Czystości i Półek</h4>
                <p style="margin:4px 0;"><strong>Wykonane:</strong> <span class="val-green">${wykonaneRazem}</span> | <strong>Niewykonane:</strong> <span class="val-red">${niewykonaneRazem}</span> | <strong>Zresetowane:</strong> ${zresetowaneAdmin}</p>
                ${spRows ? `<div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Kontrole</th></tr>${spRows}</table></div>` : ''}
            </div>`;
        }

        box.innerHTML = htmlWynik + `</div>`;
    } catch (e) {
        box.innerHTML = `<span class='error'>Błąd podczas obliczania statystyk: ${ucieczkaHtml(e.message)}</span>`;
    }
};

window.toggleCleanupCustomDate = () => {
    const val = document.getElementById('cleanup-zakres').value;
    document.getElementById('cleanup-custom-box').classList.toggle('hidden', val !== 'custom');
};

window.uruchomProcedureUsuwaniaDanych = async function() {
    const wybor = document.getElementById('cleanup-zakres').value;
    let dataGraniczna;

    if (wybor === 'custom') {
        const customVal = document.getElementById('cleanup-custom-date').value;
        const parsed = pobierzDateDoObiektu(customVal);
        if (!parsed) return alert("Wybierz poprawną datę graniczną!");
        dataGraniczna = normalizujDzien(parsed);
    } else {
        const miesiace = parseInt(wybor, 10);
        if (!Number.isFinite(miesiace) || miesiace <= 0) return alert("Wybierz poprawny zakres czyszczenia.");
        const dzisiaj = normalizujDzien(new Date());
        dataGraniczna = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() - miesiace, dzisiaj.getDate());
    }

    if (!confirm(`⚠️ OSTRZEŻENIE: Zamierzasz trwale usunąć dane starsze niż ${formatujDateLokalna(dataGraniczna)}.\nKontynuować?`)) return;
    if (!confirm(`🔴 DRUGIE POTWIERDZENIE: Tej operacji NIE DA SIĘ cofnąć. Kliknij OK, aby wykonać usunięcie.`)) return;

    const granica = dataGraniczna.getTime();
    const polaDat = ['data', 'doKiedy', 'dataUtworzenia', 'czasModyfikacji', 'updatedAt', 'timestamp'];

    try {
        for (const kol of ['sprzedaz', 'misje', 'prosby_o_zmiany', 'wiadomosci']) {
            const snap = await getDocs(collection(db, kol));
            for (const d of snap.docs) {
                const rekord = d.data();
                let dataRekordu = null;
                for (const pole of polaDat) {
                    const parsed = pobierzDateDoObiektu(rekord[pole]);
                    if (parsed) { dataRekordu = normalizujDzien(parsed); break; }
                }
                // Rekordy bez rozpoznawalnej daty zostawiamy nietknięte — nie ryzykujemy utraty danych.
                if (dataRekordu && dataRekordu.getTime() < granica) {
                    await deleteDoc(doc(db, kol, d.id));
                }
            }
        }
        alert("Operacja czyszczenia zakończona pomyślnie.");
    } catch (e) { alert("Błąd podczas usuwania danych: " + e.message); }
};
