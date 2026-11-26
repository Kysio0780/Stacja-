'use strict';
// Moduł Finanse (tylko administrator).
// Odtwarza sposób prowadzenia danych z arkusza Premie2026:
//   prognoza  — premia z planu i wykonania sprzedaży, z porównaniem do roku poprzedniego,
//   rozliczenie — wynagrodzenia pracowników (UOP, UZ, premie P1/P2, wypłacona, różnica),
//   finanse   — przychody i koszty miesięczne z analizą procentową (budżet).

const FIN_KATEGORIE = [
    { key: 'kawa', nazwa: '☕ Kawa', progDomyslny: 0.68, stawkaDomyslna: 0.22 },
    { key: 'hd', nazwa: '🌭 HD', progDomyslny: 0.68, stawkaDomyslna: 0.30 },
    { key: 'sklep', nazwa: '🛒 Sklep', progDomyslny: 0.68, stawkaDomyslna: 0.22 }
];

const FIN_KOSZTY = [
    { key: 'vat', nazwa: 'VAT' },
    { key: 'pit4', nazwa: 'PIT4' },
    { key: 'pit5', nazwa: 'PIT5' },
    { key: 'wynagrodzenia', nazwa: 'Wynagrodzenia' },
    { key: 'zus', nazwa: 'ZUS' },
    { key: 'ubezpi', nazwa: 'Ubezpieczenia' },
    { key: 'biuro', nazwa: 'Biuro' },
    { key: 'leasing', nazwa: 'Leasing' },
    { key: 'orange', nazwa: 'Orange' },
    { key: 'inne', nazwa: 'Inne' },
    { key: 'ocSp', nazwa: 'OC SP' },
    { key: 'nissan', nazwa: 'Nissan' },
    { key: 'hyundai', nazwa: 'Hyundai' },
    { key: 'kids', nazwa: 'Kids' },
    { key: 'przeterminy', nazwa: 'Przeterminy' }
];

const FIN_KOLEKCJA_PROGNOZA = 'finanse_prognoza';
const FIN_KOLEKCJA_ROZLICZENIE = 'finanse_rozliczenie';
const FIN_KOLEKCJA_BUDZET = 'finanse_budzet';

let finanseTab = 'prognoza';
let finansePrognozaCache = {};

/* ---------- pomocnicze ---------- */

function finLiczba(wartosc) {
    const n = Number(wartosc);
    return isFinite(n) ? n : 0;
}

function finKwota(wartosc) {
    return finLiczba(wartosc).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function finProcent(wartosc) {
    return finLiczba(wartosc).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function finDniWMiesiacu(rok, miesiac) {
    return new Date(rok, miesiac, 0).getDate();
}

// Dzień miesiąca użyty w prognozie: przeszłe = pełny miesiąc, bieżący = dziś, przyszłe = 0.
function finDzienMiesiaca(rok, miesiac) {
    const teraz = new Date();
    const dni = finDniWMiesiacu(rok, miesiac);
    const rokTeraz = teraz.getFullYear();
    if (rok < rokTeraz) return dni;
    if (rok > rokTeraz) return 0;
    const m = teraz.getMonth() + 1;
    if (miesiac < m) return dni;
    if (miesiac > m) return 0;
    return Math.min(teraz.getDate(), dni);
}

function finMiesiacStr(miesiac) {
    return String(miesiac).padStart(2, '0');
}

function finPobierzRok(id) {
    const el = document.getElementById(id);
    const rok = Number(el && el.value) || new Date().getFullYear();
    if (el && !el.value) el.value = String(rok);
    return rok;
}

function finKlasaWartosci(wartosc) {
    return wartosc >= 0 ? 'val-green' : 'val-red';
}

const FIN_MIESIACE_NAZWY = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

function finHtmlOpcjiMiesiecy() {
    return FIN_MIESIACE_NAZWY.map((n, i) => `<option value="${i + 1}">${i + 1} — ${n}</option>`).join('');
}

// Wspólny wybór zakresu: miesiąc, kwartał, rok albo własny przedział od–do.
function finPobierzOkres(prefix) {
    const rodzaj = document.getElementById(`${prefix}-okres`)?.value || 'miesiac';
    if (rodzaj === 'rok') {
        return { miesiace: Array.from({ length: 12 }, (_, i) => i + 1), etykieta: 'ROK' };
    }
    if (rodzaj === 'kwartal') {
        const kwartal = Number(document.getElementById(`${prefix}-okres-kwartal`)?.value) || 1;
        return { miesiace: [1, 2, 3].map(i => (kwartal - 1) * 3 + i), etykieta: `KWARTAŁ ${kwartal}` };
    }
    if (rodzaj === 'oddo') {
        let od = Number(document.getElementById(`${prefix}-okres-od`)?.value) || 1;
        let doMiesiaca = Number(document.getElementById(`${prefix}-okres-do`)?.value) || 12;
        if (od > doMiesiaca) { const tmp = od; od = doMiesiaca; doMiesiaca = tmp; }
        const miesiace = [];
        for (let m = od; m <= doMiesiaca; m++) miesiace.push(m);
        return { miesiace, etykieta: `OD ${od} DO ${doMiesiaca}` };
    }
    const miesiac = Number(document.getElementById(`${prefix}-okres-miesiac`)?.value) || (new Date().getMonth() + 1);
    return { miesiace: [miesiac], etykieta: 'MIESIĄC' };
}

function finPobierzOkresPrognozy() {
    return finPobierzOkres('finanse');
}

function finZmienOkresWidoku(prefix, loader) {
    const rodzaj = document.getElementById(`${prefix}-okres`)?.value || 'miesiac';
    ['miesiac', 'kwartal', 'oddo'].forEach(nazwa => {
        document.getElementById(`${prefix}-okres-${nazwa}-wrap`)?.classList.toggle('hidden', rodzaj !== nazwa);
    });
    loader();
}

window.zmienOkresFinanse = () => finZmienOkresWidoku('finanse', window.zaladujFinansePrognoza);
window.zmienOkresFinanseRozliczenie = () => finZmienOkresWidoku('finanse-roz', window.zaladujFinanseRozliczenie);
window.zmienOkresFinanseBudzet = () => finZmienOkresWidoku('finanse-bud', window.zaladujFinanseBudzet);

// Wbudowuje kontrolki okresu w zakładkach Rozliczenie i Budżet.
function finWbudujKontrolkiOkresu(prefix, zmienHandler, reloadHandler) {
    const kontener = document.getElementById(`${prefix}-okresy`);
    if (!kontener) return;
    const opcje = finHtmlOpcjiMiesiecy();
    kontener.innerHTML = `
        <label for="${prefix}-okres" style="margin:0;">Okres:</label>
        <select id="${prefix}-okres" style="width:125px; margin:0;" onchange="window.${zmienHandler}()">
            <option value="miesiac">Miesiąc</option><option value="kwartal">Kwartał</option>
            <option value="rok">Rok</option><option value="oddo">Od–Do</option>
        </select>
        <span id="${prefix}-okres-miesiac-wrap">
            <label for="${prefix}-okres-miesiac" style="margin:0;">Miesiąc:</label>
            <select id="${prefix}-okres-miesiac" style="width:130px; margin:0;" onchange="window.${reloadHandler}()">${opcje}</select>
        </span>
        <span id="${prefix}-okres-kwartal-wrap" class="hidden">
            <label for="${prefix}-okres-kwartal" style="margin:0;">Kwartał:</label>
            <select id="${prefix}-okres-kwartal" style="width:150px; margin:0;" onchange="window.${reloadHandler}()">
                <option value="1">I (1–3)</option><option value="2">II (4–6)</option>
                <option value="3">III (7–9)</option><option value="4">IV (10–12)</option>
            </select>
        </span>
        <span id="${prefix}-okres-oddo-wrap" class="hidden">
            <label for="${prefix}-okres-od" style="margin:0;">Od:</label>
            <select id="${prefix}-okres-od" style="width:130px; margin:0;" onchange="window.${reloadHandler}()">${opcje}</select>
            <label for="${prefix}-okres-do" style="margin:0;">Do:</label>
            <select id="${prefix}-okres-do" style="width:130px; margin:0;" onchange="window.${reloadHandler}()">${opcje}</select>
        </span>`;
}

/* ---------- dane prognozy ---------- */

async function finPobierzDanePrognozy(rok, wymus = false) {
    if (!wymus && finansePrognozaCache[rok]) return finansePrognozaCache[rok];

    const [dokSnap, planySnap, sprzedazSnap] = await Promise.all([
        getDoc(doc(db, FIN_KOLEKCJA_PROGNOZA, String(rok))).catch(() => null),
        getDocs(collection(db, 'plany_miesieczne')).catch(() => null),
        getDocs(collection(db, 'sprzedaz')).catch(() => null)
    ]);

    const nadpisania = dokSnap && dokSnap.exists() ? dokSnap.data() : {};
    const plany = {};
    const sprzedaz = {};
    if (planySnap) planySnap.forEach(d => { plany[d.id] = d.data(); });
    if (sprzedazSnap) sprzedazSnap.forEach(d => { sprzedaz[d.id] = d.data(); });

    const dane = { parametry: {}, kategorie: {} };
    const parametrNadpisany = nadpisania.parametry || {};
    dane.parametry.prowizjaPodstawowa = parametrNadpisany.prowizjaPodstawowa == null
        ? 0 : finLiczba(parametrNadpisany.prowizjaPodstawowa);
    for (const kat of FIN_KATEGORIE) {
        const parametr = (nadpisania.parametry && nadpisania.parametry[kat.key]) || {};
        dane.parametry[kat.key] = {
            prog: parametr.prog == null ? kat.progDomyslny : finLiczba(parametr.prog),
            stawka: parametr.stawka == null ? kat.stawkaDomyslna : finLiczba(parametr.stawka)
        };
        dane.kategorie[kat.key] = {};
        for (let m = 1; m <= 12; m++) {
            const kluczMiesiaca = `${rok}-${finMiesiacStr(m)}`;
            const nad = (nadpisania[kat.key] && nadpisania[kat.key][String(m)]) || {};

            let plan = finLiczba(plany[kluczMiesiaca] && plany[kluczMiesiaca][kat.key]);
            if (nad.plan != null) plan = finLiczba(nad.plan);

            let wykonanie = 0;
            if (nad.wykonanie != null) {
                wykonanie = finLiczba(nad.wykonanie);
            } else {
                Object.keys(sprzedaz).forEach(id => {
                    if (!id.startsWith(kluczMiesiaca + '-')) return;
                    const r = sprzedaz[id] || {};
                    const pole = kat.key === 'kawa' ? (r.kawa && r.kawa.wartosc)
                        : kat.key === 'hd' ? (r.hd && r.hd.wartosc)
                        : (r.sklep && r.sklep.wartosc);
                    wykonanie += finLiczba(pole);
                });
            }

            const rokPoprzedni = nad.rokPoprzedni == null ? 0 : finLiczba(nad.rokPoprzedni);
            dane.kategorie[kat.key][m] = { plan, wykonanie, rokPoprzedni };
        }
    }
    finansePrognozaCache[rok] = dane;
    return dane;
}

function finObliczMiesiac(wartosci, miesiac, parametr, rok) {
    const dni = finDniWMiesiacu(rok, miesiac);
    const dzien = finDzienMiesiaca(rok, miesiac);
    const prognoza = (wartosci.plan > 0 && dzien > 0) ? (wartosci.wykonanie / wartosci.plan) / dzien * dni : 0;
    const premiaMiesiac = prognoza > parametr.prog
        ? (wartosci.plan * prognoza - wartosci.plan * parametr.prog) * parametr.stawka
        : 0;
    const premiaDoDnia = dni > 0 ? premiaMiesiac * dzien / dni : 0;
    const planVs = wartosci.rokPoprzedni > 0 ? wartosci.plan / wartosci.rokPoprzedni : 0;
    const wykVs = (wartosci.rokPoprzedni > 0 && dzien > 0)
        ? (wartosci.wykonanie / wartosci.rokPoprzedni) / dzien * dni : 0;
    const wykDzien = dzien > 0 ? wartosci.wykonanie / dzien : 0;
    const celDzien = dni > 0 ? wartosci.plan / dni : 0;
    return { dni, dzien, prognoza, premiaMiesiac, premiaDoDnia, planVs, wykVs, wykDzien, celDzien };
}

/* ---------- zakładka: prognoza premii ---------- */

window.zaladujFinansePrognoza = async function() {
    const kontener = document.getElementById('finanse-prognoza-container');
    if (!kontener) return;
    const rok = finPobierzRok('finanse-rok');
    const okres = finPobierzOkresPrognozy();
    kontener.innerHTML = 'Ładowanie danych...';
    try {
        const dane = await finPobierzDanePrognozy(rok, true);
        let html = '';

        html += `<details class="finanse-panel finanse-collapsible">
            <summary>⚙️ Parametry naliczania premii <span class="text-muted">(kliknij, aby rozwinąć)</span></summary>
            <div class="finanse-param-content">
            <p class="text-muted" style="margin:0 0 8px 0;">Premia jest naliczana od nadwyżki prognozy ponad próg. Zmiany zapisują się automatycznie.</p>
            <div class="finanse-param-box" style="margin-bottom:10px;">
                <label for="finanse-prowizja-podstawowa">Prowizja podstawowa firmy z działalności (miesięcznie):</label>
                <input type="number" step="0.01" id="finanse-prowizja-podstawowa" value="${finLiczba(dane.parametry.prowizjaPodstawowa).toFixed(2)}"
                    onchange="window.zapiszFinanseProwizjePodstawowa(this.value)">
            </div>
            <div class="grid-3">`;
        for (const kat of FIN_KATEGORIE) {
            const p = dane.parametry[kat.key];
            html += `<div class="finanse-param-box">
                <strong>${kat.nazwa}</strong>
                <label>Próg realizacji (%)</label>
                <input type="number" step="0.1" min="0" max="200" value="${(p.prog * 100).toFixed(1)}"
                    onchange="window.zapiszFinanseParametr('${kat.key}','prog',this.value)">
                <label>Stawka premii (%)</label>
                <input type="number" step="0.1" min="0" max="100" value="${(p.stawka * 100).toFixed(1)}"
                    onchange="window.zapiszFinanseParametr('${kat.key}','stawka',this.value)">
            </div>`;
        }
        html += `</div></div></details>
        <button onclick="window.finPobierzZeSprzedazy()" class="btn-info" style="margin:10px 0;">🔄 Pobierz plan i wykonanie ze Sprzedaży</button>`;

        const sumy = { plan: 0, wykonanie: 0, rokPoprzedni: 0, premiaMiesiac: 0, premiaDoDnia: 0 };
        for (const kat of FIN_KATEGORIE) {
            const parametr = dane.parametry[kat.key];
            html += `<h4 style="margin:18px 0 4px 0;">${kat.nazwa}</h4>
            <div class="table-responsive"><table class="month-table">
                <tr>
                    <th>M-c</th><th>Dni</th><th>Dzień</th>
                    <th>Plan</th><th>Wykonanie</th><th>Prognoza</th>
                    <th>Premia mies.</th><th>Premia do dnia</th><th>Rok-1</th>
                    <th>Plan/R-1</th><th>Wyk/R-1</th><th>Wyk/dzień</th><th>Cel/dzień</th>
                </tr>`;
            const podsumowanie = { plan: 0, wykonanie: 0, rokPoprzedni: 0, premiaMiesiac: 0, premiaDoDnia: 0 };
            for (const m of okres.miesiace) {
                const w = dane.kategorie[kat.key][m];
                const o = finObliczMiesiac(w, m, parametr, rok);
                podsumowanie.plan += w.plan;
                podsumowanie.wykonanie += w.wykonanie;
                podsumowanie.rokPoprzedni += w.rokPoprzedni;
                podsumowanie.premiaMiesiac += o.premiaMiesiac;
                podsumowanie.premiaDoDnia += o.premiaDoDnia;
                const edytowalne = `
                    <td><input type="number" step="0.01" class="compact-input" value="${w.plan.toFixed(2)}"
                        onchange="window.zapiszFinansePrognoza('${kat.key}',${m},'plan',this.value)"></td>
                    <td><input type="number" step="0.01" class="compact-input" value="${w.wykonanie.toFixed(2)}"
                        onchange="window.zapiszFinansePrognoza('${kat.key}',${m},'wykonanie',this.value)"></td>`;
                html += `<tr>
                    <td><strong>${m}</strong></td><td>${o.dni}</td><td>${o.dzien}</td>
                    ${edytowalne}
                    <td class="${o.prognoza >= 1 ? 'val-green' : 'val-red'}">${finProcent(o.prognoza * 100)}</td>
                    <td>${finKwota(o.premiaMiesiac)}</td>
                    <td><strong>${finKwota(o.premiaDoDnia)}</strong></td>
                    <td><input type="number" step="0.01" class="compact-input" value="${w.rokPoprzedni.toFixed(2)}"
                        onchange="window.zapiszFinansePrognoza('${kat.key}',${m},'rokPoprzedni',this.value)"></td>
                    <td>${w.rokPoprzedni > 0 ? finProcent(w.plan / w.rokPoprzedni * 100) : '—'}</td>
                    <td>${w.rokPoprzedni > 0 ? finProcent(o.wykVs * 100) : '—'}</td>
                    <td>${finKwota(o.wykDzien)}</td>
                    <td>${finKwota(o.celDzien)}</td>
                </tr>`;
            }
            const progRoczna = podsumowanie.plan > 0 ? (podsumowanie.wykonanie / podsumowanie.plan) * 100 : 0;
            html += `<tr class="sum-row">
                <td>${okres.etykieta}</td><td>—</td><td>—</td>
                <td>${finKwota(podsumowanie.plan)}</td>
                <td>${finKwota(podsumowanie.wykonanie)}</td>
                <td>${finProcent(progRoczna)}</td>
                <td>${finKwota(podsumowanie.premiaMiesiac)}</td>
                <td>${finKwota(podsumowanie.premiaDoDnia)}</td>
                <td>${finKwota(podsumowanie.rokPoprzedni)}</td>
                <td>${podsumowanie.rokPoprzedni > 0 ? finProcent(podsumowanie.plan / podsumowanie.rokPoprzedni * 100) : '—'}</td>
                <td>${podsumowanie.rokPoprzedni > 0 ? finProcent(podsumowanie.wykonanie / podsumowanie.rokPoprzedni * 100) : '—'}</td>
                <td>—</td><td>—</td>
            </tr></table></div>`;
            Object.keys(sumy).forEach(k => { sumy[k] += podsumowanie[k]; });
        }

        html += `<h4 style="margin:18px 0 4px 0;">📊 Podsumowanie premii — wszystkie kategorie (${okres.etykieta})</h4>
        <div class="table-responsive"><table class="month-table">
            <tr><th>Miesiąc</th><th>Premia prognoza (pełny miesiąc)</th><th>Premia do dnia</th></tr>`;
        for (const m of okres.miesiace) {
            let premiaMiesiac = 0, premiaDoDnia = 0;
            for (const kat of FIN_KATEGORIE) {
                const o = finObliczMiesiac(dane.kategorie[kat.key][m], m, dane.parametry[kat.key], rok);
                premiaMiesiac += o.premiaMiesiac;
                premiaDoDnia += o.premiaDoDnia;
            }
            html += `<tr><td>${m}</td><td>${finKwota(premiaMiesiac)}</td><td><strong>${finKwota(premiaDoDnia)}</strong></td></tr>`;
        }
        html += `<tr class="sum-row"><td>${okres.etykieta}</td><td>${finKwota(sumy.premiaMiesiac)}</td><td>${finKwota(sumy.premiaDoDnia)}</td></tr>
        </table></div>`;

        kontener.innerHTML = html;
    } catch (e) {
        kontener.innerHTML = `<span class="error">Błąd ładowania prognozy: ${ucieczkaHtml(e.message)}</span>`;
    }
};

window.zapiszFinansePrognoza = async function(kat, miesiac, pole, wartosc) {
    const rok = finPobierzRok('finanse-rok');
    const liczba = Math.max(0, finLiczba(wartosc));
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_PROGNOZA, String(rok)), {
            [kat]: { [String(miesiac)]: { [pole]: liczba } }
        }, { merge: true });
        await window.zaladujFinansePrognoza();
    } catch (e) { alert('Błąd zapisu prognozy: ' + e.message); }
};

window.zapiszFinanseParametr = async function(kat, pole, wartosc) {
    const rok = finPobierzRok('finanse-rok');
    const liczba = Math.max(0, finLiczba(wartosc)) / 100;
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_PROGNOZA, String(rok)), {
            parametry: { [kat]: { [pole]: liczba } }
        }, { merge: true });
        await window.zaladujFinansePrognoza();
    } catch (e) { alert('Błąd zapisu parametrów: ' + e.message); }
};

window.zapiszFinanseProwizjePodstawowa = async function(wartosc) {
    const rok = finPobierzRok('finanse-rok');
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_PROGNOZA, String(rok)), {
            parametry: { prowizjaPodstawowa: Math.max(0, finLiczba(wartosc)) }
        }, { merge: true });
        await window.zaladujFinansePrognoza();
    } catch (e) { alert('Błąd zapisu prowizji podstawowej: ' + e.message); }
};

window.finPobierzZeSprzedazy = async function() {
    const rok = finPobierzRok('finanse-rok');
    const dane = {};
    for (const kat of FIN_KATEGORIE) {
        dane[kat.key] = {};
        for (let m = 1; m <= 12; m++) dane[kat.key][String(m)] = { plan: null, wykonanie: null };
    }
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_PROGNOZA, String(rok)), dane, { merge: true });
        alert('Plan i wykonanie pobrane z modułu Sprzedaż (dane wprowadzone ręcznie zostały wyczyszczone).');
        await window.zaladujFinansePrognoza();
    } catch (e) { alert('Błąd pobierania danych: ' + e.message); }
};

/* ---------- zakładka: rozliczenie wynagrodzeń ---------- */

async function finPobierzRozliczenie(rok, miesiac) {
    const id = `${rok}-${finMiesiacStr(miesiac)}`;
    const snap = await getDoc(doc(db, FIN_KOLEKCJA_ROZLICZENIE, id)).catch(() => null);
    return snap && snap.exists() ? snap.data() : {};
}

// Koszty pracodawcy od wynagrodzeń UoP (20,48% — mnożnik z arkusza Premie2026).
const FIN_KOSZTY_PRACODAWCY = 1.2048;

// Rodzaj umowy jest pobierany z modułu Pracownicy (pole `umowa`: UoP lub Zlecenie).
function finCzyZlecenie(pracownik) {
    const umowa = String((pracownik && pracownik.umowa) || 'UoP').toLowerCase();
    return umowa.includes('zlecen') || umowa === 'uz';
}

function finWynagrodzeniePracownika(d, czyZlecenie) {
    const p1 = finLiczba(d.p1);
    const p2 = finLiczba(d.p2);
    const premia = p1 + p2;
    const podstawa = czyZlecenie ? 0 : finLiczba(d.podstawa);
    const stawka = finLiczba(d.stawka);
    const godziny = finLiczba(d.godziny);
    const wynagrodzenieZlecenie = czyZlecenie ? stawka * godziny : 0;
    return {
        p1, p2, premia, podstawa, stawka, godziny, wynagrodzenieZlecenie,
        suma: podstawa + wynagrodzenieZlecenie + premia
    };
}

window.zaladujFinanseRozliczenie = async function() {
    const kontener = document.getElementById('finanse-rozliczenie-container');
    if (!kontener) return;
    const rok = finPobierzRok('finanse-roz-rok');
    const okres = finPobierzOkres('finanse-roz');
    kontener.innerHTML = 'Ładowanie danych...';
    try {
        const [daneRozliczen, pracownicy, prognoza] = await Promise.all([
            Promise.all(okres.miesiace.map(m => finPobierzRozliczenie(rok, m))),
            pobierzListePracownikow().catch(() => []),
            finPobierzDanePrognozy(rok)
        ]);
        const prowizjaPodstawowa = finLiczba(prognoza.parametry.prowizjaPodstawowa);
        const pracownicyUop = pracownicy.filter(p => !finCzyZlecenie(p));
        const pracownicyUz = pracownicy.filter(p => finCzyZlecenie(p));

        let html = `<div class="finanse-panel">
            <div class="finanse-panel-title">🧾 Rozliczenie wynagrodzeń — ${okres.etykieta} / ${rok}</div>
            <p class="text-muted" style="margin:0;">Prowizja podstawowa firmy z działalności:
            <strong>${finKwota(prowizjaPodstawowa)} zł/mies.</strong> Podział premii (P1 i P2) wpisuje administrator.</p>
        </div>`;

        okres.miesiace.forEach((miesiac, idx) => {
            const pracownicyDane = (daneRozliczen[idx] || {}).pracownicy || {};
            const premiaPrognozy = FIN_KATEGORIE.reduce((suma, kat) => {
                const o = finObliczMiesiac(prognoza.kategorie[kat.key][miesiac], miesiac, prognoza.parametry[kat.key], rok);
                return suma + o.premiaDoDnia;
            }, 0);
            const inputPole = (pid, nazwa, wartosc) => `
                <td><input type="number" step="0.01" class="compact-input" value="${Number(wartosc || 0).toFixed(2)}"
                    onchange="window.zapiszFinanseRozliczenie(${miesiac},'${pid}','${nazwa}',this.value)"></td>`;

            html += `<h4 style="margin:18px 0 4px 0;">Miesiąc ${miesiac} / ${rok} — pula premii ${finKwota(premiaPrognozy)} zł</h4>`;

            // Umowa o pracę — Podstawa, P1, P2, Premia razem, Suma.
            html += `<div class="table-responsive"><table class="month-table">
                <tr><th>Pracownik</th><th>Podstawa</th><th>P1</th><th>P2</th><th>Premia razem</th><th>Suma</th></tr>`;
            let sumaPodstawUop = 0, sumaUop = 0;
            for (const p of pracownicyUop) {
                const w = finWynagrodzeniePracownika(pracownicyDane[p.id] || {}, false);
                sumaPodstawUop += w.podstawa;
                sumaUop += w.suma;
                const pid = ucieczkaJs(p.id);
                html += `<tr>
                    <td style="text-align:left;"><strong>${ucieczkaHtml(p.imie || p.id)}</strong></td>
                    ${inputPole(pid, 'podstawa', w.podstawa)}
                    ${inputPole(pid, 'p1', w.p1)}${inputPole(pid, 'p2', w.p2)}
                    <td>${finKwota(w.premia)}</td>
                    <td><strong>${finKwota(w.suma)}</strong></td>
                </tr>`;
            }
            html += `<tr class="sum-row"><td>SUMA UoP</td><td>${finKwota(sumaPodstawUop)}</td>
                <td>—</td><td>—</td><td>—</td><td>${finKwota(sumaUop)}</td></tr></table></div>`;

            // Umowa zlecenie — Stawka, Il. godzin, P1, P2, Premia razem, Suma.
            html += `<div class="table-responsive"><table class="month-table">
                <tr><th>Pracownik</th><th>Stawka</th><th>Il. godzin</th><th>P1</th><th>P2</th><th>Premia razem</th><th>Suma</th></tr>`;
            let sumaUz = 0;
            for (const p of pracownicyUz) {
                const w = finWynagrodzeniePracownika(pracownicyDane[p.id] || {}, true);
                sumaUz += w.suma;
                const pid = ucieczkaJs(p.id);
                html += `<tr>
                    <td style="text-align:left;"><strong>${ucieczkaHtml(p.imie || p.id)}</strong></td>
                    ${inputPole(pid, 'stawka', w.stawka)}${inputPole(pid, 'godziny', w.godziny)}
                    ${inputPole(pid, 'p1', w.p1)}${inputPole(pid, 'p2', w.p2)}
                    <td>${finKwota(w.premia)}</td>
                    <td><strong>${finKwota(w.suma)}</strong></td>
                </tr>`;
            }
            html += `<tr class="sum-row"><td>SUMA UZ</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                <td>${finKwota(sumaUz)}</td></tr></table></div>`;

            // Wynagrodzenia suma — UoP z kosztami pracodawcy, UZ, Total i Bilans.
            const uopZKosztami = sumaUop * FIN_KOSZTY_PRACODAWCY;
            const total = uopZKosztami + sumaUz;
            const bilans = total - (prowizjaPodstawowa + premiaPrognozy);
            html += `<h4 style="margin:14px 0 4px 0;">🧮 Wynagrodzenia suma — miesiąc ${miesiac}</h4>
            <div class="table-responsive"><table class="month-table">
                <tr><th>UoP (z kosztami pracodawcy)</th><th>UZ</th><th>Total</th><th>Bilans</th></tr>
                <tr>
                    <td>${finKwota(uopZKosztami)}</td>
                    <td>${finKwota(sumaUz)}</td>
                    <td><strong>${finKwota(total)}</strong></td>
                    <td class="${finKlasaWartosci(bilans)}"><strong>${finKwota(bilans)}</strong></td>
                </tr>
            </table></div>`;
        });

        kontener.innerHTML = html;
    } catch (e) {
        kontener.innerHTML = `<span class="error">Błąd ładowania rozliczenia: ${ucieczkaHtml(e.message)}</span>`;
    }
};

window.zapiszFinanseRozliczenie = async function(miesiac, pracownikId, pole, wartosc) {
    const rok = finPobierzRok('finanse-roz-rok');
    const id = `${rok}-${finMiesiacStr(miesiac)}`;
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_ROZLICZENIE, id), {
            pracownicy: { [pracownikId]: { [pole]: Math.max(0, finLiczba(wartosc)) } }
        }, { merge: true });
        await window.zaladujFinanseRozliczenie();
    } catch (e) { alert('Błąd zapisu rozliczenia: ' + e.message); }
};

/* ---------- zakładka: analiza budżetu ---------- */

async function finPobierzBudzet(rok) {
    const snaps = await Promise.all(Array.from({ length: 12 }, (_, i) =>
        getDoc(doc(db, FIN_KOLEKCJA_BUDZET, `${rok}-${finMiesiacStr(i + 1)}`)).catch(() => null)
    ));
    return snaps.map(s => (s && s.exists() ? s.data() : {}));
}

window.zaladujFinanseBudzet = async function() {
    const kontener = document.getElementById('finanse-budzet-container');
    if (!kontener) return;
    const rok = finPobierzRok('finanse-bud-rok');
    const okres = finPobierzOkres('finanse-bud');
    kontener.innerHTML = 'Ładowanie danych...';
    try {
        const dane = await finPobierzBudzet(rok);
        const sumyKosztow = {};
        FIN_KOSZTY.forEach(k => { sumyKosztow[k.key] = 0; });
        let przychodRocznie = 0, kosztyRocznie = 0, zostajeRocznie = 0;

        let html = `<div class="finanse-panel">
            <div class="finanse-panel-title">💰 Budżet ${rok} — ${okres.etykieta}</div>
            <p class="text-muted" style="margin:0;">Przychód i koszty wpisuje administrator. „Zostaje" to przychód minus suma kosztów.</p>
            <button onclick="window.finKopiujWynagrodzenia()" class="btn-info" style="margin-top:10px;">🔄 Pobierz wynagrodzenia z Rozliczenia</button>
        </div>`;

        html += `<div class="table-responsive"><table class="month-table">
            <tr><th>M-c</th><th>Przychód (prowizja)</th>${FIN_KOSZTY.map(k => `<th>${k.nazwa}</th>`).join('')}
            <th>Koszty razem</th><th>Zostaje</th><th>% kosztów</th></tr>`;
        for (const m of okres.miesiace) {
            const d = dane[m - 1] || {};
            const koszty = d.koszty || {};
            const przychod = finLiczba(d.przychod);
            let kosztyMiesiac = 0;
            FIN_KOSZTY.forEach(k => {
                const wartosc = finLiczba(koszty[k.key]);
                sumyKosztow[k.key] += wartosc;
                kosztyMiesiac += wartosc;
            });
            const zostaje = przychod - kosztyMiesiac;
            przychodRocznie += przychod;
            kosztyRocznie += kosztyMiesiac;
            zostajeRocznie += zostaje;
            html += `<tr>
                <td><strong>${m}</strong></td>
                <td><input type="number" step="0.01" class="compact-input" value="${przychod.toFixed(2)}"
                    onchange="window.zapiszFinanseBudzet(${m},'przychod',this.value)"></td>
                ${FIN_KOSZTY.map(k => `<td><input type="number" step="0.01" class="compact-input" value="${finLiczba(koszty[k.key]).toFixed(2)}"
                    onchange="window.zapiszFinanseBudzet(${m},'${k.key}',this.value)"></td>`).join('')}
                <td>${finKwota(kosztyMiesiac)}</td>
                <td class="${finKlasaWartosci(zostaje)}"><strong>${finKwota(zostaje)}</strong></td>
                <td>${przychod > 0 ? finProcent(kosztyMiesiac / przychod * 100) : '—'}</td>
            </tr>`;
        }
        html += `<tr class="sum-row">
            <td>${okres.etykieta}</td><td>${finKwota(przychodRocznie)}</td>
            ${FIN_KOSZTY.map(k => `<td>${finKwota(sumyKosztow[k.key])}</td>`).join('')}
            <td>${finKwota(kosztyRocznie)}</td>
            <td class="${finKlasaWartosci(zostajeRocznie)}">${finKwota(zostajeRocznie)}</td>
            <td>${przychodRocznie > 0 ? finProcent(kosztyRocznie / przychodRocznie * 100) : '—'}</td>
        </tr></table></div>`;

        html += `<h4 style="margin:18px 0 4px 0;">📊 Struktura kosztów — analiza procentowa</h4>
        <div class="table-responsive"><table class="month-table">
            <tr><th>Kategoria kosztów</th><th>Suma roczna</th><th>% przychodu</th></tr>
            ${FIN_KOSZTY.map(k => `<tr><td style="text-align:left;">${k.nazwa}</td>
                <td>${finKwota(sumyKosztow[k.key])}</td>
                <td>${przychodRocznie > 0 ? finProcent(sumyKosztow[k.key] / przychodRocznie * 100) : '—'}</td></tr>`).join('')}
            <tr class="sum-row"><td>Zostaje</td><td>${finKwota(zostajeRocznie)}</td>
                <td>${przychodRocznie > 0 ? finProcent(zostajeRocznie / przychodRocznie * 100) : '—'}</td></tr>
        </table></div>`;

        kontener.innerHTML = html;
    } catch (e) {
        kontener.innerHTML = `<span class="error">Błąd ładowania budżetu: ${ucieczkaHtml(e.message)}</span>`;
    }
};

window.zapiszFinanseBudzet = async function(miesiac, pole, wartosc) {
    const rok = finPobierzRok('finanse-bud-rok');
    const liczba = Math.max(0, finLiczba(wartosc));
    const dane = pole === 'przychod' ? { przychod: liczba } : { koszty: { [pole]: liczba } };
    try {
        await setDoc(doc(db, FIN_KOLEKCJA_BUDZET, `${rok}-${finMiesiacStr(miesiac)}`), dane, { merge: true });
        await window.zaladujFinanseBudzet();
    } catch (e) { alert('Błąd zapisu budżetu: ' + e.message); }
};

window.finKopiujWynagrodzenia = async function() {
    const rok = finPobierzRok('finanse-bud-rok');
    try {
        const [daneRozliczen, listaPracownikow] = await Promise.all([
            Promise.all(Array.from({ length: 12 }, (_, i) => finPobierzRozliczenie(rok, i + 1))),
            pobierzListePracownikow().catch(() => [])
        ]);
        await Promise.all(daneRozliczen.map((dane, i) => {
            const wpisy = dane.pracownicy || {};
            const suma = listaPracownikow.reduce((acc, p) =>
                acc + finWynagrodzeniePracownika(wpisy[p.id] || {}, finCzyZlecenie(p)).suma, 0);
            return setDoc(doc(db, FIN_KOLEKCJA_BUDZET, `${rok}-${finMiesiacStr(i + 1)}`), {
                koszty: { wynagrodzenia: suma }
            }, { merge: true });
        }));
        alert('Wynagrodzenia z Rozliczenia skopiowane do budżetu.');
        await window.zaladujFinanseBudzet();
    } catch (e) { alert('Błąd kopiowania wynagrodzeń: ' + e.message); }
};

/* ---------- nawigacja po zakładkach ---------- */

window.przelaczTabFinanse = function(tab) {
    finanseTab = tab;
    ['prognoza', 'rozliczenie', 'budzet'].forEach(nazwa => {
        document.getElementById(`finanse-view-${nazwa}`)?.classList.toggle('hidden', nazwa !== tab);
        document.getElementById(`finanse-tab-${nazwa}`)?.classList.toggle('active', nazwa === tab);
    });
    if (tab === 'prognoza') window.zaladujFinansePrognoza();
    else if (tab === 'rozliczenie') window.zaladujFinanseRozliczenie();
    else window.zaladujFinanseBudzet();
};

document.addEventListener('DOMContentLoaded', () => {
    const teraz = new Date();
    const rok = String(teraz.getFullYear());
    ['finanse-rok', 'finanse-roz-rok', 'finanse-bud-rok'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = rok;
    });
    finWbudujKontrolkiOkresu('finanse-roz', 'zmienOkresFinanseRozliczenie', 'zaladujFinanseRozliczenie');
    finWbudujKontrolkiOkresu('finanse-bud', 'zmienOkresFinanseBudzet', 'zaladujFinanseBudzet');

    const miesiacBiezacy = teraz.getMonth() + 1;
    const ustaw = (id, wartosc) => { const el = document.getElementById(id); if (el) el.value = String(wartosc); };
    ['finanse', 'finanse-roz', 'finanse-bud'].forEach(prefix => {
        ustaw(`${prefix}-okres-miesiac`, miesiacBiezacy);
        ustaw(`${prefix}-okres-kwartal`, Math.ceil(miesiacBiezacy / 3));
        ustaw(`${prefix}-okres-od`, 1);
        ustaw(`${prefix}-okres-do`, miesiacBiezacy);
    });
});
