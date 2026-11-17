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
    const [rok, m] = aktualnyGrafikStan.miesiac.split('-').map(Number);
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
        tbody += `<tr style="${bg}"><td style="font-weight:bold;">${d}</td>`;

        wybraneEmps.forEach(emp => {
            const cRano = entries[`${emp.id}_${d}_rano`] || {};
            const cZamk = entries[`${emp.id}_${d}_zamkniecie`] || {};

            const formatPrintCell = (c) => {
                if (c.type === 'niedostepny' || (c.pink && (!c.type || c.type === 'puste'))) return 'X';
                if (c.type === 'praca' && c.hours) return c.hours;
                if (c.type === 'urlop') return `U ${c.hours || ''}`;
                if (c.type === 'l4') return `L4 ${c.hours || ''}`;
                return '';
            };

            const rVal = formatPrintCell(cRano);
            const zVal = formatPrintCell(cZamk);

            tbody += `
                <td style="border-left:2px solid #000; width:24px;">${rVal}</td>
                <td style="width:24px;">${zVal}</td>
                <td style="width:32px;"></td>
                <td style="width:32px;"></td>
                <td style="width:58px;"></td>`;
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
    pdfContainer.style.cssText = 'background:#ffffff; color:#000000; font-family:Arial,sans-serif; padding:6px; width:1080px;';
    pdfContainer.innerHTML = `
        <style>
            .pdf-export-table { width: 100%; border-collapse: collapse; font-size: 9px; color: #000; }
            .pdf-export-table th, .pdf-export-table td { border: 1px solid #444; padding: 2px 2px; text-align: center; }
            .pdf-export-table th { background: #e2e8f0; font-weight: bold; }
        </style>
        <h2 style="text-align:center; margin:0 0 6px 0; font-size:13px; color:#000;">LISTA OBECNOŚCI / GRAFIK ZA MIESIĄC: ${nazwaMiesiaca}</h2>
        <table class="pdf-export-table">
            <thead>${thead1}${thead2}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;

    window.zamknijModalDrukuGrafiku();

    if (typeof window.html2pdf !== 'undefined') {
        const opt = {
            margin: [5, 5, 5, 5],
            filename: nazwaPlikuPdf,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        try {
            await window.html2pdf().set(opt).from(pdfContainer).save();
        } catch (err) {
            alert("Błąd podczas zapisywania pliku PDF: " + err.message);
        }
    } else {
        alert("Nie udało się załadować generatora PDF (sprawdź połączenie z internetem).");
    }
};
