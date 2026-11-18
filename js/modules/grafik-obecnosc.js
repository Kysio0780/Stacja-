'use strict';
// Grafik: potwierdzanie obecności przez pracownika, podgląd/edycja przez admina,
// oznaczenia kolorami w tabeli i dane w wydruku PDF.

const POTWIERDZENIA_GRAFIKU_KOLEKCJA = "potwierdzenia_obecnosci";
let potwierdzeniaGrafiku = {}; // { "uid_YYYY-MM-DD": { uid, data, od, do, ... } }

function dataIsoZObiektu(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kluczObecnosci(uid, data) {
    return `${String(uid)}_${data}`;
}

function czyPoprawnyCzas(wartosc) {
    return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(wartosc || ''));
}

function domyslnyKoniecZmiany(grafik, uid, data) {
    const dzien = Number(String(data).split('-')[2]);
    const rano = grafik?.entries?.[`${uid}_${dzien}_rano`];
    const zamk = grafik?.entries?.[`${uid}_${dzien}_zamkniecie`];
    const pracuje = (c) => c && c.type === 'praca' && (Number(c.hours) || 0) > 0;
    if (pracuje(rano) && pracuje(zamk)) return '21:00';
    if (pracuje(zamk)) return '21:00';
    if (pracuje(rano)) return '14:00';
    return '21:00';
}

window.pobierzDzisiejszaDateGrafikuObecnosci = function() {
    return dataIsoZObiektu(new Date());
};

window.pobierzPotwierdzenieObecnosci = function(uid, data) {
    if (!uid || !data) return null;
    return potwierdzeniaGrafiku[kluczObecnosci(uid, data)] || null;
};

/* Pobiera potwierdzenia dla miesiąca grafiku. Bez tylkoUid pobiera wszystkie;
   awaryjnie próbuje odczytać dokumenty po kluczach dla przekazanych uidów. */
window.zaladujPotwierdzeniaGrafiku = async function(miesiacStr, tylkoUid, uidyDoProb = null) {
    potwierdzeniaGrafiku = {};
    if (!miesiacStr) return;

    const zapisz = (id, dane) => {
        const uid = String(dane.uid || '');
        const data = String(dane.data || '');
        if (!uid || !data.startsWith(`${miesiacStr}-`)) return;
        if (tylkoUid && uid !== String(tylkoUid)) return;
        potwierdzeniaGrafiku[kluczObecnosci(uid, data)] = { id, ...dane };
    };

    try {
        const snap = await getDocs(collection(db, POTWIERDZENIA_GRAFIKU_KOLEKCJA));
        snap.forEach(d => zapisz(d.id, d.data()));
    } catch (e) {
        // Awaryjnie próbujemy czytać dokumenty po kluczach — dla własnego uid
        // albo dla wszystkich pracowników grafiku, jeśli zapytanie zbiorcze nie wyszło.
        const uidy = tylkoUid ? [tylkoUid] : (Array.isArray(uidyDoProb) ? uidyDoProb : []);
        if (uidy.length > 0) {
            const [rok, m] = miesiacStr.split('-').map(Number);
            const dni = new Date(rok, m, 0).getDate();
            for (const uid of uidy) {
                for (let d = 1; d <= dni; d++) {
                    const data = `${miesiacStr}-${String(d).padStart(2, '0')}`;
                    try {
                        const s = await getDoc(doc(db, POTWIERDZENIA_GRAFIKU_KOLEKCJA, kluczObecnosci(uid, data)));
                        if (s.exists()) zapisz(s.id, s.data());
                    } catch (err) { /* brak dostępu do pojedynczego dokumentu */ }
                }
            }
        } else {
            console.warn("Nie udało się pobrać potwierdzeń obecności:", e);
        }
    }
};

window.czyPracownikPowinienBycWPracyGrafiku = function(grafik, uid, data) {
    if (!grafik || !grafik.entries || !uid || !data) return false;
    const dzien = Number(String(data).split('-')[2]);
    return ['rano', 'zamkniecie'].some(shift => {
        const c = grafik.entries[`${uid}_${dzien}_${shift}`];
        return c && c.type === 'praca' && (Number(c.hours) || 0) > 0;
    });
};

/* Czeka na potwierdzenie: po terminie zmiany albo w dniach wcześniejszych. */
window.czyObecnoscZalegla = function(uid, data, grafik) {
    if (!uid || !data) return false;
    if (window.pobierzPotwierdzenieObecnosci(uid, data)) return false;
    if (grafik && !window.czyPracownikPowinienBycWPracyGrafiku(grafik, uid, data)) return false;
    const dzis = window.pobierzDzisiejszaDateGrafikuObecnosci();
    if (data < dzis) return true;
    if (data > dzis) return false;

    const potw = window.pobierzPotwierdzenieObecnosci(uid, data);
    const doGodz = (potw && czyPoprawnyCzas(potw.do))
        ? potw.do
        : domyslnyKoniecZmiany(grafik || aktualnyGrafikStan, uid, data);
    const termin = new Date(`${data}T${doGodz}:00`);
    return new Date() > termin;
};

window.klasaKoloruObecnosci = function(uid, data, grafik) {
    if (window.pobierzPotwierdzenieObecnosci(uid, data)) return 'obecnosc-potwierdzona';
    if (window.czyObecnoscZalegla(uid, data, grafik)) return 'obecnosc-zalegla';
    return '';
};

window.tytulKoloruObecnosci = function(uid, data) {
    const p = window.pobierzPotwierdzenieObecnosci(uid, data);
    if (p) return `Obecność potwierdzona: ${p.od || '?'}–${p.do || '?'}`;
    return window.czyObecnoscZalegla(uid, data) ? 'Obecność nie została potwierdzona w terminie' : '';
};

/* Zapis/usunięcie — używane zarówno przez formularz pracownika, jak i modal admina. */
window.zapiszPotwierdzenieObecnosci = async function(uid, data, od, doGodz, autor) {
    if (!uid || !data) throw new Error("Brak danych potwierdzenia.");
    if (data > window.pobierzDzisiejszaDateGrafikuObecnosci()) throw new Error("Nie można potwierdzać obecności w przyszłych dniach.");
    if (!czyPoprawnyCzas(od) || !czyPoprawnyCzas(doGodz)) throw new Error("Podaj poprawne godziny OD i DO (HH:MM).");
    if (od > doGodz) throw new Error("Godzina OD musi być wcześniejsza niż DO.");

    const dane = {
        uid: String(uid),
        data,
        od,
        do: doGodz,
        potwierdzonePrzez: autor || "",
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, POTWIERDZENIA_GRAFIKU_KOLEKCJA, kluczObecnosci(uid, data)), dane);
    potwierdzeniaGrafiku[kluczObecnosci(uid, data)] = dane;
};

window.usunPotwierdzenieObecnosci = async function(uid, data) {
    if (!uid || !data) return;
    await deleteDoc(doc(db, POTWIERDZENIA_GRAFIKU_KOLEKCJA, kluczObecnosci(uid, data)));
    delete potwierdzeniaGrafiku[kluczObecnosci(uid, data)];
};

/* Odświeża tabelę bez przeskakiwania widoku. */
window.odswiezGrafikPoObecnosci = function() {
    const oknoY = window.scrollY;
    const before = document.querySelector('.grafik-scroll-container');
    const top = before ? before.scrollTop : 0;
    const left = before ? before.scrollLeft : 0;

    renderujGrafikInteraktywny();
    window.sprawdzObecnoscGrafikuGlobal();

    const przywroc = () => {
        window.scrollTo(0, oknoY);
        const after = document.querySelector('.grafik-scroll-container');
        if (after) {
            after.scrollTop = top;
            after.scrollLeft = left;
        }
    };
    przywroc();
    requestAnimationFrame(przywroc);
};

/* ---------- FORMULARZ PRACOWNIKA ---------- */
window.otworzModalObecnosciGrafiku = function() {
    if (!currentUserData) return;
    const uid = String(pobierzIdPracownika(currentUserData));
    const dzis = window.pobierzDzisiejszaDateGrafikuObecnosci();
    const poleData = document.getElementById('obecnosc-data');
    const poleOd = document.getElementById('obecnosc-od');
    const poleDo = document.getElementById('obecnosc-do');
    const msg = document.getElementById('obecnosc-msg');

    poleData.value = dzis;
    poleData.max = dzis;

    const jestRano = window.czyPracownikPowinienBycWPracyGrafiku(aktualnyGrafikStan, uid, dzis);
    const cRano = aktualnyGrafikStan?.entries?.[`${uid}_${Number(dzis.split('-')[2])}_rano`];
    const cZamk = aktualnyGrafikStan?.entries?.[`${uid}_${Number(dzis.split('-')[2])}_zamkniecie`];
    const pracujeZamk = !!(cZamk && cZamk.type === 'praca' && (Number(cZamk.hours) || 0) > 0);
    const pracujeRano = !!(cRano && cRano.type === 'praca' && (Number(cRano.hours) || 0) > 0);

    poleOd.value = pracujeZamk && !pracujeRano ? '14:00' : '06:00';
    poleDo.value = pracujeZamk ? '21:00' : '14:00';

    const istniejace = window.pobierzPotwierdzenieObecnosci(uid, dzis);
    if (istniejace) {
        poleData.value = istniejace.data;
        poleOd.value = istniejace.od || poleOd.value;
        poleDo.value = istniejace.do || poleDo.value;
        msg.innerText = `Dzisiejsze potwierdzenie już istnieje (${istniejace.od || '?'}–${istniejace.do || '?'}). Możesz je nadpisać.`;
    } else {
        msg.innerText = jestRano
            ? 'Dziś masz zaplanowaną pracę — potwierdź swoje godziny.'
            : 'Dziś nie masz zaplanowanej zmiany — potwierdzenie zapiszesz jako własne oświadczenie.';
    }
    document.getElementById('modal-obecnosc-grafik').classList.remove('hidden');
};

window.zamknijModalObecnosciGrafiku = function() {
    document.getElementById('modal-obecnosc-grafik').classList.add('hidden');
};

window.zatwierdzObecnoscPracownikaGrafiku = async function() {
    if (!currentUserData) return alert("Zaloguj się, aby potwierdzić obecność.");
    const uid = String(pobierzIdPracownika(currentUserData));
    const data = document.getElementById('obecnosc-data').value;
    const od = document.getElementById('obecnosc-od').value;
    const doGodz = document.getElementById('obecnosc-do').value;
    try {
        await window.zapiszPotwierdzenieObecnosci(uid, data, od, doGodz, currentUserData.imie || "");
        window.zamknijModalObecnosciGrafiku();
        window.odswiezGrafikPoObecnosci();
    } catch (e) {
        alert(e.message || "Nie udało się zapisać potwierdzenia.");
    }
};

/* ---------- PODGLĄD I EDYCJA ADMINA W MODALU KOMÓRKI ---------- */
window.uzupelnijObecnoscWModaluKomorki = function(empId, day) {
    const infoOd = document.getElementById('gk-obecnosc-od');
    const infoDo = document.getElementById('gk-obecnosc-do');
    const infoTxt = document.getElementById('gk-obecnosc-info');
    if (!infoOd || !infoDo || !infoTxt) return;

    const miesiacStr = aktualnyGrafikStan?.miesiac || '';
    const data = `${miesiacStr}-${String(day).padStart(2, '0')}`;
    const p = window.pobierzPotwierdzenieObecnosci(empId, data);
    infoOd.value = p ? (p.od || '') : '';
    infoDo.value = p ? (p.do || '') : '';
    infoTxt.innerText = p
        ? `Zapisano: ${p.od || '?'}–${p.do || '?'} (${p.potwierdzonePrzez || 'pracownik'}).`
        : 'Brak potwierdzenia na ten dzień.';
};

window.zapiszObecnoscZKomorkiGrafiku = async function() {
    const empId = document.getElementById('gk-emp-id').value;
    const day = document.getElementById('gk-day').value;
    const od = document.getElementById('gk-obecnosc-od').value;
    const doGodz = document.getElementById('gk-obecnosc-do').value;
    const data = `${aktualnyGrafikStan.miesiac}-${String(day).padStart(2, '0')}`;
    try {
        await window.zapiszPotwierdzenieObecnosci(empId, data, od, doGodz, currentUserData?.imie || 'Administrator');
        window.zamknijModalKomorkiGrafiku();
        window.odswiezGrafikPoObecnosci();
    } catch (e) {
        alert(e.message || "Nie udało się zapisać potwierdzenia.");
    }
};

window.usunObecnoscZKomorkiGrafiku = async function() {
    const empId = document.getElementById('gk-emp-id').value;
    const day = document.getElementById('gk-day').value;
    const data = `${aktualnyGrafikStan.miesiac}-${String(day).padStart(2, '0')}`;
    try {
        await window.usunPotwierdzenieObecnosci(empId, data);
        window.zamknijModalKomorkiGrafiku();
        window.odswiezGrafikPoObecnosci();
    } catch (e) {
        alert(e.message || "Nie udało się usunąć potwierdzenia.");
    }
};

/* ---------- IKONKA (!) NA KAFELKU GRAFIKU ---------- */
window.sprawdzObecnoscGrafikuGlobal = async function() {
    const badge = document.getElementById('grafik-badge');
    if (!badge) return;
    const ukryj = () => badge.classList.add('hidden');
    if (!currentUserData || currentUserData.rola === 'admin') return ukryj();

    const uid = String(pobierzIdPracownika(currentUserData));
    const dzis = window.pobierzDzisiejszaDateGrafikuObecnosci();
    const miesiac = dzis.substring(0, 7);
    try {
        const snap = await getDoc(doc(db, "grafiki", miesiac));
        if (!snap.exists() || !window.czyPracownikPowinienBycWPracyGrafiku(snap.data(), uid, dzis)) return ukryj();
        const potw = await getDoc(doc(db, POTWIERDZENIA_GRAFIKU_KOLEKCJA, kluczObecnosci(uid, dzis)));
        badge.classList.toggle('hidden', potw.exists());
    } catch (e) {
        ukryj();
    }
};
