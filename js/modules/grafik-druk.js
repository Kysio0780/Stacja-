'use strict';
// Grafik: modal wydruku i generowanie PDF listy obecności.

/* Modal Drukowania / Bezpośredniego Pobierania PDF Listy Obecności */
window.otworzModalDrukuGrafiku = function() {
    const listaDiv = document.getElementById('druk-pracownicy-lista');
    const emps = aktualnyGrafikStan?.employees || [];
    if (emps.length === 0) return alert("Brak pracowników w grafiku do wydruku.");

    listaDiv.innerHTML = emps.map(emp => {
        const isUZ = emp.umowa === 'Zlecenie';
        return `<label style="display:flex; align-items:center; gap:8px; margin:6px 0; cursor:pointer; font-weight:normal;">
            <input type="checkbox" name="druk-emp-chk" value="${emp.id}" ${isUZ ? '' : 'checked'}>
            <span><strong>${ucieczkaHtml(emp.imie)}</strong> (${isUZ ? 'Umowa Zlecenie' : 'UoP ' + emp.etat})</span>
        </label>`;
    }).join('');

    document.getElementById('modal-grafik-druk').classList.remove('hidden');
};

window.zamknijModalDrukuGrafiku = () => document.getElementById('modal-grafik-druk').classList.add('hidden');

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

    let thead1 = `<tr><th rowspan="2" style="width:28px;">Dzień</th>`;
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
        tbody += `<tr style="${bg}"><td style="font-weight:bold;">${d}</td>`;

        wybraneEmps.forEach(emp => {
            const cRano = entries[`${emp.id}_${d}_rano`] || {};
            const cZamk = entries[`${emp.id}_${d}_zamkniecie`] || {};

            const formatPrintCell = (c) => {
                // „Niedostępny (X)” jest widoczny w tabeli, ale nie w wydruku PDF.
                if (c.type === 'niedostepny' || (c.pink && (!c.type || c.type === 'puste'))) return '';
                if (c.type === 'praca' && c.hours) return c.hours;
                if (c.type === 'urlop') return `U ${c.hours || ''}`;
                if (c.type === 'l4') return `L4 ${c.hours || ''}`;
                return '';
            };

            const rVal = formatPrintCell(cRano);
            const zVal = formatPrintCell(cZamk);
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
                podpisVal = `${ucieczkaHtml(emp.imie)}<br><span style="font-size:6px; font-weight:normal;">(potwierdzono cyfrowo)</span>`;
            }

            tbody += `
                <td style="border-left:2px solid #000; width:24px;">${rVal}</td>
                <td style="width:24px;">${zVal}</td>
                <td style="width:32px;">${odVal}</td>
                <td style="width:32px;">${doVal}</td>
                <td style="width:58px; line-height:1.1;">${podpisVal}</td>`;
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

    summaryMetrics.forEach(metric => {
        tbody += `<tr style="background:#f1f5f9; font-weight:bold;"><td>${metric.label}</td>`;
        wybraneEmps.forEach(emp => {
            tbody += `<td colspan="2" style="border-left:2px solid #000;">${metric.fn(emp)}</td><td colspan="3"></td>`;
        });
        tbody += `</tr>`;
    });

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'background:#ffffff; color:#000000; font-family:Arial,sans-serif; padding:3px; width:1080px;';
    pdfContainer.innerHTML = `
        <style>
            .pdf-export-table { width: 100%; border-collapse: collapse; font-size: 8px; line-height: 1.05; color: #000; page-break-inside: avoid; }
            .pdf-export-table th, .pdf-export-table td { border: 1px solid #444; padding: 1px; text-align: center; page-break-inside: avoid; }
            .pdf-export-table th { background: #e2e8f0; color: #000 !important; font-weight: bold; }
            .pdf-export-table tr { page-break-inside: avoid; }
        </style>
        <h2 style="text-align:center; margin:0 0 4px 0; font-size:12px; color:#000;">LISTA OBECNOŚCI / GRAFIK ZA MIESIĄC: ${nazwaMiesiaca}</h2>
        <table class="pdf-export-table">
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
            pdf.save(nazwaPlikuPdf);
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
            await window.html2pdf().set(opt).from(pdfContainer).save();
            return;
        } catch (err) {
            alert("Błąd podczas zapisywania pliku PDF: " + opisBladu(err));
            return;
        }
    }
    alert("Nie udało się załadować generatora PDF (sprawdź połączenie z internetem).");
};
