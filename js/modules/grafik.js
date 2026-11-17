'use strict';
// Moduł Grafik interaktywny (plan, święta, statystyki, edycja komórek, zapis, urlopy).

/* ==================== MODUŁ GRAFIK INTERAKTYWNY ==================== */
let aktualnyGrafikStan = null;
let aktualnyGrafikUpdatedAt = null;
let bazaPracownikowGrafik = [];
let kwartalnePoprzednieMiesiace = {}; // { empId: { sumaPlan: 0, planWymiar: 0 } }

const DNI_TYG_KROTKIE = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const NAZWY_MIESIECY_PL = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

// Obliczanie Wielkanocy algorytmem Meeusa/Jonesa/Butchera dla polskich świąt ruchomych
function obliczWielkanoc(rok) {
    const a = rok % 19;
    const b = Math.floor(rok / 100);
    const c = rok % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const miesiac = Math.floor((h + l - 7 * m + 114) / 31);
    const dzien = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(rok, miesiac - 1, dzien);
}

function pobierzPolskieSwieta(rok) {
    const swieta = new Set([
        `${rok}-01-01`, // Nowy Rok
        `${rok}-01-06`, // Trzech Króli
        `${rok}-05-01`, // Święto Pracy
        `${rok}-05-03`, // Święto Konstytucji 3 Maja
        `${rok}-08-15`, // Wniebowzięcie NMP
        `${rok}-11-01`, // Wszystkich Świętych
        `${rok}-11-11`, // Święto Niepodległości
        `${rok}-12-25`, // Boże Narodzenie I
        `${rok}-12-26`  // Boże Narodzenie II
    ]);
    const wielkanoc = obliczWielkanoc(rok);
    const ponWielk = new Date(wielkanoc); ponWielk.setDate(wielkanoc.getDate() + 1);
    const zieloneSw = new Date(wielkanoc); zieloneSw.setDate(wielkanoc.getDate() + 49);
    const bozeCialo = new Date(wielkanoc); bozeCialo.setDate(wielkanoc.getDate() + 60);

    swieta.add(formatujDateLokalna(wielkanoc));
    swieta.add(formatujDateLokalna(ponWielk));
    swieta.add(formatujDateLokalna(zieloneSw));
    swieta.add(formatujDateLokalna(bozeCialo));
    return swieta;
}

// Wyliczenie nominalnego wymiaru czasu pracy wg Kodeksu Pracy (dni pn-pt minus święta nieprzypadające w niedzielę) * 8h
function obliczNominalnyWymiarMiesiaca(rok, miesiac1_12) {
    const swieta = pobierzPolskieSwieta(rok);
    const dniWMiesiacu = new Date(rok, miesiac1_12, 0).getDate();
    let dniRobocze = 0;
    for (let d = 1; d <= dniWMiesiacu; d++) {
        const dt = new Date(rok, miesiac1_12 - 1, d);
        const dow = dt.getDay(); // 0 = Nd, 6 = Sb
        const ds = formatujDateLokalna(dt);
        if (dow >= 1 && dow <= 5) {
            if (!swieta.has(ds)) dniRobocze++;
        } else if (dow === 6 && swieta.has(ds)) {
            // Święto w sobotę obniża wymiar o 8h (1 dzień)
            dniRobocze--;
        }
    }
    return Math.max(0, dniRobocze * 8);
}

function parsujMnoznikEtatu(umowa, etatStr) {
    if (umowa === 'Zlecenie') return 0;
    if (!etatStr || etatStr === '-' || etatStr === '1/1') return 1;
    if (etatStr.includes('/')) {
        const [l, m] = etatStr.split('/').map(Number);
        if (m > 0 && !isNaN(l)) return l / m;
    }
    const num = parseFloat(etatStr.replace(',', '.'));
    return !isNaN(num) && num > 0 ? num : 1;
}

function pobierzPoprzednieMiesiaceWKwartale(miesiacStr) {
    const [rok, m] = miesiacStr.split('-').map(Number);
    const posInQ = (m - 1) % 3; // 0 = 1. m-c kwartału, 1 = 2. m-c, 2 = 3. m-c
    const lista = [];
    for (let i = 1; i <= posInQ; i++) {
        const prevM = m - i;
        lista.push(`${rok}-${String(prevM).padStart(2, '0')}`);
    }
    return lista;
}

function pobierzPoprzedniMiesiacStr(miesiacStr) {
    let [rok, m] = miesiacStr.split('-').map(Number);
    m -= 1;
    if (m < 1) { m = 12; rok -= 1; }
    return `${rok}-${String(m).padStart(2, '0')}`;
}

function pobierzNastepnyMiesiacStr(miesiacStr) {
    let [rok, m] = miesiacStr.split('-').map(Number);
    m += 1;
    if (m > 12) { m = 1; rok += 1; }
    return `${rok}-${String(m).padStart(2, '0')}`;
}

function utworzDomyslneDniWolneMap(miesiacStr) {
    const [rok, m] = miesiacStr.split('-').map(Number);
    const swieta = pobierzPolskieSwieta(rok);
    const dni = new Date(rok, m, 0).getDate();
    const map = {};
    for (let d = 1; d <= dni; d++) {
        const dt = new Date(rok, m - 1, d);
        const ds = formatujDateLokalna(dt);
        if (dt.getDay() === 0 || swieta.has(ds)) {
            map[String(d)] = true;
        }
    }
    return map;
}

// Aktualizuje metadane pracowników zapisane w grafiku na podstawie bieżącej listy użytkowników.
// Imię odświeżamy zawsze (to tylko etykieta), a umowę/etat tylko dla bieżącego i przyszłych miesięcy,
// żeby nie zmieniać historycznie wyliczonego wymiaru czasu pracy.
function zsynchronizujPracownikowGrafiku(stan, miesiacStr) {
    if (!stan || !Array.isArray(stan.employees)) return;
    const biezacyMiesiac = pobierzBiezacyOkresSystemowy().miesiacStr;
    const czyMoznaZmienicWarunki = miesiacStr >= biezacyMiesiac;
    stan.employees.forEach(emp => {
        const aktualny = bazaPracownikowGrafik.find(u => String(u.id) === String(emp.id));
        if (!aktualny) return;
        if (aktualny.imie) emp.imie = aktualny.imie;
        if (czyMoznaZmienicWarunki) {
            emp.umowa = aktualny.umowa || emp.umowa || 'UoP';
            emp.etat = aktualny.etat || emp.etat || '1/1';
        }
    });
}

window.zaladujGrafikInteraktywny = async function() {
    const miesiacStr = document.getElementById('grafik-miesiac').value;
    if (!miesiacStr) return;

    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    document.getElementById('admin-grafik-panel').classList.toggle('hidden', !czyAdmin);
    document.getElementById('pracownik-grafik-toolbar').classList.toggle('hidden', czyAdmin);

    const wrapper = document.getElementById('grafik-tabela-wrapper');
    wrapper.innerHTML = "Pobieranie danych grafiku...";

    try {
        // Pobierz listę użytkowników z bazy
        const usersSnap = await getDocs(collection(db, "uzytkownicy"));
        bazaPracownikowGrafik = [];
        usersSnap.forEach(d => {
            const u = d.data();
            bazaPracownikowGrafik.push({
                id: d.id,
                imie: u.imie,
                umowa: u.umowa || 'UoP',
                etat: u.etat || '1/1'
            });
        });

        // Pobierz grafik z Firestore
        const docSnap = await getDoc(doc(db, "grafiki", miesiacStr));
        const [rok, m] = miesiacStr.split('-').map(Number);
        const nominalWymiar = obliczNominalnyWymiarMiesiaca(rok, m);

        if (docSnap.exists()) {
            aktualnyGrafikStan = docSnap.data();
            aktualnyGrafikUpdatedAt = aktualnyGrafikStan.updatedAt || null;
            if (!aktualnyGrafikStan.employees) aktualnyGrafikStan.employees = [];
            if (!aktualnyGrafikStan.entries) aktualnyGrafikStan.entries = {};
            if (!aktualnyGrafikStan.holidays) aktualnyGrafikStan.holidays = utworzDomyslneDniWolneMap(miesiacStr);
            if (typeof aktualnyGrafikStan.wymiarNominalny !== 'number') {
                aktualnyGrafikStan.wymiarNominalny = nominalWymiar;
            }
            zsynchronizujPracownikowGrafiku(aktualnyGrafikStan, miesiacStr);
        } else {
            // Nowy miesiąc: zainicjuj pracownikami z bazy (lub skopiuj listę z poprzedniego miesiąca)
            const prevM = pobierzPoprzedniMiesiacStr(miesiacStr);
            const prevSnap = await getDoc(doc(db, "grafiki", prevM));
            let startEmps = [];
            if (prevSnap.exists() && prevSnap.data().employees?.length > 0) {
                startEmps = prevSnap.data().employees.map(e => {
                    const aktU = bazaPracownikowGrafik.find(u => u.id === e.id);
                    const prevStats = e.stats || {};
                    const prevUtil = obliczWykorzystanyUrlopPracownika(prevSnap.data(), e.id, prevStats);
                    const prevDoWyk = Number(prevStats.urlopDoWykorzystania) || 0;
                    const przeniesiony = Math.max(0, prevDoWyk - prevUtil);
                    return {
                        id: e.id,
                        imie: aktU ? aktU.imie : e.imie,
                        umowa: aktU ? aktU.umowa : (e.umowa || 'UoP'),
                        etat: aktU ? aktU.etat : (e.etat || '1/1'),
                        stats: {
                            wymiarCustom: null,
                            urlopZalegly: Number(prevStats.urlopZalegly) || 0,
                            urlopDoWykorzystania: przeniesiony,
                            urlopWykorzystanyCustom: null
                        }
                    };
                });
            } else {
                startEmps = bazaPracownikowGrafik.map(u => ({
                    id: u.id,
                    imie: u.imie,
                    umowa: u.umowa,
                    etat: u.etat,
                    stats: {
                        wymiarCustom: null,
                        urlopZalegly: 0,
                        urlopDoWykorzystania: 0,
                        urlopWykorzystanyCustom: null
                    }
                }));
            }

            aktualnyGrafikStan = {
                miesiac: miesiacStr,
                published: false,
                wymiarNominalny: nominalWymiar,
                holidays: utworzDomyslneDniWolneMap(miesiacStr),
                employees: startEmps,
                entries: {}
            };
            aktualnyGrafikUpdatedAt = null;
        }

        // Pobierz dane z poprzednich miesięcy bieżącego kwartału dla sum kwartalnych
        kwartalnePoprzednieMiesiace = {};
        const prevQMonths = pobierzPoprzednieMiesiaceWKwartale(miesiacStr);
        for (const pm of prevQMonths) {
            const pSnap = await getDoc(doc(db, "grafiki", pm));
            if (pSnap.exists()) {
                const pData = pSnap.data();
                (pData.employees || []).forEach(emp => {
                    if (!kwartalnePoprzednieMiesiace[emp.id]) {
                        kwartalnePoprzednieMiesiace[emp.id] = { sumaPlan: 0, planWymiar: 0 };
                    }
                    const sumaP = obliczSumaPlanPracownika(pData, emp.id);
                    const wymP = pobierzWymiarPracownika(pData, emp);
                    kwartalnePoprzednieMiesiace[emp.id].sumaPlan += sumaP;
                    if (emp.umowa !== 'Zlecenie') {
                        kwartalnePoprzednieMiesiace[emp.id].planWymiar += (sumaP - wymP);
                    }
                });
            }
        }

        renderujGrafikInteraktywny();
        zaladujProsby(miesiacStr);
    } catch (e) {
        wrapper.innerHTML = `<span class="error">Błąd ładowania grafiku: ${e.message}</span>`;
    }
};

function obliczSumaPlanPracownika(grafikData, empId) {
    let suma = 0;
    const entries = grafikData.entries || {};
    Object.keys(entries).forEach(key => {
        if (key.startsWith(`${empId}_`)) {
            const cell = entries[key];
            if (cell && (cell.type === 'praca' || cell.type === 'urlop' || cell.type === 'l4')) {
                suma += Number(cell.hours) || 0;
            }
        }
    });
    return suma;
}

function obliczWykorzystanyUrlopPracownika(grafikData, empId, statsObj) {
    if (statsObj && statsObj.urlopWykorzystanyCustom !== null && statsObj.urlopWykorzystanyCustom !== undefined && statsObj.urlopWykorzystanyCustom !== '') {
        return Number(statsObj.urlopWykorzystanyCustom) || 0;
    }
    let sumaUrlopu = 0;
    const entries = grafikData.entries || {};
    Object.keys(entries).forEach(key => {
        if (key.startsWith(`${empId}_`)) {
            const cell = entries[key];
            if (cell && cell.type === 'urlop') {
                sumaUrlopu += Number(cell.hours) || 0;
            }
        }
    });
    return sumaUrlopu;
}

function pobierzWymiarPracownika(grafikData, emp) {
    if (emp.umowa === 'Zlecenie') return 0;
    const st = emp.stats || {};
    if (st.wymiarCustom !== null && st.wymiarCustom !== undefined && st.wymiarCustom !== '') {
        return Number(st.wymiarCustom) || 0;
    }
    const nom = Number(grafikData.wymiarNominalny) || 0;
    const mnoznik = parsujMnoznikEtatu(emp.umowa, emp.etat);
    return Math.round(nom * mnoznik * 100) / 100;
}

function walidujObsadeGrafiku(grafikData, dniWMiesiacu) {
    const bledyDni = {}; // { dayNum: [komunikaty] }
    const listaAlertow = [];
    const emps = grafikData.employees || [];
    const entries = grafikData.entries || {};
    const holidays = grafikData.holidays || {};

    for (let d = 1; d <= dniWMiesiacu; d++) {
        const isHoliday = !!holidays[String(d)];
        let ranoCount = 0;
        let zamkniecieCount = 0;

        emps.forEach(emp => {
            const cRano = entries[`${emp.id}_${d}_rano`];
            const cZamk = entries[`${emp.id}_${d}_zamkniecie`];
            if (cRano && cRano.type === 'praca' && Number(cRano.hours) > 0) ranoCount++;
            if (cZamk && cZamk.type === 'praca' && Number(cZamk.hours) > 0) zamkniecieCount++;
        });

        const errs = [];
        if (isHoliday) {
            if (ranoCount === 0) errs.push("Brak obsady na zmianie rannej (Niedziela/Święto)");
            else if (ranoCount > 1) errs.push(`Zdublowana obsada rano (${ranoCount} os. zamiast 1)`);
            if (zamkniecieCount > 0) errs.push(`W niedzielę/święto nie powinno być zmiany na zamknięciu (${zamkniecieCount} os.)`);
        } else {
            if (ranoCount === 0) errs.push("Brak obsady rano (1 zmiana)");
            else if (ranoCount > 1) errs.push(`Zdublowana obsada rano (${ranoCount} os.)`);
            if (zamkniecieCount === 0) errs.push("Brak obsady na zamknięciu (2 zmiana)");
            else if (zamkniecieCount > 1) errs.push(`Zdublowana obsada na zamknięciu (${zamkniecieCount} os.)`);
        }

        if (errs.length > 0) {
            bledyDni[d] = errs;
            listaAlertow.push(`<strong>Dzień ${d}:</strong> ${errs.join('; ')}`);
        }
    }
    return { bledyDni, listaAlertow };
}

function renderujGrafikInteraktywny() {
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const wrapper = document.getElementById('grafik-tabela-wrapper');
    const statusBadge = document.getElementById('grafik-status-badge');
    const walidacjaBox = document.getElementById('grafik-walidacja-box');
    const legendaBar = document.getElementById('grafik-legenda-bar');

    // Status publikacji
    if (aktualnyGrafikStan.published) {
        statusBadge.innerHTML = `<span class="badge badge-done">📢 Opublikowany</span>`;
    } else {
        statusBadge.innerHTML = `<span class="badge badge-pending">📝 Wersja robocza (ukryta przed pracownikami)</span>`;
    }

    if (czyAdmin) {
        document.getElementById('btn-ukryj-grafik').classList.toggle('hidden', !aktualnyGrafikStan.published);
        document.getElementById('grafik-click-hint').innerText = "💡 Kliknij kratkę pracownika, aby wpisać godziny/urlop/L4 lub wyróżnić na różowo. Kliknij numer dnia, aby przełączyć Święto/Roboczy.";
        odswiezPanelPracownikowGrafiku();
    } else {
        document.getElementById('grafik-click-hint').innerText = "";
    }

    // Jeśli pracownik i grafik nie jest jeszcze opublikowany
    if (!czyAdmin && !aktualnyGrafikStan.published) {
        walidacjaBox.classList.add('hidden');
        legendaBar.classList.add('hidden');
        wrapper.innerHTML = `
            <div class="field-group" style="text-align:center; padding: 28px 16px; border-left: 4px solid var(--warning);">
                <h4 style="color: var(--warning); margin-bottom: 8px;">⏳ Grafik w trakcie przygotowania</h4>
                <p class="text-muted" style="margin:0;">Kierownik nie opublikował jeszcze grafiku na wybrany miesiąc. Możesz poniżej zgłosić swoje prośby o dni wolne.</p>
            </div>`;
        return;
    }

    legendaBar.classList.remove('hidden');

    const [rok, m] = aktualnyGrafikStan.miesiac.split('-').map(Number);
    const dniWMiesiacu = new Date(rok, m, 0).getDate();
    const emps = aktualnyGrafikStan.employees || [];
    const entries = aktualnyGrafikStan.entries || {};
    const holidays = aktualnyGrafikStan.holidays || {};

    // Walidacja obsady (pokazujemy adminowi na bieżąco)
    const { bledyDni, listaAlertow } = walidujObsadeGrafiku(aktualnyGrafikStan, dniWMiesiacu);
    if (czyAdmin && listaAlertow.length > 0) {
        walidacjaBox.classList.remove('hidden');
        walidacjaBox.innerHTML = `
            <div class="collapsible-header danger" onclick="window.toggleCollapsible('grafik-alerty-szczegoly', 'grafik-alerty-arrow')" style="padding: 8px 12px; font-size:0.9em;">
                <span>⚠️ Alerty obsady zmian (${listaAlertow.length} dni wymaga uwagi)</span>
                <span id="grafik-alerty-arrow">▼ Rozwiń</span>
            </div>
            <div id="grafik-alerty-szczegoly" class="collapsible-content" style="max-height: 160px; overflow-y: auto; font-size: 0.85em;">
                <ul style="margin:0; padding-left:18px;">${listaAlertow.map(a => `<li>${a}</li>`).join('')}</ul>
            </div>`;
    } else {
        walidacjaBox.classList.add('hidden');
    }

    if (emps.length === 0) {
        wrapper.innerHTML = `<p class="text-muted" style="text-align:center; padding:20px;">Brak pracowników w grafiku. Dodaj pracownika powyżej.</p>`;
        return;
    }

    // Budowa tabeli (z przypiętym nagłówkiem oraz kompaktową, zawijaną kolumną Dzień)
    let html = `<div class="table-responsive grafik-scroll-container"><table class="grafik-grid-table">
        <thead>
            <tr>
                <th rowspan="2" class="day-col-th">Dzień</th>`;

    emps.forEach((emp, idx) => {
        const isLast = idx === emps.length - 1;
        const uzTag = emp.umowa === 'Zlecenie' ? ' <span style="font-weight:400; font-size:0.8em;">(UZ)</span>' : '';
        html += `<th colspan="2" class="${isLast ? '' : 'emp-group-end'}">${ucieczkaHtml(emp.imie)}${uzTag}</th>`;
    });
    html += `</tr><tr>`;

    emps.forEach((emp, idx) => {
        const isLast = idx === emps.length - 1;
        html += `<th class="sub-th" title="Zmiana ranna (od otwarcia)">Rano</th>
                 <th class="sub-th ${isLast ? '' : 'emp-group-end'}" title="Zmiana popołudniowa (do zamknięcia)">Zamk.</th>`;
    });
    html += `</tr></thead><tbody>`;

    // Wiersze dni miesiąca
    for (let d = 1; d <= dniWMiesiacu; d++) {
        const dt = new Date(rok, m - 1, d);
        const dowName = DNI_TYG_KROTKIE[dt.getDay()];
        const isHoliday = !!holidays[String(d)];
        const rowClass = isHoliday ? 'grafik-holiday-row' : '';
        const dayErrs = bledyDni[d];
        const alertHtml = (czyAdmin && dayErrs) ? `<span class="day-alert-icon" title="${ucieczkaHtml(dayErrs.join(' | '))}">!</span>` : '';
        const dayClickAttr = czyAdmin ? `onclick="window.przelaczSwietoDnia(${d})" style="cursor:pointer;" title="Kliknij, aby przełączyć tryb: Dzień powszedni (2 zmiany) / Święto-Niedziela (1 zmiana ranna)"` : '';

        html += `<tr class="${rowClass}">
            <td class="day-col" ${dayClickAttr}>${d} <span class="text-muted" style="font-weight:500;">${dowName}</span>${alertHtml}</td>`;

        emps.forEach((emp, idx) => {
            const isLast = idx === emps.length - 1;
            ['rano', 'zamkniecie'].forEach((shift, sIdx) => {
                const key = `${emp.id}_${d}_${shift}`;
                const cell = entries[key] || {};
                let cellText = '';
                let cellClasses = ['grafik-cell'];
                if (czyAdmin) cellClasses.push('editable');
                if (sIdx === 1 && !isLast) cellClasses.push('emp-group-end');

                if (cell.pink) cellClasses.push('cell-pink');

                if (cell.type === 'praca' && cell.hours) {
                    cellText = cell.hours;
                } else if (cell.type === 'urlop') {
                    cellClasses.push('cell-urlop');
                    cellText = `U ${cell.hours || ''}`;
                } else if (cell.type === 'l4') {
                    cellClasses.push('cell-l4');
                    cellText = `L4 ${cell.hours || ''}`;
                }

                const clickCell = czyAdmin ? `onclick="window.otworzModalKomorkiGrafiku('${emp.id}', ${d}, '${shift}')"` : '';
                html += `<td class="${cellClasses.join(' ')}" ${clickCell}>${cellText}</td>`;
            });
        });

        html += `</tr>`;
    }

    // PODSUMOWANIE NA DOLE TABELI
    const obliczStatystykiDlaEmp = (emp) => {
        const isUZ = emp.umowa === 'Zlecenie';
        const st = emp.stats || {};
        const sumaPlan = obliczSumaPlanPracownika(aktualnyGrafikStan, emp.id);
        const prevQ = kwartalnePoprzednieMiesiace[emp.id] || { sumaPlan: 0, planWymiar: 0 };
        const sumaKwartal = prevQ.sumaPlan + sumaPlan;

        if (isUZ) {
            return { isUZ: true, sumaPlan, sumaKwartal };
        }

        const wymiar = pobierzWymiarPracownika(aktualnyGrafikStan, emp);
        const planWymiar = sumaPlan - wymiar;
        const planWymiarKwartal = prevQ.planWymiar + planWymiar;
        const urlopZalegly = Number(st.urlopZalegly) || 0;
        const urlopDoWyk = Number(st.urlopDoWykorzystania) || 0;
        const urlopWykorzystany = obliczWykorzystanyUrlopPracownika(aktualnyGrafikStan, emp.id, st);
        const urlopPozostalo = urlopDoWyk - urlopWykorzystany;

        return {
            isUZ: false, wymiar, sumaPlan, sumaKwartal,
            planWymiar, planWymiarKwartal,
            urlopZalegly, urlopDoWyk, urlopWykorzystany, urlopPozostalo
        };
    };

    const empStatsList = emps.map(e => ({ emp: e, s: obliczStatystykiDlaEmp(e) }));

    const renderStatRow = (label, renderCellFn) => {
        let r = `<tr class="grafik-summary-row"><td class="day-col summary-label">${label}</td>`;
        empStatsList.forEach(({ emp, s }, idx) => {
            const isLast = idx === empStatsList.length - 1;
            r += `<td colspan="2" class="${isLast ? '' : 'emp-group-end'}">${renderCellFn(emp, s)}</td>`;
        });
        return r + `</tr>`;
    };

    // 1. Wymiar czasu pracy
    html += renderStatRow('Wymiar godzin', (emp, s) => {
        if (s.isUZ) return `<span class="text-muted">UZ</span>`;
        if (czyAdmin) {
            return `<input type="number" step="0.5" class="grafik-stat-input" value="${s.wymiar}" onchange="window.zmienStatystykePracownikaGrafik('${emp.id}', 'wymiarCustom', this.value)" title="Nominalny wymiar etatu (${emp.etat}) - kliknij aby nadpisać">`;
        }
        return `${s.wymiar}`;
    });

    // 2. Suma Plan
    html += renderStatRow('Suma Plan', (emp, s) => `<strong>${s.sumaPlan}</strong>`);

    // 3. Suma Plan w Kwartale
    html += renderStatRow('Suma Plan w Kwartale', (emp, s) => `${s.sumaKwartal}`);

    // 4. Plan - wymiar
    html += renderStatRow('Plan - wymiar', (emp, s) => {
        if (s.isUZ) return `-`;
        const cls = s.planWymiar > 0 ? 'val-green' : (s.planWymiar < 0 ? 'val-red' : '');
        return `<span class="${cls}">${s.planWymiar}</span>`;
    });

    // 5. Plan - wymiar Kwartalnie
    html += renderStatRow('Plan - wymiar Kwartalnie', (emp, s) => {
        if (s.isUZ) return `-`;
        const cls = s.planWymiarKwartal > 0 ? 'val-green' : (s.planWymiarKwartal < 0 ? 'val-red' : '');
        return `<span class="${cls}">${s.planWymiarKwartal}</span>`;
    });

    // 6. Urlop zaległy z zeszłego roku
    html += renderStatRow(`Urlop zaległy z ${rok - 1}`, (emp, s) => {
        if (s.isUZ) return `-`;
        if (czyAdmin) {
            return `<input type="number" step="1" class="grafik-stat-input" value="${s.urlopZalegly}" onchange="window.zmienStatystykePracownikaGrafik('${emp.id}', 'urlopZalegly', this.value)">`;
        }
        return `${s.urlopZalegly}`;
    });

    // 7. Urlop do wykorzystania
    html += renderStatRow('Urlop do wykorzystania', (emp, s) => {
        if (s.isUZ) return `-`;
        if (czyAdmin) {
            return `<input type="number" step="1" class="grafik-stat-input" value="${s.urlopDoWyk}" onchange="window.zmienStatystykePracownikaGrafik('${emp.id}', 'urlopDoWykorzystania', this.value)">`;
        }
        return `${s.urlopDoWyk}`;
    });

    // 8. Urlop wykorzystany
    html += renderStatRow('Urlop wykorzystany', (emp, s) => {
        if (s.isUZ) return `-`;
        if (czyAdmin) {
            return `<input type="number" step="1" class="grafik-stat-input" value="${s.urlopWykorzystany}" onchange="window.zmienStatystykePracownikaGrafik('${emp.id}', 'urlopWykorzystanyCustom', this.value)" title="Wylicza się automatycznie z wpisów 'U' w grafiku. Możesz nadpisać ręcznie.">`;
        }
        return `${s.urlopWykorzystany}`;
    });

    // 9. Pozostało do wykorzystania
    html += renderStatRow('Pozostało do wykorzystania', (emp, s) => {
        if (s.isUZ) return `-`;
        const cls = s.urlopPozostalo < 0 ? 'val-red' : 'val-green';
        return `<span class="${cls}">${s.urlopPozostalo}</span>`;
    });

    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;
}

function odswiezPanelPracownikowGrafiku() {
    const chipsContainer = document.getElementById('grafik-pracownicy-chips');
    const selectEl = document.getElementById('grafik-dodaj-pracownika-select');
    const emps = aktualnyGrafikStan.employees || [];

    chipsContainer.innerHTML = emps.map((emp, idx) => `
        <span style="display:inline-flex; align-items:center; gap:5px; background:var(--group-bg); border:1px solid var(--border-color); padding:4px 8px; border-radius:999px; font-size:0.85em; font-weight:600;">
            ${idx > 0 ? `<button type="button" onclick="window.przesunPracownikaWGrafiku(${idx}, -1)" style="background:none; color:var(--text-color); padding:0 2px; margin:0; width:auto; font-size:0.9em;" title="Przesuń w lewo">◀</button>` : ''}
            <span>${ucieczkaHtml(emp.imie)} (${emp.umowa === 'Zlecenie' ? 'UZ' : emp.etat})</span>
            ${idx < emps.length - 1 ? `<button type="button" onclick="window.przesunPracownikaWGrafiku(${idx}, 1)" style="background:none; color:var(--text-color); padding:0 2px; margin:0; width:auto; font-size:0.9em;" title="Przesuń w prawo">▶</button>` : ''}
            <button type="button" onclick="window.usunPracownikaZGrafiku('${emp.id}')" style="background:none; color:var(--danger); padding:0 2px; margin:0; width:auto; font-weight:800;" title="Usuń z tego grafiku">✕</button>
        </span>
    `).join('') || `<span class="text-muted">Brak dodanych pracowników</span>`;

    const obecneIds = new Set(emps.map(e => e.id));
    let optHtml = `<option value="">-- Wybierz pracownika z bazy --</option>`;
    bazaPracownikowGrafik.forEach(u => {
        if (!obecneIds.has(u.id)) {
            optHtml += `<option value="${u.id}">${ucieczkaHtml(u.imie)} (${u.umowa === 'Zlecenie' ? 'UZ' : u.etat})</option>`;
        }
    });
    selectEl.innerHTML = optHtml;
}

window.dodajPracownikaDoGrafikuZSelecta = function() {
    const sel = document.getElementById('grafik-dodaj-pracownika-select');
    const uid = sel.value;
    if (!uid) return alert("Wybierz pracownika z listy!");
    const user = bazaPracownikowGrafik.find(u => u.id === uid);
    if (!user) return;

    aktualnyGrafikStan.employees.push({
        id: user.id,
        imie: user.imie,
        umowa: user.umowa,
        etat: user.etat,
        stats: {
            wymiarCustom: null,
            urlopZalegly: 0,
            urlopDoWykorzystania: 0,
            urlopWykorzystanyCustom: null
        }
    });
    renderujGrafikInteraktywny();
};

window.usunPracownikaZGrafiku = function(empId) {
    if (!confirm("Usunąć tego pracownika z widoku grafiku dla tego miesiąca?")) return;
    aktualnyGrafikStan.employees = aktualnyGrafikStan.employees.filter(e => e.id !== empId);
    renderujGrafikInteraktywny();
};

window.przesunPracownikaWGrafiku = function(index, dir) {
    const arr = aktualnyGrafikStan.employees;
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    renderujGrafikInteraktywny();
};

window.przelaczSwietoDnia = function(day) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    const key = String(day);
    aktualnyGrafikStan.holidays[key] = !aktualnyGrafikStan.holidays[key];
    renderujGrafikInteraktywny();
};

window.zmienStatystykePracownikaGrafik = function(empId, pole, val) {
    const emp = aktualnyGrafikStan.employees.find(e => e.id === empId);
    if (!emp) return;
    if (!emp.stats) emp.stats = {};
    if (val === '' || val === null) {
        emp.stats[pole] = null;
    } else {
        emp.stats[pole] = Number(val);
    }
    renderujGrafikInteraktywny();
};

/* Modal edycji pojedynczej kratki grafiku */
window.otworzModalKomorkiGrafiku = function(empId, day, shift) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    const emp = aktualnyGrafikStan.employees.find(e => e.id === empId);
    if (!emp) return;

    const key = `${empId}_${day}_${shift}`;
    const cell = aktualnyGrafikStan.entries[key];

    document.getElementById('gk-emp-id').value = empId;
    document.getElementById('gk-day').value = day;
    document.getElementById('gk-shift').value = shift;
    document.getElementById('modal-gk-tytul').innerText = `✏️ ${emp.imie} — Dzień ${day} (${shift === 'rano' ? 'Rano' : 'Zamknięcie'})`;

    const typSelect = document.getElementById('gk-typ');
    if (!cell || (!cell.type && !cell.pink) || (cell.type === 'puste' && !cell.pink)) {
        // Pusta kratka -> domyślnie "Godziny pracy"
        typSelect.value = 'praca';
        document.getElementById('gk-godziny-val').value = 12;
        document.getElementById('gk-pink-mark').checked = false;
    } else {
        // Istniejący wpis -> zachowaj zapisany typ
        if (cell.type === 'puste' && cell.pink) {
            typSelect.value = 'wolne_prosba';
        } else {
            typSelect.value = cell.type || 'praca';
        }
        document.getElementById('gk-godziny-val').value = cell.hours || (typSelect.value === 'praca' ? 12 : 8);
        document.getElementById('gk-pink-mark').checked = !!cell.pink;
    }

    window.zmienTypKomorkiGrafiku();
    document.getElementById('modal-grafik-komorka').classList.remove('hidden');
};

window.zmienTypKomorkiGrafiku = function() {
    const typ = document.getElementById('gk-typ').value;
    const godzBox = document.getElementById('gk-godziny-box');
    const pinkChk = document.getElementById('gk-pink-mark');

    godzBox.classList.toggle('hidden', typ === 'wolne_prosba' || typ === 'puste');
    if (typ === 'wolne_prosba') pinkChk.checked = true;
    if (typ === 'puste') pinkChk.checked = false;
    if ((typ === 'urlop' || typ === 'l4') && !document.getElementById('gk-godziny-val').value) {
        document.getElementById('gk-godziny-val').value = 8;
    }
};

window.zastosujEdycjeKomorkiGrafiku = function() {
    const empId = document.getElementById('gk-emp-id').value;
    const day = document.getElementById('gk-day').value;
    const shift = document.getElementById('gk-shift').value;
    const typ = document.getElementById('gk-typ').value;
    const hours = Number(document.getElementById('gk-godziny-val').value) || 0;
    const pink = document.getElementById('gk-pink-mark').checked;
    const key = `${empId}_${day}_${shift}`;

    if (typ === 'puste' && !pink) {
        delete aktualnyGrafikStan.entries[key];
    } else if (typ === 'wolne_prosba') {
        aktualnyGrafikStan.entries[key] = { type: 'puste', hours: 0, pink: true };
    } else {
        aktualnyGrafikStan.entries[key] = {
            type: hours > 0 ? typ : 'puste',
            hours: hours > 0 ? hours : 0,
            pink
        };
    }

    window.zamknijModalKomorkiGrafiku();
    renderujGrafikInteraktywny();
};

window.zamknijModalKomorkiGrafiku = () => document.getElementById('modal-grafik-komorka').classList.add('hidden');

/* Zapisywanie, publikacja i przenoszenie urlopów */
window.zapiszGrafikInteraktywny = async function(opublikuj) {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień!");
    if (!aktualnyGrafikStan || !aktualnyGrafikStan.miesiac) return alert("Brak załadowanego grafiku.");
    const miesiacStr = aktualnyGrafikStan.miesiac;
    const poprzedniPublished = !!aktualnyGrafikStan.published;
    if (opublikuj) aktualnyGrafikStan.published = true;

    const ref = doc(db, "grafiki", miesiacStr);
    const updatedAt = new Date().toISOString();

    try {
        const daneDoZapisu = JSON.parse(JSON.stringify(aktualnyGrafikStan));
        delete daneDoZapisu.updatedAt;

        await runTransaction(db, async (transakcja) => {
            const snap = await transakcja.get(ref);
            const zdalnyUpdatedAt = snap.exists() ? (snap.data().updatedAt || null) : null;
            if (snap.exists() && zdalnyUpdatedAt && aktualnyGrafikUpdatedAt && zdalnyUpdatedAt !== aktualnyGrafikUpdatedAt) {
                throw new Error("Grafik został w międzyczasie zmieniony przez inną osobę. Odśwież widok i spróbuj ponownie.");
            }
            transakcja.set(ref, {
                ...daneDoZapisu,
                updatedAt,
                updatedBy: pobierzIdPracownika(currentUserData),
                updatedByName: currentUserData.imie || ""
            });
        });

        aktualnyGrafikUpdatedAt = updatedAt;
        aktualnyGrafikStan.updatedAt = updatedAt;
        renderujGrafikInteraktywny();
        alert(opublikuj ? "📢 Grafik został zapisany i opublikowany dla pracowników!" : "💾 Zapisano wersję roboczą grafiku.");
    } catch (e) {
        if (opublikuj) aktualnyGrafikStan.published = poprzedniPublished;
        renderujGrafikInteraktywny();
        alert("Błąd zapisu grafiku: " + e.message);
    }
};

window.cofnijPublikacjeGrafiku = async function() {
    if (!confirm("Czy na pewno chcesz ukryć grafik przed pracownikami (powrót do wersji roboczej)?")) return;
    aktualnyGrafikStan.published = false;
    await window.zapiszGrafikInteraktywny(false);
};

window.przeniesUrlopyNaKolejnyMiesiac = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    if (!aktualnyGrafikStan) return;
    const biezacyM = aktualnyGrafikStan.miesiac;
    const nastepnyM = pobierzNastepnyMiesiacStr(biezacyM);

    if (!confirm(`Czy przenieść pozostały do wykorzystania urlop z miesiąca ${biezacyM} do pozycji „Urlop do wykorzystania” w miesiącu ${nastepnyM}?`)) return;

    const teraz = new Date().toISOString();
    const autorId = pobierzIdPracownika(currentUserData);
    const autorImie = currentUserData.imie || "";

    const przeniesienia = [];
    (aktualnyGrafikStan.employees || []).forEach(emp => {
        if (emp.umowa === 'Zlecenie') return;
        const st = emp.stats || {};
        const doWyk = Number(st.urlopDoWykorzystania) || 0;
        const wyk = obliczWykorzystanyUrlopPracownika(aktualnyGrafikStan, emp.id, st);
        przeniesienia.push({
            id: emp.id,
            imie: emp.imie,
            umowa: emp.umowa,
            etat: emp.etat,
            urlopZalegly: Number(st.urlopZalegly) || 0,
            pozostalo: Math.max(0, doWyk - wyk)
        });
    });

    try {
        // 1. Najpierw zapisz bieżący miesiąc — z kontrolą konfliktu, żeby nie nadpisać cudzych zmian.
        const biezacyRef = doc(db, "grafiki", biezacyM);
        const daneBiezace = JSON.parse(JSON.stringify(aktualnyGrafikStan));
        delete daneBiezace.updatedAt;

        await runTransaction(db, async (transakcja) => {
            const snap = await transakcja.get(biezacyRef);
            const zdalnyUpdatedAt = snap.exists() ? (snap.data().updatedAt || null) : null;
            if (snap.exists() && zdalnyUpdatedAt && aktualnyGrafikUpdatedAt && zdalnyUpdatedAt !== aktualnyGrafikUpdatedAt) {
                throw new Error("Grafik bieżącego miesiąca został zmieniony przez inną osobę. Odśwież widok i spróbuj ponownie.");
            }
            transakcja.set(biezacyRef, {
                ...daneBiezace,
                updatedAt: teraz,
                updatedBy: autorId,
                updatedByName: autorImie
            });
        });
        aktualnyGrafikUpdatedAt = teraz;
        aktualnyGrafikStan.updatedAt = teraz;

        // 2. Następnie zapisz kolejny miesiąc w transakcji.
        const nextRef = doc(db, "grafiki", nastepnyM);
        const [nRok, nM] = nastepnyM.split('-').map(Number);

        await runTransaction(db, async (transakcja) => {
            const nextSnap = await transakcja.get(nextRef);
            const nextData = nextSnap.exists() ? { ...nextSnap.data() } : {
                miesiac: nastepnyM,
                published: false,
                wymiarNominalny: obliczNominalnyWymiarMiesiaca(nRok, nM),
                holidays: utworzDomyslneDniWolneMap(nastepnyM),
                employees: [],
                entries: {}
            };
            nextData.miesiac = nextData.miesiac || nastepnyM;
            if (!Array.isArray(nextData.employees)) nextData.employees = [];
            if (!nextData.entries) nextData.entries = {};

            przeniesienia.forEach(p => {
                let targetEmp = nextData.employees.find(e => String(e.id) === String(p.id));
                if (!targetEmp) {
                    targetEmp = {
                        id: p.id,
                        imie: p.imie,
                        umowa: p.umowa,
                        etat: p.etat,
                        stats: {
                            wymiarCustom: null,
                            urlopZalegly: p.urlopZalegly,
                            urlopDoWykorzystania: p.pozostalo,
                            urlopWykorzystanyCustom: null
                        }
                    };
                    nextData.employees.push(targetEmp);
                } else {
                    if (!targetEmp.stats) targetEmp.stats = {};
                    targetEmp.stats.urlopDoWykorzystania = p.pozostalo;
                }
            });

            transakcja.set(nextRef, {
                ...nextData,
                updatedAt: teraz,
                updatedBy: autorId,
                updatedByName: autorImie
            });
        });

        alert(`✅ Przeniesiono pozostałe godziny urlopu do grafiku na miesiąc ${nastepnyM}!`);
    } catch (e) {
        alert("Błąd podczas przenoszenia urlopów: " + e.message);
    }
};
