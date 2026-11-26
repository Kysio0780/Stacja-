'use strict';
// Moduł Wiadomości (odebrane/wysłane, podgląd, odpowiedź, usuwanie).

async function sprawdzPowiadomieniaWiadomosci(pracownikId, mojeImie = "") {
    try {
        const snap = await getDocs(collection(db, "wiadomosci"));
        let nieprzeczytaneCnt = 0;
        snap.forEach(d => {
            const dane = d.data();
            const st = dane.odbiorcyStatus?.[pracownikId] || (mojeImie ? dane.odbiorcyStatus?.[mojeImie] : null);
            if (st && st.przeczytane === false) nieprzeczytaneCnt++;
        });
        const badge = document.getElementById('wiadomosci-badge');
        if (nieprzeczytaneCnt > 0) {
            badge.innerText = nieprzeczytaneCnt;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

window.przelaczTabWiadomosci = function(tab) {
    aktualnyTabWiadomosci = tab;
    ['odebrane', 'wyslane', 'wszystkie'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    window.zaladujWiadomosci();
};

async function wypelnijAdresatowDoCheckboxow(zaznaczeni = null) {
    const container = document.getElementById('msg-odbiorcy-checkboxes');
    container.innerHTML = "Wczytywanie użytkowników...";
    try {
        const pracownicy = await pobierzListePracownikow();
        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        // Domyślnie zaznaczamy wszystkich — można odznaczyć część i zacząć wątek
        // tylko z wybranymi osobami.
        const zestaw = new Set(zaznaczeni === null ? [] : (zaznaczeni || []).filter(Boolean));
        let html = "";
        pracownicy.forEach(u => {
            if (u.id === mojId) return;
            const domyslnie = zaznaczeni === null || zestaw.has(u.id) || zestaw.has(u.imie) || zestaw.has(u.imieKrotkie);
            const chk = domyslnie ? 'checked' : '';
            html += `<label style="display:flex; align-items:center; gap:8px; margin:5px 0; cursor:pointer; font-weight:normal;">
                <input type="checkbox" name="msg-odbiorca-chk" value="${ucieczkaHtml(u.id)}" data-imie="${ucieczkaHtml(u.imie || '')}" ${chk}>
                ${ucieczkaHtml(u.imie || u.login || '')}
            </label>`;
        });
        container.innerHTML = html || "<p class='text-muted' style='margin:0;'>Brak innych użytkowników.</p>";
    } catch (e) { container.innerHTML = "Błąd wczytywania."; }
}

window.otworzFormularzNowejWiadomosci = async function(domyslnyOdbiorca = null) {
    document.getElementById('modal-msg-tytul').innerText = "✉️ Nowa Wiadomość";
    document.getElementById('msg-temat-input').value = "";
    document.getElementById('msg-tresc-input').value = "";
    document.getElementById('msg-zdjecie-input').value = "";
    document.getElementById('msg-zdjecie-preview').innerHTML = "";
    document.getElementById('msg-wazne-checkbox').checked = false;
    await wypelnijAdresatowDoCheckboxow(domyslnyOdbiorca ? [domyslnyOdbiorca] : []);
    document.getElementById('modal-nowa-wiadomosc').classList.remove('hidden');
};

window.zamknijModalNowejWiadomosci = () => {
    if (typeof window.zamknijAparat === 'function') window.zamknijAparat();
    document.getElementById('modal-nowa-wiadomosc').classList.add('hidden');
};

window.wyslijWiadomosc = async function(opcje = {}) {
    const odbiorcy = Array.from(document.querySelectorAll('input[name="msg-odbiorca-chk"]:checked')).map(cb => ({
        id: cb.value,
        imie: cb.dataset.imie || cb.parentElement?.textContent?.trim() || cb.value
    }));
    const tresc = document.getElementById('msg-tresc-input').value.trim();
    const temat = document.getElementById('msg-temat-input').value.trim();
    const wazne = document.getElementById('msg-wazne-checkbox').checked;
    const fileInput = document.getElementById('msg-zdjecie-input');

    if (odbiorcy.length === 0) return alert("Wybierz przynajmniej jednego odbiorcę!");
    if (!temat) return alert("Wpisz temat wiadomości!");
    if (!tresc) return alert("Treść wiadomości nie może być pusta!");

    const nadawcaId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const nadawca = currentUserData ? currentUserData.imie : "Anonim";
    const odbiorcyIds = odbiorcy.map(o => o.id);
    const odbiorcyImiona = odbiorcy.map(o => o.imie);
    const odbiorcyStatus = {};
    odbiorcyIds.forEach(o => { odbiorcyStatus[o] = { przeczytane: false, dataOdczytu: null }; });

    const stworzIWyslij = async (zdjecieBase64 = null) => {
        try {
            // Nowa wiadomość zawsze inicjuje świeży wątek — nawet przy identycznych odbiorcach.
            const ref = doc(collection(db, "wiadomosci"));
            const watekId = ref.id;
            await setDoc(ref, {
                nadawcaId,
                nadawca,
                odbiorcyIds,
                odbiorcy: odbiorcyImiona,
                odbiorcyStatus,
                watekId,
                temat,
                tresc,
                zdjecie: zdjecieBase64 || null,
                wazne,
                data: new Date().toISOString(),
                timestamp: Date.now()
            });
            if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
            window.zamknijModalNowejWiadomosci();
            await window.otworzCzat(watekId, temat);
            window.zaladujWiadomosci();
        } catch (e) { alert("Błąd wysyłania wiadomości: " + e.message); }
    };

    if (opcje.aparat) {
        window.otworzAparat(plik => kompresujObraz(plik, base64 => stworzIWyslij(base64)));
        return;
    }
    if (fileInput.files?.length > 0) kompresujObraz(fileInput.files[0], stworzIWyslij);
    else await stworzIWyslij(null);
};

function czyWiadomoscDlaMnie(w, mojId, mojeImie) {
    if (!w) return false;
    if (Array.isArray(w.odbiorcyIds) && w.odbiorcyIds.length > 0) return w.odbiorcyIds.includes(mojId);
    return Array.isArray(w.odbiorcy) && w.odbiorcy.includes(mojeImie);
}

function czyWiadomoscOdeMnie(w, mojId, mojeImie) {
    if (!w) return false;
    if (w.nadawcaId) return w.nadawcaId === mojId;
    return w.nadawca === mojeImie;
}

function pobierzStatusWiadomosci(w, mojId, mojeImie) {
    if (!w?.odbiorcyStatus) return null;
    return w.odbiorcyStatus[mojId] || (mojeImie ? w.odbiorcyStatus[mojeImie] : null) || null;
}

function pobierzNazweOdbiorcy(w, klucz) {
    const idx = Array.isArray(w?.odbiorcyIds) ? w.odbiorcyIds.indexOf(klucz) : -1;
    return idx >= 0 ? (w.odbiorcy?.[idx] || klucz) : klucz;
}

let aktualnyCzatPartner = null;

function czasWiadomosci(w) {
    return w.timestamp || pobierzTimestamp(w.data) || 0;
}

function uczestnicyRozmowy(w) {
    const mapa = new Map();
    const dodaj = (id, imie) => {
        const klucz = String(id || imie || '');
        if (klucz && !mapa.has(klucz)) mapa.set(klucz, { id: String(id || ''), imie: imie || klucz });
    };
    dodaj(w?.nadawcaId || w?.nadawca, w?.nadawca || w?.nadawcaId || '?');
    const ids = Array.isArray(w?.odbiorcyIds) ? w.odbiorcyIds : [];
    const imiona = Array.isArray(w?.odbiorcy) ? w.odbiorcy : [];
    ids.forEach((id, idx) => dodaj(id, imiona[idx] || String(id)));
    if (!ids.length) imiona.forEach(imie => dodaj(imie, imie));
    return [...mapa.values()];
}

function kluczRozmowy(w) {
    return uczestnicyRozmowy(w).map(u => u.id || u.imie).sort().join('|');
}

// Każda nowa wiadomość z formularza dostaje własny watekId. Wiadomości pisane
// w oknie czatu dzielą watekId z bieżącą rozmową.
function idWatku(w) {
    return w?.watekId || kluczRozmowy(w);
}

function tytulRozmowy(w, mojId, mojeImie) {
    const inni = uczestnicyRozmowy(w).filter(u =>
        String(u.id) !== String(mojId) && u.imie !== mojeImie
    );
    const nazwy = inni.map(u => u.imie);
    if (nazwy.length === 1) return nazwy[0];
    if (nazwy.length > 1) return nazwy.join(', ');
    return w?.nadawca || 'Rozmowa';
}

window.zaladujWiadomosci = async function() {
    const container = document.getElementById('wiadomosci-lista-container');
    container.innerHTML = "Pobieranie wiadomości...";
    const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const mojeImie = currentUserData ? currentUserData.imie : "";
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    try {
        const snap = await getDocs(collection(db, "wiadomosci"));
        const wszystkie = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const watki = new Map();

        wszystkie.forEach(w => {
            const klucz = idWatku(w);
            if (!klucz) return;
            const mojUdzial = czyWiadomoscOdeMnie(w, mojId, mojeImie) || czyWiadomoscDlaMnie(w, mojId, mojeImie);
            if (!mojUdzial && !czyAdmin) return;

            if (!watki.has(klucz)) {
                watki.set(klucz, {
                    klucz,
                    imie: tytulRozmowy(w, mojId, mojeImie),
                    uczestnicy: uczestnicyRozmowy(w),
                    wiadomosci: [],
                    ostatni: 0
                });
            }
            const watek = watki.get(klucz);
            if (watek.wiadomosci.some(x => x.id === w.id)) return;
            const kierunek = czyWiadomoscOdeMnie(w, mojId, mojeImie) ? 'out' : 'in';
            watek.wiadomosci.push({ ...w, kierunek });
            watek.ostatni = Math.max(watek.ostatni, czasWiadomosci(w));
        });

        const lista = Array.from(watki.values());
        lista.sort((a, b) => b.ostatni - a.ostatni);

        if (!lista.length) {
            container.innerHTML = `<p class="text-muted" style="text-align:center; padding:20px;">Brak rozmów w tej kategorii.</p>`;
            return;
        }

        container.innerHTML = lista.map(t => {
            const ostatnia = t.wiadomosci.slice().sort((a, b) => czasWiadomosci(b) - czasWiadomosci(a))[0];
            const nieprzeczytane = t.wiadomosci.filter(m => {
                if (m.kierunek !== 'in') return false;
                const st = pobierzStatusWiadomosci(m, mojId, mojeImie);
                return st && !st.przeczytane;
            }).length;
            const podglad = ostatnia?.zdjecie ? '📷 Zdjęcie' : (ostatnia?.tresc || '');
            return `<div class="msg-item ${nieprzeczytane ? 'unread' : ''}" onclick="window.otworzCzat('${ucieczkaHtml(ucieczkaJs(t.klucz))}', '${ucieczkaHtml(ucieczkaJs(t.imie))}')">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                    <strong>${ucieczkaHtml(ostatnia?.temat || t.imie)}</strong>
                    <span class="text-muted" style="font-size:0.8em;">${ucieczkaHtml(formatujDateCzasDoWyswietlenia(ostatnia?.data))}</span>
                </div>
                <div style="margin-bottom:4px;">
                    ${nieprzeczytane ? `<span class="badge badge-danger">${nieprzeczytane} nowe</span>` : ''}
                    ${ostatnia?.wazne ? '<span class="badge badge-pending">⭐ WAŻNE</span>' : ''}
                </div>
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ucieczkaHtml(podglad)}</div>
            </div>`;
        }).join('');
        sprawdzPowiadomieniaWiadomosci(mojId, mojeImie);
    } catch (e) { container.innerHTML = "Błąd ładowania wiadomości."; }
};

window.otworzCzat = async function(klucz, tytul) {
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    aktualnyCzatPartner = { klucz: String(klucz || ''), imie: tytul || 'Rozmowa', uczestnicy: [] };
    document.getElementById('czat-tytul').innerText = `💬 ${aktualnyCzatPartner.imie}`;
    window.zamknijMenuZalacznikaCzatu();
    document.getElementById('czat-usun')?.classList.toggle('hidden', !czyAdmin);
    document.getElementById('modal-czat').classList.remove('hidden');

    const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const mojeImie = currentUserData ? currentUserData.imie : "";
    try {
        const snap = await getDocs(collection(db, "wiadomosci"));
        const wiadomosci = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(w => {
            if (idWatku(w) !== aktualnyCzatPartner.klucz) return false;
            return czyWiadomoscOdeMnie(w, mojId, mojeImie) || czyWiadomoscDlaMnie(w, mojId, mojeImie) || czyAdmin;
        }).sort((a, b) => czasWiadomosci(a) - czasWiadomosci(b));

        const mapaUczestnikow = new Map();
        wiadomosci.forEach(w => uczestnicyRozmowy(w).forEach(u => {
            const k = String(u.id || u.imie);
            if (k && !mapaUczestnikow.has(k)) mapaUczestnikow.set(k, u);
        }));
        aktualnyCzatPartner.uczestnicy = [...mapaUczestnikow.values()];

        const doOznaczenia = [];
        wiadomosci.forEach(w => {
            const klucz = w.odbiorcyStatus?.[mojId] ? mojId : (w.odbiorcyStatus?.[mojeImie] ? mojeImie : null);
            if (klucz && !w.odbiorcyStatus[klucz].przeczytane) {
                w.odbiorcyStatus[klucz].przeczytane = true;
                w.odbiorcyStatus[klucz].dataOdczytu = new Date().toISOString();
                doOznaczenia.push(w);
            }
        });
        await Promise.all(doOznaczenia.map(w => setDoc(doc(db, 'wiadomosci', w.id), { odbiorcyStatus: w.odbiorcyStatus }, { merge: true })));

        const ostatnia = wiadomosci[wiadomosci.length - 1];
        const autorOstatniej = String(ostatnia?.nadawcaId || ostatnia?.nadawca || '');
        const uczestnicyNaglowka = ostatnia ? uczestnicyRozmowy(ostatnia) : [];

        const kolorUczestnika = (u) => {
            // Autor ostatniego wpisu zawsze jest liczony jako osoba, która go „przeczytała".
            if (String(u.id || u.imie) === autorOstatniej || u.imie === ostatnia?.nadawca) return true;
            const status = ostatnia?.odbiorcyStatus?.[u.id] || ostatnia?.odbiorcyStatus?.[u.imie];
            return !!(status && status.przeczytane);
        };

        document.getElementById('czat-tytul').innerHTML = `💬 ${ucieczkaHtml(aktualnyCzatPartner.imie)}`
            + (uczestnicyNaglowka.length
                ? `<br><span class="text-muted" style="font-size:0.7em; font-weight:500;">Uczestnicy:</span> `
                    + uczestnicyNaglowka.map(u => {
                        const przeczytal = kolorUczestnika(u);
                        return `<span class="${przeczytal ? 'val-green' : 'text-muted'}" style="font-size:0.75em; font-weight:500;">${przeczytal ? '✔' : '○'} ${ucieczkaHtml(u.imie)}</span>`;
                    }).join(' · ')
                : '');

        const okno = document.getElementById('czat-wiadomosci');
        okno.innerHTML = wiadomosci.length ? wiadomosci.map(w => {
            const czyOut = czyWiadomoscOdeMnie(w, mojId, mojeImie);
            const zdjecie = w.zdjecie ? `<img src="${w.zdjecie}" style="max-width:100%; max-height:160px; border-radius:8px; display:block; margin-bottom:4px; cursor:pointer;" onclick="window.otworzZoomZdjecia('${ucieczkaJs(w.zdjecie)}')">` : '';
            const usun = czyAdmin ? `<button onclick="window.usunWiadomoscAdminBezposrednio('${ucieczkaJs(w.id)}')" class="btn-danger btn-sm" style="margin-left:6px; padding:0 5px;">🗑️</button>` : '';
            return `<div class="czat-wiadomosc ${czyOut ? 'out' : 'in'}">
                <div class="czat-bubble">${zdjecie}${ucieczkaHtml(w.tresc || '')}</div>
                <div class="czat-czas">${ucieczkaHtml(formatujDateCzasDoWyswietlenia(w.data))}${usun}</div>
            </div>`;
        }).join('') : `<p class="text-muted" style="text-align:center;">Brak wiadomości w tej rozmowie.</p>`;
        okno.scrollTop = okno.scrollHeight;
        sprawdzPowiadomieniaWiadomosci(mojId, mojeImie);
    } catch (e) { alert('Błąd wczytywania rozmowy: ' + e.message); }
};

window.zamknijCzat = function() {
    window.zamknijMenuZalacznikaCzatu();
    document.getElementById('modal-czat').classList.add('hidden');
    window.zaladujWiadomosci();
};

window.usunCzat = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    const klucz = aktualnyCzatPartner?.klucz;
    if (!klucz) return;
    if (!confirm(`Usunąć cały czat „${aktualnyCzatPartner.imie}"? Tej operacji nie da się cofnąć.`)) return;
    try {
        const snap = await getDocs(collection(db, 'wiadomosci'));
        const doUsuniecia = snap.docs.filter(d => idWatku({ id: d.id, ...d.data() }) === klucz);
        await Promise.all(doUsuniecia.map(d => deleteDoc(doc(db, 'wiadomosci', d.id))));
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
        alert(`Usunięto ${doUsuniecia.length} wiadomości z czatu.`);
        window.zamknijCzat();
    } catch (e) { alert('Błąd usuwania czatu: ' + e.message); }
};

window.otworzMenuZalacznikaCzatu = function() {
    document.getElementById('czat-zalacznik-menu')?.classList.remove('hidden');
};

window.zamknijMenuZalacznikaCzatu = function() {
    document.getElementById('czat-zalacznik-menu')?.classList.add('hidden');
    const pole = document.getElementById('czat-plik-input');
    if (pole) pole.value = '';
};

window.wybierzPlikDoCzatu = function() {
    document.getElementById('czat-plik-input')?.click();
};

window.dodajZdjecieZAparatuDoCzatu = function() {
    if (typeof window.otworzAparat !== 'function') {
        alert('Aparat jest dostępny w aplikacji APK. Użyj opcji „Plik / galeria".');
        return;
    }
    window.zamknijMenuZalacznikaCzatu();
    window.otworzAparat(plik => kompresujObraz(plik, base64 => window.wyslijWiadomoscWWatku(base64)));
};

document.addEventListener('DOMContentLoaded', () => {
    const pole = document.getElementById('czat-plik-input');
    if (!pole) return;
    pole.addEventListener('change', () => {
        const plik = pole.files?.[0];
        if (!plik) return;
        kompresujObraz(plik, base64 => {
            window.zamknijMenuZalacznikaCzatu();
            window.wyslijWiadomoscWWatku(base64);
        });
    });
});

window.wyslijWiadomoscWWatku = async function(zdjecieBase64 = null) {
    if (!aktualnyCzatPartner) return;
    const pole = document.getElementById('czat-tresc');
    const tresc = String(pole?.value || '').trim();
    if (!tresc && !zdjecieBase64) return;
    const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
    const mojeImie = currentUserData ? currentUserData.imie : "Anonim";
    const odbiorcy = (aktualnyCzatPartner.uczestnicy || []).filter(u =>
        String(u.id || u.imie) !== String(mojId) && u.imie !== mojeImie
    );
    if (!odbiorcy.length) return alert('Brak odbiorców tej rozmowy.');
    try {
        const odbiorcyIds = odbiorcy.map(u => String(u.id || u.imie));
        const odbiorcyImiona = odbiorcy.map(u => u.imie);
        const odbiorcyStatus = {};
        odbiorcyIds.forEach(id => { odbiorcyStatus[id] = { przeczytane: false, dataOdczytu: null }; });
        await addDoc(collection(db, 'wiadomosci'), {
            nadawcaId: mojId,
            nadawca: mojeImie,
            odbiorcyIds,
            odbiorcy: odbiorcyImiona,
            odbiorcyStatus,
            watekId: aktualnyCzatPartner.klucz,
            temat: aktualnyCzatPartner.imie || 'Wiadomość',
            tresc,
            zdjecie: zdjecieBase64 || null,
            wazne: false,
            data: new Date().toISOString(),
            timestamp: Date.now()
        });
        pole.value = '';
        await window.otworzCzat(aktualnyCzatPartner.klucz, aktualnyCzatPartner.imie);
        window.zaladujWiadomosci();
    } catch (e) { alert('Błąd wysyłania wiadomości: ' + e.message); }
};

window.otworzPodgladWiadomosci = async function(id) {
    try {
        const docRef = doc(db, "wiadomosci", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return alert("Nie znaleziono wiadomości!");

        const w = { id: docSnap.id, ...docSnap.data() };
        aktualniePodgladanaWiadomosc = w;
        const mojId = currentUserData ? (currentUserData.uid || currentUserData.id) : "";
        const mojeImie = currentUserData ? currentUserData.imie : "";
        const czyAdmin = currentUserData && currentUserData.rola === 'admin';

        const kluczStatusu = w.odbiorcyStatus?.[mojId] ? mojId : (w.odbiorcyStatus?.[mojeImie] ? mojeImie : null);
        if (kluczStatusu && !w.odbiorcyStatus[kluczStatusu].przeczytane) {
            w.odbiorcyStatus[kluczStatusu].przeczytane = true;
            w.odbiorcyStatus[kluczStatusu].dataOdczytu = new Date().toISOString();
            await setDoc(docRef, { odbiorcyStatus: w.odbiorcyStatus }, { merge: true });
        }

        document.getElementById('podglad-msg-id').value = w.id;
        document.getElementById('podglad-msg-naglowek').innerHTML = `
            <p style="margin:2px 0;"><strong>Od:</strong> ${ucieczkaHtml(w.nadawca)}</p>
            <p style="margin:2px 0;"><strong>Do:</strong> ${ucieczkaHtml((w.odbiorcy || []).join(', ') || '-')}</p>
            <p class="text-muted" style="margin:2px 0;"><strong>Data wysłania:</strong> ${ucieczkaHtml(formatujDateCzasDoWyswietlenia(w.data))}</p>
            ${w.wazne ? '<p style="margin:6px 0 0 0;" class="val-red">⭐ Wiadomość oznaczona jako WAŻNA.</p>' : ''}`;

        document.getElementById('podglad-msg-tresc').innerText = w.tresc || '';
        document.getElementById('podglad-msg-zdjecie-container').innerHTML = w.zdjecie
            ? `<img src="${w.zdjecie}" onclick="window.otworzZoomZdjecia('${ucieczkaJs(w.zdjecie)}')" style="max-width:100%; max-height:220px; border-radius:var(--radius-sm); cursor:pointer;" title="Kliknij, aby powiększyć">` : '';

        let statusyHtml = `<ul style="margin:4px 0 0 0; padding-left:20px;">`;
        if (w.odbiorcyStatus) {
            Object.keys(w.odbiorcyStatus).forEach(odb => {
                const st = w.odbiorcyStatus[odb];
                const nazwa = pobierzNazweOdbiorcy(w, odb);
                statusyHtml += st.przeczytane
                    ? `<li style="color:var(--success);">👁️ <strong>${ucieczkaHtml(nazwa)}</strong> — Odczytano (${ucieczkaHtml(formatujDateCzasDoWyswietlenia(st.dataOdczytu) || 'bd')})</li>`
                    : `<li style="color:var(--warning);">⏳ <strong>${ucieczkaHtml(nazwa)}</strong> — Nieprzeczytane</li>`;
            });
        }
        document.getElementById('podglad-msg-odbiorcy-statusy').innerHTML = statusyHtml + `</ul>`;

        document.getElementById('btn-usun-wiadomosc-admin').style.display = czyAdmin ? 'inline-flex' : 'none';
        document.getElementById('modal-podglad-wiadomosci').classList.remove('hidden');
    } catch (e) { alert("Błąd pobierania wiadomości."); }
};

window.zamknijModalPodgladuWiadomosci = () => {
    document.getElementById('modal-podglad-wiadomosci').classList.add('hidden');
    window.zaladujWiadomosci();
};

window.otworzOdpowiedzWiadomosc = function() {
    if (!aktualniePodgladanaWiadomosc) return;
    window.zamknijModalPodgladuWiadomosci();
    const nadawcaWiadomosci = aktualniePodgladanaWiadomosc.nadawca;
    const nadawcaId = aktualniePodgladanaWiadomosc.nadawcaId || nadawcaWiadomosci;
    window.otworzFormularzNowejWiadomosci(nadawcaId);
    document.getElementById('modal-msg-tytul').innerText = `↩️ Odpowiedź do: ${nadawcaWiadomosci}`;
};

window.usunWiadomoscAdminBezposrednio = async function(id) {
    if (!confirm("Czy na pewno chcesz trwale usunąć tę wiadomość?")) return;
    try {
        await deleteDoc(doc(db, "wiadomosci", id));
        if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
        window.zaladujWiadomosci();
    } catch (e) { alert("Błąd usuwania: " + e.message); }
};

window.usunWiadomoscPrzezAdmina = async function() {
    const id = document.getElementById('podglad-msg-id').value;
    if (id && confirm("Czy na pewno chcesz usunąć tę wiadomość?")) {
        try {
            await deleteDoc(doc(db, "wiadomosci", id));
            if (typeof window.odswiezRozmiarZdjecJesliAdmin === 'function') window.odswiezRozmiarZdjecJesliAdmin();
            document.getElementById('modal-podglad-wiadomosci').classList.add('hidden');
            window.zaladujWiadomosci();
        } catch (e) { alert("Błąd usuwania: " + e.message); }
    }
};
