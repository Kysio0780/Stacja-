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
    } catch (e) { tableContainer.innerHTML = "Błąd ładowania."; }
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
