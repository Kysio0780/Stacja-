'use strict';
// Licznik miejsca zajętego przez zdjęcia zapisane jako data URL w Firestore.
// Działa przez przeliczenie rzeczywistych dokumentów, więc dodania i usunięcia
// zawsze się uwzględniają (nie trzeba prowadzić osobnego licznika w bazie).

const KOLEKCJE_ZE_ZDJECIAMI = ['planogramy', 'wiadomosci', 'sprzatanie'];
const KLUCZ_CACHE_ROZMIARU = 'app_rozmiar_zdjec';

function rozmiarZdjeciaZBase64(zdjecie) {
    return typeof zdjecie === 'string' ? zdjecie.length : 0;
}

function policzZdjeciaWDokumencie(dane) {
    const wynik = { bajty: 0, liczba: 0 };
    if (!dane) return wynik;

    if (Array.isArray(dane.zdjęcia)) {
        dane.zdjęcia.forEach(z => {
            if (typeof z === 'string') { wynik.bajty += z.length; wynik.liczba++; }
        });
    } else if (dane.plik) {
        wynik.bajty += rozmiarZdjeciaZBase64(dane.plik);
        wynik.liczba++;
    }
    if (dane.zdjecie) {
        wynik.bajty += rozmiarZdjeciaZBase64(dane.zdjecie);
        wynik.liczba++;
    }
    // Sprzątanie trzyma zdjęcia zagnieżdżone w mapie półek.
    if (dane.półki && typeof dane.półki === 'object') {
        Object.values(dane.półki).forEach(wpis => {
            if (wpis && typeof wpis === 'object' && wpis.zdjecie) {
                wynik.bajty += rozmiarZdjeciaZBase64(wpis.zdjecie);
                wynik.liczba++;
            }
        });
    }
    return wynik;
}

async function obliczRozmiarZdjecWBazie() {
    let bajty = 0;
    let liczba = 0;
    let bledy = 0;
    for (const nazwaKolekcji of KOLEKCJE_ZE_ZDJECIAMI) {
        try {
            const snap = await getDocs(collection(db, nazwaKolekcji));
            snap.forEach(dok => {
                const czesc = policzZdjeciaWDokumencie(dok.data());
                bajty += czesc.bajty;
                liczba += czesc.liczba;
            });
        } catch (e) {
            bledy++;
            console.warn(`Nie udało się policzyć zdjęć w kolekcji ${nazwaKolekcji}:`, e);
        }
    }
    return { bajty, liczba, bledy };
}

function wyswietlRozmiarZdjec(wynik) {
    const pole = document.getElementById('header-storage-value');
    const ramka = document.getElementById('header-storage-usage');
    if (!pole || !ramka) return;

    const bajty = Number(wynik?.bajty) || 0;
    const liczba = Number(wynik?.liczba) || 0;
    const bledy = Number(wynik?.bledy) || 0;
    const mb = Math.round(bajty / (1024 * 1024));
    pole.innerText = bajty > 0 && mb === 0 ? '<1 MB' : `${mb} MB`;
    const uwaga = bledy ? ` Uwaga: nie policzono ${bledy} kolekcji.` : '';
    ramka.title = `Zdjęcia w bazie: ${(bajty / 1024 / 1024).toFixed(2)} MB (${liczba} plików).${uwaga} To nie jest rozmiar całej bazy. Kliknij, aby przeliczyć.`;
}

function zapiszCacheRozmiaru(wynik) {
    try {
        localStorage.setItem(KLUCZ_CACHE_ROZMIARU, JSON.stringify({ ...wynik, data: Date.now() }));
    } catch (e) { /* brak dostępu do localStorage – wyświetlamy tylko bieżący wynik */ }
}

function odczytajCacheRozmiaru() {
    try {
        const dane = JSON.parse(localStorage.getItem(KLUCZ_CACHE_ROZMIARU) || 'null');
        return dane && typeof dane.bajty === 'number' ? dane : null;
    } catch (e) { return null; }
}

let liczenieRozmiaruWBiegu = false;
let oczekujeNaPonowneLiczenie = false;

window.odswiezRozmiarZdjec = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return;
    if (liczenieRozmiaruWBiegu) { oczekujeNaPonowneLiczenie = true; return; }
    liczenieRozmiaruWBiegu = true;

    const ramka = document.getElementById('header-storage-usage');
    if (ramka) ramka.classList.add('liczenie');
    try {
        const wynik = await obliczRozmiarZdjecWBazie();
        zapiszCacheRozmiaru(wynik);
        wyswietlRozmiarZdjec(wynik);
    } catch (e) {
        console.warn('Nie udało się policzyć rozmiaru zdjęć w bazie:', e);
        const pole = document.getElementById('header-storage-value');
        if (pole) pole.innerText = '—';
    } finally {
        if (ramka) ramka.classList.remove('liczenie');
        liczenieRozmiaruWBiegu = false;
        if (oczekujeNaPonowneLiczenie) {
            oczekujeNaPonowneLiczenie = false;
            window.odswiezRozmiarZdjec();
        }
    }
};

// Wołane po zapisie/usunięciu zdjęcia – odświeża licznik tylko dla admina.
window.odswiezRozmiarZdjecJesliAdmin = function() {
    if (currentUserData && currentUserData.rola === 'admin') window.odswiezRozmiarZdjec();
};

window.inicjalizujWskaznikMagazynu = function() {
    const ramka = document.getElementById('header-storage-usage');
    if (!ramka) return;
    const czyAdmin = !!(currentUserData && currentUserData.rola === 'admin');
    ramka.classList.toggle('hidden', !czyAdmin);
    if (!czyAdmin) return;

    const cache = odczytajCacheRozmiaru();
    if (cache) wyswietlRozmiarZdjec(cache);
    window.odswiezRozmiarZdjec();
};
