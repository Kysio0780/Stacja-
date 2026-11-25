'use strict';
// Grafik: modal wydruku i generowanie PDF listy obecności.

// Zapis PDF w APK przez natywny system (WebView nie obsługuje pdf.save()).
async function zapiszGrafikPdf(pdf, nazwa) {
    const b = window.NativeBridge;
    const wNatywnie = window.NativeApp && typeof window.NativeApp.isNative === 'function' && window.NativeApp.isNative();
    if (!wNatywnie || !b || !b.Filesystem || !b.Share) {
        pdf.save(nazwa);
        return;
    }
    try {
        const dataUri = pdf.output('datauristring');
        const base64 = String(dataUri).split(',')[1];
        const zapisany = await b.Filesystem.writeFile({
            path: nazwa,
            data: base64,
            directory: b.Directory ? b.Directory.Cache : 'CACHE',
            recursive: true
        });
        await b.Share.share({
            title: 'Grafik - wydruk PDF',
            text: nazwa,
            url: zapisany.uri,
            dialogTitle: 'Zapisz lub udostępnij plik PDF'
        });
    } catch (err) {
        console.warn('PDF: zapis natywny nie udał się, próbuję standardowego pobrania.', err);
        pdf.save(nazwa);
    }
}

// Wartość godzin do wydruku (bez „Niedostępny X").
function formatGodzinyDoWydruku(c) {
    if (!c) return '';
    if (c.type === 'niedostepny' || (c.pink && (!c.type || c.type === 'puste'))) return '';
    if (c.type === 'praca' && c.hours) return c.hours;
    if (c.type === 'urlop') return `U ${c.hours || ''}`;
    if (c.type === 'l4') return `L4 ${c.hours || ''}`;
    return '';
}

function stylTabeliPdf() {
    return `
        .pdf-export-table { border-collapse: collapse; font-size: 9px; color: #000; page-break-inside: avoid; table-layout: fixed; }
        .pdf-export-table th, .pdf-export-table td {
            border: 1px solid #444; padding: 0; text-align: center; vertical-align: middle;
            overflow: hidden; page-break-inside: avoid;
        }
        .pdf-export-table th { background: #e2e8f0; color: #000 !important; font-weight: bold; }
        .pdf-export-table tr { page-break-inside: avoid; }
    `;
}

/* Modal Drukowania / Bezpośredniego Pobierania PDF Listy Obecności */
let trybDrukuGrafiku = 'pelny';

window.otworzModalDrukuGrafiku = function(tryb = 'pelny') {
    trybDrukuGrafiku = tryb === 'godziny' ? 'godziny' : 'pelny';
    const tylkoGodziny = trybDrukuGrafiku === 'godziny';
    const listaDiv = document.getElementById('druk-pracownicy-lista');
    const emps = aktualnyGrafikStan?.employees || [];
    if (emps.length === 0) return alert("Brak pracowników w grafiku do wydruku.");

    listaDiv.innerHTML = emps.map(emp => {
        const isUZ = emp.umowa === 'Zlecenie';
        const zaznaczony = tylkoGodziny || !isUZ;
        return `<label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer; font-weight:normal;">
            <input type="checkbox" name="druk-emp-chk" value="${emp.id}" ${zaznaczony ? 'checked' : ''}>
            <span><strong>${ucieczkaHtml(emp.imie)}</strong> (${isUZ ? 'Umowa Zlecenie' : 'UoP ' + emp.etat})</span>
        </label>`;
    }).join('');

    const tytul = document.getElementById('modal-grafik-druk-tytul');
    if (tytul) tytul.innerText = tylkoGodziny ? '📄 Eksport PDF — same godziny' : '📥 Generuj PDF Listy Obecności';
    const opis = document.getElementById('modal-grafik-druk-opis');
    if (opis) opis.innerText = tylkoGodziny
        ? 'Wybierz pracowników — domyślnie zaznaczeni są wszyscy. Wydruk pionowy A4, jedna strona, bez OD/DO, podpisów i statystyk.'
        : 'Wybierz pracowników do pliku PDF (Godziny, OD, DO, Podpis). Domyślnie pominięto Umowy Zlecenie.';
    document.getElementById('druk-statystyki-box')?.classList.toggle('hidden', tylkoGodziny);
    const chkStat = document.getElementById('druk-statystyki-chk');
    if (chkStat && !tylkoGodziny) chkStat.checked = false;

    document.getElementById('modal-grafik-druk').classList.remove('hidden');
};

window.zamknijModalDrukuGrafiku = () => document.getElementById('modal-grafik-druk').classList.add('hidden');

window.generujWydrukGrafikuZModalu = async function() {
    window.zamknijModalDrukuGrafiku();
    if (trybDrukuGrafiku === 'godziny') await window.generujWydrukGrafikuPDFGodziny();
    else await window.generujWydrukGrafikuPDF();
};

window.generujWydrukGrafikuPDF = async function() {
    const wybraneIds = Array.from(document.querySelectorAll('input[name="druk-emp-chk"]:checked')).map(cb => cb.value);
    if (wybraneIds.length === 0) return alert("Zaznacz przynajmniej jednego pracownika do wygenerowania PDF!");

    const wybraneEmps = aktualnyGrafikStan.employees.filter(e => wybraneIds.includes(e.id));
    const miesiacStr = aktualnyGrafikStan.miesiac;
    const [rok, m] = miesiacStr.split('-').map(Number);
    const dniWMiesiacu = new Date(rok, m, 0).getDate();
    const nazwaMiesiaca = `${NAZWY_MIESIECY_PL[m - 1].toUpperCase()} ${rok}`;
    const nazwaPlikuPdf = `Grafik na ${NAZWY_MIESIECY_PL[m - 1]} ${rok}.pdf`;
    const holidays = aktualnyGrafikStan.holidays || {};
    const entries = aktualnyGrafikStan.entries || {};

    // Stały układ: każdy pracownik dostaje identyczną grupę 5 kolumn,
    // a tabela mieści się w szerokości 1080 px używanej przy renderze.
    // Szersza pierwsza kolumna, żeby etykiety statystyk (np. „Pozostało urlopu")
    // mieściły się w wydruku — tam dozwolone jest zawijanie tekstu.
    const szerokoscDnia = 100;
    const dostepnaSzerokosc = 1080 - szerokoscDnia - 10;
    const szerokoscGrupy = Math.max(70, Math.floor(dostepnaSzerokosc / wybraneEmps.length));
    const szerokosciKolumn = [0.14, 0.14, 0.19, 0.19, 0.34]
        .map(proporcja => Math.max(14, Math.floor(szerokoscGrupy * proporcja)));
    const lacznaSzerokosc = szerokoscDnia + szerokoscGrupy * wybraneEmps.length;

    // Wysokość wierszy dni dobieramy tak, żeby wydruk wykorzystywał całą
    // dostępną wysokość strony A4 landscape (zamiast zostawiać puste pole).
    const stosunekStrony = (297 - 2 * 3) / (210 - 2 * 3);
    const docelowaWysokoscCanvas = (lacznaSzerokosc + 8) / stosunekStrony;
    const zStatystykami = !!document.getElementById('druk-statystyki-chk')?.checked;
    const staleWierszeWysokosc = 2 * 12 + (zStatystykami ? 5 * 22 : 0); // nagłówek + opcjonalne statystyki
    const dayRowHeight = Math.max(18, Math.min(36, Math.round(
        (docelowaWysokoscCanvas - staleWierszeWysokosc - 30) / dniWMiesiacu
    )));
    const podpisLineHeight = Math.max(9, Math.round(dayRowHeight / 2));

    let colgroup = `<colgroup><col style="width:${szerokoscDnia}px;">`;
    wybraneEmps.forEach(() => {
        szerokosciKolumn.forEach(w => { colgroup += `<col style="width:${w}px;">`; });
    });
    colgroup += `</colgroup>`;

    let thead1 = `<tr><th rowspan="2">Dzień</th>`;
    let thead2 = `<tr>`;
    wybraneEmps.forEach(emp => {
        thead1 += `<th colspan="5" style="border-left:2px solid #000;">${ucieczkaHtml(emp.imie)}</th>`;
        thead2 += `<th colspan="2" style="border-left:2px solid #000;">Godziny</th><th>OD</th><th>DO</th><th>Podpis</th>`;
    });
    thead1 += `</tr>`;
    thead2 += `</tr>`;

    let tbody = ``;
    for (let d = 1; d <= dniWMiesiacu; d++) {
        const isHol = !!holidays[String(d)];
        const bg = isHol ? 'background:#fef08a;' : '';
        const dataDnia = `${miesiacStr}-${String(d).padStart(2, '0')}`;
        tbody += `<tr class="dzien" style="${bg}"><td style="font-weight:bold;">${d}</td>`;

        wybraneEmps.forEach(emp => {
            const cRano = entries[`${emp.id}_${d}_rano`] || {};
            const cZamk = entries[`${emp.id}_${d}_zamkniecie`] || {};

            const rVal = formatGodzinyDoWydruku(cRano);
            const zVal = formatGodzinyDoWydruku(cZamk);
            const potw = (typeof window.pobierzPotwierdzenieObecnosci === 'function')
                ? window.pobierzPotwierdzenieObecnosci(emp.id, dataDnia)
                : null;
            const odVal = potw ? ucieczkaHtml(String(potw.od || '')) : '';
            const doVal = potw ? ucieczkaHtml(String(potw.do || '')) : '';
            const jestUrlop = cRano.type === 'urlop' || cZamk.type === 'urlop';
            const jestChorobowe = cRano.type === 'l4' || cZamk.type === 'l4';
            let podpisVal = '';
            if (jestUrlop) {
                podpisVal = 'Urlop';
            } else if (jestChorobowe) {
                podpisVal = 'Chorobowe';
            } else if (potw) {
                podpisVal = `${ucieczkaHtml(emp.imie)}<br><span style="font-size:6px; font-weight:normal;">potwierdzenie w aplikacji</span>`;
            }

            tbody += `
                <td style="border-left:2px solid #000;">${rVal}</td>
                <td>${zVal}</td>
                <td>${odVal}</td>
                <td>${doVal}</td>
                <td>${podpisVal}</td>`;
        });
        tbody += `</tr>`;
    }

    // Podsumowanie na dole pliku PDF
    const summaryMetrics = [
        { label: 'Suma Plan', fn: (emp) => obliczSumaPlanPracownika(aktualnyGrafikStan, emp.id) },
        { label: 'Plan - wymiar', fn: (emp) => emp.umowa === 'Zlecenie' ? '-' : (obliczSumaPlanPracownika(aktualnyGrafikStan, emp.id) - pobierzWymiarPracownika(aktualnyGrafikStan, emp)) },
        { label: 'Urlop do wyk.', fn: (emp) => emp.umowa === 'Zlecenie' ? '-' : (Number(emp.stats?.urlopDoWykorzystania) || 0) },
        { label: 'Urlop wyk.', fn: (emp) => emp.umowa === 'Zlecenie' ? '-' : obliczWykorzystanyUrlopPracownika(aktualnyGrafikStan, emp.id, emp.stats) },
        { label: 'Pozostało urlopu', fn: (emp) => emp.umowa === 'Zlecenie' ? '-' : ((Number(emp.stats?.urlopDoWykorzystania) || 0) - obliczWykorzystanyUrlopPracownika(aktualnyGrafikStan, emp.id, emp.stats)) }
    ];

    if (zStatystykami) {
        summaryMetrics.forEach(metric => {
            tbody += `<tr class="podsumowanie" style="background:#f1f5f9; font-weight:bold;"><td>${metric.label}</td>`;
            wybraneEmps.forEach(emp => {
                tbody += `<td colspan="2" style="border-left:2px solid #000;">${metric.fn(emp)}</td><td colspan="3"></td>`;
            });
            tbody += `</tr>`;
        });
    }

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = `background:#ffffff; color:#000000; font-family:Arial,sans-serif; padding:3px; width:${lacznaSzerokosc + 8}px;`;
    pdfContainer.innerHTML = `
        <style>
            .pdf-export-table { border-collapse: collapse; font-size: 8px; color: #000; page-break-inside: avoid; table-layout: fixed; }
            .pdf-export-table th, .pdf-export-table td {
                border: 1px solid #444; padding: 0; text-align: center; vertical-align: middle;
                height: 12px; line-height: 12px; white-space: nowrap; overflow: hidden;
                page-break-inside: avoid;
            }
            .pdf-export-table th { background: #e2e8f0; color: #000 !important; font-weight: bold; }
            .pdf-export-table tr { height: 12px; page-break-inside: avoid; }
            .pdf-export-table tr.dzien { height: ${dayRowHeight}px; }
            .pdf-export-table tr.dzien td { height: ${dayRowHeight}px; line-height: ${podpisLineHeight}px; }
            .pdf-export-table tr.podsumowanie { height: 22px; }
            .pdf-export-table tr.podsumowanie td { height: 22px; line-height: 11px; }
            .pdf-export-table tr.podsumowanie td:first-child { white-space: normal; overflow: visible; text-align: left; padding-left: 2px; }
        </style>
        <h2 style="text-align:center; margin:0 0 4px 0; font-size:12px; color:#000;">LISTA OBECNOŚCI / GRAFIK ZA MIESIĄC: ${nazwaMiesiaca}</h2>
        <table class="pdf-export-table" style="width:${lacznaSzerokosc}px;">
            ${colgroup}
            <thead>${thead1}${thead2}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;

    window.zamknijModalDrukuGrafiku();

    const opisBladu = (err) => (err && (err.message || String(err))) || 'nieznany błąd';
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

    /* 1) Próba: cała tabela jako jeden obrazek dopasowany do jednej strony A4. */
    if (typeof window.html2canvas === 'function' && typeof jsPDFCtor === 'function') {
        const poprzedniStyl = {
            position: pdfContainer.style.position,
            left: pdfContainer.style.left,
            top: pdfContainer.style.top,
            zIndex: pdfContainer.style.zIndex
        };
        let dodanyDoDokumentu = false;
        try {
            pdfContainer.style.position = 'fixed';
            pdfContainer.style.left = '-10000px';
            pdfContainer.style.top = '0';
            pdfContainer.style.zIndex = '-1';
            document.body.appendChild(pdfContainer);
            dodanyDoDokumentu = true;

            const canvas = await window.html2canvas(pdfContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                windowWidth: Math.max(pdfContainer.scrollWidth, 1080),
                windowHeight: Math.max(pdfContainer.scrollHeight, 400),
                scrollX: 0,
                scrollY: 0
            });
            if (!canvas || !canvas.width || !canvas.height) throw new Error('Pusty obraz tabeli PDF.');

            const pdf = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const margines = 3;
            const szerStrony = pdf.internal.pageSize.getWidth();
            const wysStrony = pdf.internal.pageSize.getHeight();
            const skala = Math.min(
                (szerStrony - 2 * margines) / canvas.width,
                (wysStrony - 2 * margines) / canvas.height
            );
            const szer = canvas.width * skala;
            const wys = canvas.height * skala;

            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (szerStrony - szer) / 2, (wysStrony - wys) / 2, szer, wys);
            await zapiszGrafikPdf(pdf, nazwaPlikuPdf);
            return;
        } catch (err) {
            console.warn('PDF: metoda jednej strony nie udała się — próbuję fallback.', err);
        } finally {
            if (dodanyDoDokumentu && pdfContainer.parentNode) pdfContainer.parentNode.removeChild(pdfContainer);
            pdfContainer.style.position = poprzedniStyl.position;
            pdfContainer.style.left = poprzedniStyl.left;
            pdfContainer.style.top = poprzedniStyl.top;
            pdfContainer.style.zIndex = poprzedniStyl.zIndex;
        }
    }

    /* 2) Fallback: klasyczny html2pdf (może podzielić wydruk na strony). */
    if (typeof window.html2pdf !== 'undefined') {
        try {
            const opt = {
                margin: [3, 3, 3, 3],
                filename: nazwaPlikuPdf,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            const worker = window.html2pdf().set(opt).from(pdfContainer).toPdf();
            const pdf = await worker.get('pdf');
            if (pdf && typeof pdf.output === 'function') {
                await zapiszGrafikPdf(pdf, nazwaPlikuPdf);
            } else {
                await worker.save();
            }
            return;
        } catch (err) {
            alert("Błąd podczas zapisywania pliku PDF: " + opisBladu(err));
            return;
        }
    }
    alert("Nie udało się załadować generatora PDF (sprawdź połączenie z internetem).");
};

/* Eksport tylko godzin — A4 pionowo, jedna strona, bez OD/DO, podpisów i statystyk. */
window.generujWydrukGrafikuPDFGodziny = async function() {
    const wybraneIds = Array.from(document.querySelectorAll('input[name="druk-emp-chk"]:checked')).map(cb => cb.value);
    if (wybraneIds.length === 0) return alert('Zaznacz przynajmniej jednego pracownika do wygenerowania PDF!');
    const emps = ((aktualnyGrafikStan && aktualnyGrafikStan.employees) || [])
        .filter(e => wybraneIds.includes(e.id));
    if (!emps.length) return alert('Brak pracowników w grafiku do wydruku.');
    window.zamknijModalDrukuGrafiku();

    const miesiacStr = aktualnyGrafikStan.miesiac;
    const [rok, m] = miesiacStr.split('-').map(Number);
    const dniWMiesiacu = new Date(rok, m, 0).getDate();
    const nazwaMiesiaca = `${NAZWY_MIESIECY_PL[m - 1].toUpperCase()} ${rok}`;
    const nazwaPlikuPdf = `Grafik godziny - ${NAZWY_MIESIECY_PL[m - 1]} ${rok}.pdf`;
    const holidays = aktualnyGrafikStan.holidays || {};
    const entries = aktualnyGrafikStan.entries || {};

    const szerokoscDnia = 36;
    const szerokoscKolumny = 40;
    const lacznaSzerokosc = szerokoscDnia + 2 * szerokoscKolumny * emps.length;
    const stosunekStrony = (297 - 2 * 3) / (210 - 2 * 3);
    const docelowaWysokoscCanvas = (lacznaSzerokosc + 8) * stosunekStrony;
    const naglowekWysokosc = 26;
    const dayRowHeight = Math.max(18, Math.min(48, Math.round(
        (docelowaWysokoscCanvas - naglowekWysokosc - 34) / dniWMiesiacu
    )));

    let colgroup = `<colgroup><col style="width:${szerokoscDnia}px;">`;
    emps.forEach(() => {
        colgroup += `<col style="width:${szerokoscKolumny}px;"><col style="width:${szerokoscKolumny}px;">`;
    });
    colgroup += `</colgroup>`;

    let thead1 = `<tr><th rowspan="2">Dzień</th>`;
    let thead2 = `<tr>`;
    emps.forEach((emp, idx) => {
        thead1 += `<th colspan="2" style="border-left:2px solid #000;">${ucieczkaHtml(emp.imie)}</th>`;
        thead2 += `<th style="border-left:${idx === 0 ? '2px solid #000' : '1px solid #444'};">R</th><th>Z</th>`;
    });
    thead1 += `</tr>`;
    thead2 += `</tr>`;

    let tbody = '';
    for (let d = 1; d <= dniWMiesiacu; d++) {
        const bg = holidays[String(d)] ? 'background:#fef08a;' : '';
        tbody += `<tr class="dzien" style="${bg}"><td style="font-weight:bold;">${d}</td>`;
        emps.forEach((emp, idx) => {
            const r = formatGodzinyDoWydruku(entries[`${emp.id}_${d}_rano`] || {});
            const z = formatGodzinyDoWydruku(entries[`${emp.id}_${d}_zamkniecie`] || {});
            tbody += `<td style="border-left:${idx === 0 ? '2px solid #000' : '1px solid #444'};">${r}</td><td>${z}</td>`;
        });
        tbody += `</tr>`;
    }

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = `background:#ffffff; color:#000000; font-family:Arial,sans-serif; padding:3px; width:${lacznaSzerokosc + 8}px;`;
    pdfContainer.innerHTML = `
        <style>
            ${stylTabeliPdf()}
            .pdf-export-table tr.dzien { height: ${dayRowHeight}px; }
            .pdf-export-table tr.dzien td { height: ${dayRowHeight}px; line-height: ${dayRowHeight}px; }
        </style>
        <h2 style="text-align:center; margin:0 0 4px 0; font-size:12px; color:#000;">GRAFIK GODZIN — ${nazwaMiesiaca}</h2>
        <table class="pdf-export-table" style="width:${lacznaSzerokosc}px;">
            ${colgroup}
            <thead>${thead1}${thead2}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;

    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    const opisBladu = (err) => (err && (err.message || String(err))) || 'nieznany błąd';

    if (typeof window.html2canvas === 'function' && typeof jsPDFCtor === 'function') {
        const poprzedniStyl = {
            position: pdfContainer.style.position,
            left: pdfContainer.style.left,
            top: pdfContainer.style.top,
            zIndex: pdfContainer.style.zIndex
        };
        let dodany = false;
        try {
            pdfContainer.style.position = 'fixed';
            pdfContainer.style.left = '-10000px';
            pdfContainer.style.top = '0';
            pdfContainer.style.zIndex = '-1';
            document.body.appendChild(pdfContainer);
            dodany = true;

            const canvas = await window.html2canvas(pdfContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                windowWidth: Math.max(pdfContainer.scrollWidth, 300),
                windowHeight: Math.max(pdfContainer.scrollHeight, 400),
                scrollX: 0,
                scrollY: 0
            });
            if (!canvas || !canvas.width || !canvas.height) throw new Error('Pusty obraz tabeli PDF.');

            const pdf = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const margines = 3;
            const szerStrony = pdf.internal.pageSize.getWidth();
            const wysStrony = pdf.internal.pageSize.getHeight();
            const skala = Math.min(
                (szerStrony - 2 * margines) / canvas.width,
                (wysStrony - 2 * margines) / canvas.height
            );
            const szer = canvas.width * skala;
            const wys = canvas.height * skala;
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG',
                (szerStrony - szer) / 2, (wysStrony - wys) / 2, szer, wys);
            await zapiszGrafikPdf(pdf, nazwaPlikuPdf);
            return;
        } catch (err) {
            console.warn('PDF godzin: metoda jednej strony nie udała się — próbuję fallback.', err);
        } finally {
            if (dodany && pdfContainer.parentNode) pdfContainer.parentNode.removeChild(pdfContainer);
            pdfContainer.style.position = poprzedniStyl.position;
            pdfContainer.style.left = poprzedniStyl.left;
            pdfContainer.style.top = poprzedniStyl.top;
            pdfContainer.style.zIndex = poprzedniStyl.zIndex;
        }
    }

    if (typeof window.html2pdf !== 'undefined') {
        try {
            const opt = {
                margin: [3, 3, 3, 3],
                filename: nazwaPlikuPdf,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            const worker = window.html2pdf().set(opt).from(pdfContainer).toPdf();
            const pdf = await worker.get('pdf');
            if (pdf && typeof pdf.output === 'function') await zapiszGrafikPdf(pdf, nazwaPlikuPdf);
            else await worker.save();
            return;
        } catch (err) {
            alert('Błąd podczas zapisywania pliku PDF: ' + opisBladu(err));
            return;
        }
    }
    alert('Nie udało się załadować generatora PDF (sprawdź połączenie z internetem).');
};
