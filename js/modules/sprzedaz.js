'use strict';
// Moduł Sprzedaż (widok miesięczny/dzienny, raporty, plan).

/* ==================== SPRZEDAŻ ==================== */
let aktualnyRaportUpdatedAt = null;
let aktualniSprzedawcyDnia = [];

/* Bezpieczne odpowiedniki helperów z utils.js — moduł ma działać nawet przy nieaktualnym utils.js. */
function pobierzBiezacyMiesiacSprzedazy() {
    if (typeof pobierzBiezacyOkresSystemowy === 'function') {
        return pobierzBiezacyOkresSystemowy().miesiacStr;
    }
    const teraz = new Date();
    return `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}`;
}

function pobierzDzisiejszaDateSprzedazy() {
    if (typeof pobierzDzisiejszaDateStr === 'function') return pobierzDzisiejszaDateStr();
    const teraz = new Date();
    return `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}-${String(teraz.getDate()).padStart(2, '0')}`;
}

window.pokazWidokMiesieczny = function() {
    const widokDnia = document.getElementById('view-daily');
    const widokMiesiaca = document.getElementById('view-monthly');
    if (widokDnia) widokDnia.classList.add('hidden');
    if (widokMiesiaca) widokMiesiaca.classList.remove('hidden');

    // Domyślny miesiąc ustawiamy natychmiast, zanim cokolwiek innego może rzucić błąd.
    const poleMiesiaca = document.getElementById('wybrany-miesiac');
    if (poleMiesiaca && !poleMiesiaca.value) poleMiesiaca.value = pobierzBiezacyMiesiacSprzedazy();

    // Tabelę uruchamiamy przed ustawieniem limitu daty — błąd jednego elementu nie blokuje drugiego.
    window.zaladujMiesiacTabela();

    try {
        const raportData = document.getElementById('raport-data');
        if (raportData) raportData.max = pobierzDzisiejszaDateSprzedazy();
    } catch (e) {
        console.warn("Nie udało się ustawić limitu daty raportu:", e);
    }

    if (currentUserData?.rola === 'admin') pobierzRaportyDlaAdmina();
};

window.otworzDzien = async function(dataStr) {
    window.location.hash = "#dzien";
    const poleDaty = document.getElementById('raport-data');
    poleDaty.value = dataStr;
    poleDaty.max = pobierzDzisiejszaDateSprzedazy();
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    poleDaty.disabled = !czyAdmin;
    await zaladujDaneRaportuDnia(dataStr);
};

/* Raportów nie wypełniamy z wyprzedzeniem — przyszłe dni są zablokowane. */
function czyDataJestWPrzyszlosci(dataStr) {
    return !!dataStr && String(dataStr) > pobierzDzisiejszaDateSprzedazy();
}

function polaWartosciRaportu() {
    return ['kawa-ilosc', 'kawa-wartosc', 'hd-ilosc', 'hd-wartosc', 'sklep-wartosc']
        .map(id => document.getElementById(id))
        .filter(Boolean);
}

function zablokujFormularzDlaPrzyszlosci(komunikat) {
    polaWartosciRaportu().forEach(pole => { pole.disabled = true; pole.value = ""; });
    const btn = document.getElementById('btn-zapisz-raport');
    if (btn) btn.disabled = true;
    const container = document.getElementById('sprzedawcy-info-container');
    if (container) container.innerHTML = `<span class="val-red">${ucieczkaHtml(komunikat)}</span>`;
}

function odblokujFormularzRaportu() {
    polaWartosciRaportu().forEach(pole => { pole.disabled = false; });
    const btn = document.getElementById('btn-zapisz-raport');
    if (btn) btn.disabled = false;
}

/* Sprzedawcy raportu wynikają z grafiku — nie wybiera się ich ręcznie. */
function renderujSprzedawcowRaportu(osoby, zrodlo) {
    const container = document.getElementById('sprzedawcy-info-container');
    if (!container) return;

    if (!osoby || osoby.length === 0) {
        container.innerHTML = `<span class="val-red">Brak obsady do przypisania wyniku. Uzupełnij grafik i odśwież dzień.</span>`;
        return;
    }

    const lista = osoby.map(osoba => {
        const zmiany = Array.isArray(osoba.zmiany) && osoba.zmiany.length > 0
            ? ` <span class="text-muted" style="font-size:0.85em;">(${osoba.zmiany.join(', ')})</span>`
            : '';
        return `<div style="margin:4px 0;">👤 <strong>${ucieczkaHtml(osoba.imie || osoba.id)}</strong>${zmiany}</div>`;
    }).join('');

    const opisZrodla = zrodlo === 'grafik'
        ? 'Automatycznie z grafiku — osoby pracujące tego dnia (R = rano, Z = zamknięcie).'
        : (zrodlo === 'raport'
            ? 'Brak wpisów w grafiku na ten dzień — zachowano sprzedawców z wcześniejszego zapisu raportu.'
            : 'Brak grafiku i wcześniejszego raportu — wynik zostanie przypisany do Ciebie.');

    container.innerHTML = `<div>${lista}</div><p class="text-muted" style="margin:8px 0 0 0; font-size:0.82em;">${opisZrodla}</p>`;
}

async function zaladujDaneRaportuDnia(dataStr) {
    const container = document.getElementById('sprzedawcy-info-container');
    if (container) container.innerHTML = "Pobieranie obsady z grafiku...";
    aktualniSprzedawcyDnia = [];

    if (czyDataJestWPrzyszlosci(dataStr)) {
        zablokujFormularzDlaPrzyszlosci("Raportów nie można wypełniać dla przyszłych dni. Wybierz dzisiejszą lub wcześniejszą datę.");
        return;
    }
    odblokujFormularzRaportu();

    try {
        const miesiacStr = String(dataStr || "").slice(0, 7);
        const parsed = pobierzDateDoObiektu(dataStr);
        const dzien = parsed ? parsed.getDate() : Number(String(dataStr || "").slice(8, 10));

        const [rDoc, grafikDoc, pracownicy] = await Promise.all([
            getDoc(doc(db, "sprzedaz", dataStr)),
            getDoc(doc(db, "grafiki", miesiacStr)).catch(e => {
                console.warn("Nie udało się odczytać grafiku dla raportu dnia:", e);
                return null;
            }),
            pobierzListePracownikow().catch(e => {
                console.warn("Nie udało się odczytać listy pracowników:", e);
                return [];
            })
        ]);

        const daneRaportu = rDoc.exists() ? rDoc.data() : null;
        aktualnyRaportUpdatedAt = daneRaportu?.updatedAt || null;

        if (daneRaportu) {
            document.getElementById('kawa-ilosc').value = daneRaportu.kawa?.ilosc ?? "";
            document.getElementById('kawa-wartosc').value = daneRaportu.kawa?.wartosc ?? "";
            document.getElementById('hd-ilosc').value = daneRaportu.hd?.ilosc ?? "";
            document.getElementById('hd-wartosc').value = daneRaportu.hd?.wartosc ?? "";
            document.getElementById('sklep-wartosc').value = daneRaportu.sklep?.wartosc ?? "";
        } else {
            ['kawa-ilosc', 'kawa-wartosc', 'hd-ilosc', 'hd-wartosc', 'sklep-wartosc'].forEach(id => document.getElementById(id).value = "");
        }

        // 1) Priorytet: osoby zaplanowane w grafiku na ten dzień.
        let osoby = pobierzSprzedawcowDniaGrafiku(
            grafikDoc && grafikDoc.exists() ? grafikDoc.data() : null,
            dzien
        );
        let zrodlo = 'grafik';

        // 2) Starszy raport zapisany bez grafiku — zachowujemy jego sprzedawców.
        if (osoby.length === 0 && daneRaportu) {
            const zapisaniIds = Array.isArray(daneRaportu.sprzedawcyIds) ? daneRaportu.sprzedawcyIds : [];
            const zapisaneImiona = Array.isArray(daneRaportu.sprzedawcy) ? daneRaportu.sprzedawcy : [];
            if (zapisaniIds.length > 0) {
                osoby = zapisaniIds.map((id, idx) => {
                    const pracownik = znajdzPracownika(pracownicy, id);
                    return { id: String(id), imie: zapisaneImiona[idx] || pracownik?.imie || String(id), zmiany: [] };
                });
            } else if (zapisaneImiona.length > 0) {
                osoby = zapisaneImiona.map(imie => {
                    const pracownik = znajdzPracownika(pracownicy, null, imie);
                    // Nieznane nazwisko ze starego raportu zachowujemy jako identyfikator tekstowy,
                    // żeby nie przypisać jego wyniku bieżącemu użytkownikowi.
                    return { id: pracownik ? String(pracownik.id) : imie, imie, zmiany: [] };
                });
            }
            if (osoby.length > 0) zrodlo = 'raport';
        }

        // 3) Ostateczny fallback: zalogowany użytkownik (np. pierwszy raport przed grafikiem).
        if (osoby.length === 0 && currentUserData) {
            osoby = [{
                id: pobierzIdPracownika(currentUserData),
                imie: currentUserData.imie || currentUserData.login || "",
                zmiany: []
            }];
            zrodlo = 'uzytkownik';
        }

        aktualniSprzedawcyDnia = osoby.filter(osoba => osoba.id);
        renderujSprzedawcowRaportu(aktualniSprzedawcyDnia, zrodlo);
    } catch (e) {
        if (container) container.innerHTML = "Błąd ładowania obsady.";
    }
}

window.zmienDateWFormularzu = () => zaladujDaneRaportuDnia(document.getElementById('raport-data').value);

/* Obsada dni z grafiku: kto pracował danego dnia (zmiana ranna / zamknięcie). */
function pobierzObsadeGrafikuMiesiaca(grafikData) {
    const obsada = {};
    if (!grafikData) return obsada;

    const pracownicy = Array.isArray(grafikData.employees) ? grafikData.employees : [];
    const nazwy = {};
    pracownicy.forEach(e => {
        if (e && e.id !== undefined && e.id !== null) {
            nazwy[String(e.id)] = e.imie || e.login || String(e.id);
        }
    });

    // Awaryjnie korzystamy z listy pracowników wczytanej przez moduł grafiku (starsze zapisy bez employees).
    const znajdzNazwe = (id) => {
        if (nazwy[id]) return nazwy[id];
        const listaGrafiku = (typeof bazaPracownikowGrafik !== 'undefined' && Array.isArray(bazaPracownikowGrafik))
            ? bazaPracownikowGrafik
            : [];
        const poId = listaGrafiku.find(u => String(u.id) === id);
        if (poId && poId.imie) return poId.imie;

        // Bardzo stare grafiki kluczowały komórki pełnym imieniem i nazwiskiem zamiast UID.
        const klucz = String(id).trim();
        const poNazwie = [...Object.values(nazwy), ...listaGrafiku.filter(Boolean).map(u => u.imie)]
            .filter(Boolean)
            .find(imie => imie === klucz || pobierzImieKrotkie(imie) === klucz);
        if (poNazwie) return poNazwie;

        // Jeśli klucz wygląda na imię i nazwisko, pokazujemy go zamiast „Pracownik”.
        return /\s/.test(klucz) ? klucz : "Pracownik";
    };

    const entries = grafikData.entries || {};
    Object.keys(entries).forEach(klucz => {
        const komorka = entries[klucz];
        if (!komorka || komorka.type !== 'praca' || !(Number(komorka.hours) > 0)) return;

        // Klucz ma postać: {empId}_{dzien}_{rano|zamkniecie}. Identyfikator może zawierać znak '_'.
        const czesci = String(klucz).split('_');
        if (czesci.length < 3) return;
        const zmiana = czesci.pop();
        const dzien = czesci.pop();
        if (!/^\d{1,2}$/.test(dzien) || (zmiana !== 'rano' && zmiana !== 'zamkniecie')) return;

        const id = czesci.join('_');
        const imie = znajdzNazwe(id);
        if (!obsada[dzien]) obsada[dzien] = { rano: [], zamkniecie: [] };
        if (!obsada[dzien][zmiana].some(osoba => String(osoba.id) === String(id))) {
            obsada[dzien][zmiana].push({ id, imie, krotkie: pobierzImieKrotkie(imie) });
        }
    });

    return obsada;
}

/* Osoby pracujące w danym dniu wg grafiku, z informacją o zmianach (R = rano, Z = zamknięcie). */
function pobierzSprzedawcowDniaGrafiku(grafikData, dzien) {
    if (!grafikData || !dzien) return [];
    const obsada = pobierzObsadeGrafikuMiesiaca(grafikData);
    const daneDnia = obsada[String(Number(dzien))];
    if (!daneDnia) return [];

    const mapa = new Map();
    const dodaj = (osoby, oznaczenie) => {
        (osoby || []).forEach(osoba => {
            const klucz = String(osoba.id);
            if (!mapa.has(klucz)) {
                mapa.set(klucz, { id: osoba.id, imie: osoba.imie, zmiany: [] });
            }
            const wpis = mapa.get(klucz);
            if (!wpis.zmiany.includes(oznaczenie)) wpis.zmiany.push(oznaczenie);
        });
    };

    dodaj(daneDnia.rano, 'R');
    dodaj(daneDnia.zamkniecie, 'Z');
    return Array.from(mapa.values());
}

function opisObsadyDnia(obsada, zmiana) {
    if (!obsada || !Array.isArray(obsada[zmiana]) || obsada[zmiana].length === 0) return "";
    return obsada[zmiana].map(osoba => osoba.krotkie || osoba.imie).join(', ');
}

function tytulObsadyDnia(obsada) {
    if (!obsada) return "";
    const czesci = [];
    if (obsada.rano && obsada.rano.length > 0) {
        czesci.push(`Rano: ${obsada.rano.map(osoba => osoba.imie).join(', ')}`);
    }
    if (obsada.zamkniecie && obsada.zamkniecie.length > 0) {
        czesci.push(`Zamknięcie: ${obsada.zamkniecie.map(osoba => osoba.imie).join(', ')}`);
    }
    return czesci.join(' | ');
}

function komorkaDniaZObsada(dzien, obsada, zapasowiSprzedawcy = []) {
    const daneDnia = obsada[String(dzien)];
    const rano = opisObsadyDnia(daneDnia, 'rano');
    const zamkniecie = opisObsadyDnia(daneDnia, 'zamkniecie');
    const tytul = tytulObsadyDnia(daneDnia);
    const linie = [];
    if (rano) linie.push(`<div class="text-muted" style="font-size:0.72em; line-height:1.25;">R: ${ucieczkaHtml(rano)}</div>`);
    if (zamkniecie) linie.push(`<div class="text-muted" style="font-size:0.72em; line-height:1.25;">Z: ${ucieczkaHtml(zamkniecie)}</div>`);

    let atrybutTytulu = tytul ? ` title="${ucieczkaHtml(tytul)}"` : '';
    // Gdy nie ma grafiku dla tego dnia, pokazujemy sprzedawców z raportu — to jedyna dostępna informacja o obsadzie.
    if (linie.length === 0 && Array.isArray(zapasowiSprzedawcy) && zapasowiSprzedawcy.length > 0) {
        const krotkie = zapasowiSprzedawcy.map(imie => pobierzImieKrotkie(imie)).filter(Boolean).join(', ');
        if (krotkie) {
            linie.push(`<div class="text-muted" style="font-size:0.72em; line-height:1.25;">👤 ${ucieczkaHtml(krotkie)}</div>`);
            atrybutTytulu = ` title="Obsada z raportu sprzedaży: ${ucieczkaHtml(zapasowiSprzedawcy.join(', '))}"`;
        }
    }

    return `<td style="text-align:left; white-space:normal;"${atrybutTytulu}><strong>${dzien}</strong>${linie.join('')}</td>`;
}

window.zaladujMiesiacTabela = async function() {
    const poleMiesiaca = document.getElementById('wybrany-miesiac');
    if (poleMiesiaca && !poleMiesiaca.value) poleMiesiaca.value = pobierzBiezacyMiesiacSprzedazy();
    const wybranyMiesiac = poleMiesiaca ? poleMiesiaca.value : "";
    if (!wybranyMiesiac) return;
    const tableContainer = document.getElementById('monthly-table-container');
    const plansContainer = document.getElementById('plans-container');
    if (!tableContainer) return;
    tableContainer.innerHTML = "Pobieranie danych...";
    const [rok, miesiac] = wybranyMiesiac.split('-').map(Number);
    const dniWMiesiacu = new Date(rok, miesiac, 0).getDate();

    try {
        const [snap, planDoc, grafikDoc] = await Promise.all([
            getDocs(collection(db, "sprzedaz")),
            getDoc(doc(db, "plany_miesieczne", wybranyMiesiac)),
            // Grafik jest tylko informacją dodatkową — jego brak lub błąd odczytu nie blokuje tabeli.
            getDoc(doc(db, "grafiki", wybranyMiesiac)).catch(e => {
                console.warn("Nie udało się odczytać grafiku dla obsady dni:", e);
                return null;
            })
        ]);

        const obsadaDni = pobierzObsadeGrafikuMiesiaca(grafikDoc && grafikDoc.exists() ? grafikDoc.data() : null);

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
        const planyRaw = planDoc.exists() ? planDoc.data() : {};
        const plany = {
            kawa: Number(planyRaw.kawa) || 0,
            hd: Number(planyRaw.hd) || 0,
            sklep: Number(planyRaw.sklep) || 0
        };
        let ostatniDzienRaportu = 0;
        for (let d = 1; d <= dniWMiesiacu; d++) {
            if (raporty[`${wybranyMiesiac}-${String(d).padStart(2, '0')}`]) ostatniDzienRaportu = d;
        }
        const pt = ostatniDzienRaportu / dniWMiesiacu;

        const rowPlan = (nazwa, katKey, wyk, plan) => {
            const planLiczba = Number(plan) || 0;
            const pProp = planLiczba * pt, d100 = wyk - planLiczba, dProp = wyk - pProp;
            const p100 = planLiczba > 0 ? (wyk / planLiczba) * 100 : 0, pP = pProp > 0 ? (wyk / pProp) * 100 : 0;
            const planCell = czyAdmin ? `<input type="number" step="0.01" id="plan-input-${katKey}" value="${planLiczba}" onchange="window.zapiszPlanMiesieczny()" class="compact-input">` : `${planLiczba.toFixed(2)}`;
            return `<tr><td><strong>${nazwa}</strong></td><td>${wyk.toFixed(2)}</td><td>${planCell}</td><td class="${p100>=100?'val-green':'val-red'}">${p100.toFixed(1)}%</td><td class="${d100>=0?'val-green':'val-red'}">${d100.toFixed(2)}</td><td>${pProp.toFixed(2)}</td><td class="${pP>=100?'val-green':'val-red'}">${pP.toFixed(1)}%</td><td class="${dProp>=0?'val-green':'val-red'}">${dProp.toFixed(2)}</td></tr>`;
        };

        if (plansContainer) plansContainer.innerHTML = `<p class="text-muted">Proporcja wg ostatniego raportu: Dzień ${ostatniDzienRaportu} z ${dniWMiesiacu} (${(pt*100).toFixed(1)}%)</p>
        <div class="table-responsive"><table class="month-table"><tr><th>Kat.</th><th>Wykon.</th><th>Plan</th><th>% Planu</th><th>Różnica</th><th>Plan prop.</th><th>% Prop.</th><th>Różnica</th></tr>
        ${rowPlan('☕ Kawa', 'kawa', sKawaW, plany.kawa || 0)}
        ${rowPlan('🌭 HD', 'hd', sHdW, plany.hd || 0)}
        ${rowPlan('🛒 Sklep', 'sklep', sSklepW, plany.sklep || 0)}</table></div>`;

        let tableHtml = `<div class="table-responsive"><table class="month-table"><tr><th style="width: 110px;">Dzień / obsada</th><th>Kawa (szt / zł)</th><th>HD (szt / zł)</th><th>Sklep (zł)</th><th>Suma (zł)</th></tr>`;
        for (let d = 1; d <= dniWMiesiacu; d++) {
            const dStr = `${wybranyMiesiac}-${String(d).padStart(2, '0')}`;
            const r = raporty[dStr];
            const komorkaDnia = komorkaDniaZObsada(d, obsadaDni, Array.isArray(r?.sprzedawcy) ? r.sprzedawcy : []);
            if (r) {
                const sumD = (Number(r.kawa?.wartosc)||0) + (Number(r.hd?.wartosc)||0) + (Number(r.sklep?.wartosc)||0);
                tableHtml += `<tr class="cleaning-row" onclick="window.otworzDzien('${dStr}')">${komorkaDnia}<td>${r.kawa?.ilosc||0} / ${(Number(r.kawa?.wartosc)||0).toFixed(2)}</td><td>${r.hd?.ilosc||0} / ${(Number(r.hd?.wartosc)||0).toFixed(2)}</td><td>${(Number(r.sklep?.wartosc)||0).toFixed(2)}</td><td><strong>${sumD.toFixed(2)}</strong></td></tr>`;
            } else {
                tableHtml += `<tr class="cleaning-row" style="opacity:0.75;" onclick="window.otworzDzien('${dStr}')">${komorkaDnia}<td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
            }
        }
        tableHtml += `<tr class="sum-row"><td>SUMA</td><td>${sKawaI} / ${sKawaW.toFixed(2)}</td><td>${sHdI} / ${sHdW.toFixed(2)}</td><td>${sSklepW.toFixed(2)}</td><td>${sTotalW.toFixed(2)}</td></tr></table></div>`;
        tableContainer.innerHTML = tableHtml;
    } catch (e) {
        console.error("Błąd ładowania tabeli sprzedaży:", e);
        tableContainer.innerHTML = `Błąd ładowania: ${ucieczkaHtml(e && e.message ? e.message : "nieznany błąd")}. Odśwież stronę (Ctrl+F5).`;
    }
};

window.zapiszPlanMiesieczny = async function() {
    const wybranyMiesiac = document.getElementById('wybrany-miesiac').value;
    try {
        await setDoc(doc(db, "plany_miesieczne", wybranyMiesiac), {
            kawa: Math.max(0, Number(document.getElementById('plan-input-kawa').value) || 0),
            hd: Math.max(0, Number(document.getElementById('plan-input-hd').value) || 0),
            sklep: Math.max(0, Number(document.getElementById('plan-input-sklep').value) || 0),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        window.zaladujMiesiacTabela();
    } catch (e) { alert("Błąd zapisu planu."); }
};

window.zapiszSprzedaz = async function() {
    const data = document.getElementById('raport-data').value;
    if (!data) return alert("Wybierz datę raportu!");
    if (czyDataJestWPrzyszlosci(data)) {
        return alert("Nie można zapisywać raportów dla przyszłych dni. Wybierz dzisiejszą lub wcześniejszą datę.");
    }

    // Sprzedawcy są wyliczani automatycznie z grafiku przy wczytaniu dnia.
    const zaznaczeni = aktualniSprzedawcyDnia.filter(osoba => osoba && osoba.id);
    if (zaznaczeni.length === 0) {
        return alert("Brak obsady do przypisania wyniku. Uzupełnij grafik na ten dzień i odśwież widok.");
    }

    const naLiczbe = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
    const btn = document.getElementById('btn-zapisz-raport');
    btn.disabled = true; btn.innerText = "Zapisywanie...";

    try {
        const ref = doc(db, "sprzedaz", data);
        const updatedAt = new Date().toISOString();
        await runTransaction(db, async (transakcja) => {
            const snap = await transakcja.get(ref);
            const zdalny = snap.exists() ? snap.data() : null;
            if (zdalny?.updatedAt && aktualnyRaportUpdatedAt && zdalny.updatedAt !== aktualnyRaportUpdatedAt) {
                throw new Error("Ten raport został w międzyczasie zmieniony przez inną osobę. Odśwież dzień i spróbuj ponownie.");
            }
            transakcja.set(ref, {
                data,
                sprzedawcyIds: zaznaczeni.map(x => String(x.id)),
                sprzedawcy: zaznaczeni.map(x => x.imie || String(x.id)),
                kawa: { ilosc: naLiczbe('kawa-ilosc'), wartosc: naLiczbe('kawa-wartosc') },
                hd: { ilosc: naLiczbe('hd-ilosc'), wartosc: naLiczbe('hd-wartosc') },
                sklep: { wartosc: naLiczbe('sklep-wartosc') },
                ostatniaModyfikacjaPrzez: currentUserData ? currentUserData.imie : "Pracownik",
                czasModyfikacji: updatedAt,
                updatedAt,
                timestamp: Date.now()
            }, { merge: true });
        });
        aktualnyRaportUpdatedAt = updatedAt;
        alert("Raport został zapisany!");
        window.location.hash = "#sprzedaz";
    } catch (e) {
        alert("Błąd zapisu: " + e.message);
        await zaladujDaneRaportuDnia(data);
    }
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
            const dataRaportu = r.data || d.id;
            if (dataRaportu && dataRaportu.startsWith(mStr)) {
                const osoby = r.sprzedawcy ? r.sprzedawcy.join(', ') : (r.pracownik || 'Brak');
                html += `<div class="report-box" onclick="window.otworzDzien('${ucieczkaJs(dataRaportu)}')">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong>📅 ${ucieczkaHtml(formatujDateDoWyswietlenia(dataRaportu))}</strong>
                        <span class="badge badge-info">${ucieczkaHtml(osoby)}</span>
                    </div>
                    <div style="font-size:0.9em;">☕ ${r.kawa?.ilosc||0} (${(Number(r.kawa?.wartosc)||0).toFixed(2)} zł) | 🌭 ${r.hd?.ilosc||0} (${(Number(r.hd?.wartosc)||0).toFixed(2)} zł) | 🛒 ${(Number(r.sklep?.wartosc)||0).toFixed(2)} zł</div>
                    <div class="audit-info">Edycja: ${ucieczkaHtml(r.ostatniaModyfikacjaPrzez||'')} (${ucieczkaHtml(formatujDateCzasDoWyswietlenia(r.czasModyfikacji))})</div>
                </div>`;
            }
        });
        list.innerHTML = html || "<p class='text-muted'>Brak raportów w wybranym miesiącu.</p>";
    } catch (e) { list.innerHTML = "Błąd."; }
}
