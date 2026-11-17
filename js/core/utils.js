'use strict';
// Funkcje pomocnicze: daty, escapowanie HTML, kompresja zdjęć, bieżący okres, terminy.

function formatujDateLokalna(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pobierzDzisiejszaDateStr() {
    return formatujDateLokalna(new Date());
}

function ustawBiezacaDateWNaglowku() {
    const dataEl = document.getElementById('header-current-date');
    if (dataEl) {
        const opcje = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
        dataEl.innerText = new Date().toLocaleDateString('pl-PL', opcje);
    }
}
ustawBiezacaDateWNaglowku();

function kompresujObraz(file, callback) {
    if (!file) { callback(null); return; }
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 900;
            let { width, height } = img;

            if (width > height && width > MAX_DIM) {
                height *= MAX_DIM / width;
                width = MAX_DIM;
            } else if (height >= width && height > MAX_DIM) {
                width *= MAX_DIM / height;
                height = MAX_DIM;
            }

            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function pobierzBiezacyOkresSystemowy() {
    const teraz = new Date();
    return {
        miesiacStr: `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}`,
        okresStr: teraz.getDate() <= 15 ? "1-15" : "16-koniec"
    };
}

function ucieczkaHtml(tekst) {
    if (!tekst) return "";
    return String(tekst)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Bezpieczne wstawianie wartości do kodu JavaScript w atrybutach onclick/onchange.
function ucieczkaJs(tekst) {
    if (tekst === null || tekst === undefined) return "";
    return String(tekst)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

/* ==================== WSPÓLNY MODEL DANYCH ==================== */

const STATUSY_MISJI = Object.freeze({
    NOWE: 'nowe',
    ODEBRANE: 'odebrane',
    ZROBIONE: 'zrobione',
    ZALICZONE: 'zaliczone',
    DO_WYJASNIENIA: 'do wyjaśnienia',
    PO_CZASIE: 'po czasie'
});

const STATUSY_PROSB = Object.freeze({
    OCZEKUJACE: 'oczekujace',
    ZATWIERDZONE: 'zatwierdzone',
    ODRZUCONE: 'odrzucone'
});

function pobierzIdPracownika(uzytkownik) {
    if (!uzytkownik) return "";
    return String(uzytkownik.uid || uzytkownik.id || uzytkownik.pracownikId || uzytkownik.autorId || uzytkownik.nadawcaId || "");
}

function pobierzImieKrotkie(imie) {
    return String(imie || "").trim().split(/\s+/)[0] || "";
}

function pobierzImiePracownika(pracownik, fallback = "") {
    if (!pracownik) return fallback;
    return pracownik.imie || pracownik.pracownik || pracownik.autor || pracownik.nadawca || fallback;
}

function czyPracownikPasuje(rekord, pracownikId, imie) {
    if (!rekord) return false;
    const rekordId = pobierzIdPracownika(rekord);
    if (pracownikId && rekordId && String(rekordId) === String(pracownikId)) return true;
    if (!imie) return false;
    const imieKrotkie = pobierzImieKrotkie(imie);
    return [rekord.pracownik, rekord.autor, rekord.nadawca, rekord.podpis]
        .some(wartosc => wartosc && (wartosc === imie || wartosc === imieKrotkie));
}

function pobierzDateDoObiektu(wartosc) {
    if (wartosc === null || wartosc === undefined || wartosc === "") return null;
    if (wartosc instanceof Date) return isNaN(wartosc.getTime()) ? null : new Date(wartosc.getTime());
    if (typeof wartosc === "number") {
        const d = new Date(wartosc);
        return isNaN(d.getTime()) ? null : d;
    }

    const s = String(wartosc).trim();
    if (!s) return null;

    // Pełny ISO z czasem i strefą — zostawiamy natywnemu parserowi.
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    // ISO bez strefy (traktujemy jako czas lokalny).
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));

    // Stary format zapisany przez toLocaleString('pl-PL'): 17.11.2026, 14:30:00
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function formatujDateDoWyswietlenia(wartosc) {
    if (wartosc === null || wartosc === undefined || wartosc === "") return "";
    const d = pobierzDateDoObiektu(wartosc);
    return d ? d.toLocaleDateString('pl-PL') : String(wartosc);
}

function formatujDateCzasDoWyswietlenia(wartosc) {
    if (wartosc === null || wartosc === undefined || wartosc === "") return "";
    const d = pobierzDateDoObiektu(wartosc);
    return d ? d.toLocaleString('pl-PL') : String(wartosc);
}

function pobierzTimestamp(wartosc) {
    const d = pobierzDateDoObiektu(wartosc);
    return d ? d.getTime() : 0;
}

async function pobierzListePracownikow() {
    const snap = await getDocs(collection(db, "uzytkownicy"));
    return snap.docs.map(d => {
        const dane = d.data();
        return {
            ...dane,
            id: d.id,
            uid: dane.uid || d.id,
            imieKrotkie: pobierzImieKrotkie(dane.imie)
        };
    }).sort((a, b) => String(a.imie || "").localeCompare(String(b.imie || ""), 'pl'));
}

function znajdzPracownika(lista, pracownikId, imie) {
    if (!Array.isArray(lista)) return null;
    if (pracownikId) {
        const poId = lista.find(u => String(pobierzIdPracownika(u)) === String(pracownikId));
        if (poId) return poId;
    }
    if (imie) {
        return lista.find(u => u.imie === imie || u.imieKrotkie === imie || pobierzImieKrotkie(u.imie) === pobierzImieKrotkie(imie)) || null;
    }
    return null;
}

function pobierzNazwePracownika(lista, pracownikId, imie, fallback = "") {
    const pracownik = znajdzPracownika(lista, pracownikId, imie);
    return pracownik ? pracownik.imie : (imie || fallback);
}
