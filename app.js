import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQV47LSO2xxYu2l4aINXlZNvX62QSoZvE",
  authDomain: "sp580bol.firebaseapp.com",
  projectId: "sp580bol",
  storageBucket: "sp580bol.firebasestorage.app",
  messagingSenderId: "132998692538",
  appId: "1:132998692538:web:4170ec76d2eeae21d38c83"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;
let aktualneDaneSprzatania = {};

const DOMYSLNE_POLKI = [
    "Akcesoria", "Alkohol", "Chemia", "Kasa 1: 5 półek", "Kasa 1: 9 półek", 
    "Kasa 2: 5 półek", "Kasa 2: 9 półek", "Kawy / Sosy", "Lodówka mała", 
    "Lodówka Napoje", "Lodówka Piwo", "Oleje", "Piwo", "Soki i Woda", "Strefa zakasowa"
];

function kompresujObraz(file, callback) {
    if (!file) { callback(null); return; }
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 900;
            const MAX_HEIGHT = 900;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.toggleCollapsible = function(id, arrowId) {
    const content = document.getElementById(id);
    const arrow = document.getElementById(arrowId);
    content.classList.toggle('open');
    arrow.innerText = content.classList.contains('open') ? "▲ Zwiń" : "▼ Rozwiń";
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = ['modal-zoom-zdjecia', 'modal-polka', 'modal-planogram-szczegoly', 'modal-zmien-haslo', 'modal-ustawienia', 'modal-uniwersalna-misja', 'modal-szczegoly-pracownika'];
        for (let mId of modals) {
            const el = document.getElementById(mId);
            if (el && !el.classList.contains('hidden')) {
                el.classList.add('hidden');
                return;
            }
        }
        const hash = window.location.hash;
        if (hash === '#dzien') window.location.hash = '#sprzedaz';
        else if (hash && hash !== '#menu') window.location.hash = '#menu';
    }
});

window.addEventListener('contextmenu', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    e.preventDefault();
    
    const modals = ['modal-zoom-zdjecia', 'modal-polka', 'modal-planogram-szczegoly', 'modal-zmien-haslo', 'modal-ustawienia', 'modal-uniwersalna-misja', 'modal-szczegoly-pracownika'];
    for (let mId of modals) {
        const el = document.getElementById(mId);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            return;
        }
    }
    const hash = window.location.hash;
    if (hash === '#dzien') window.location.hash = '#sprzedaz';
    else if (hash && hash !== '#menu') window.location.hash = '#menu';
});

let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;
let lastTouchDistance = null;

window.otworzZoomZdjecia = function(src) {
    const img = document.getElementById('zoom-image-element');
    img.src = src;
    scale = 1; pointX = 0; pointY = 0;
    updateImageTransform();
    document.getElementById('modal-zoom-zdjecia').classList.remove('hidden');
}

window.zamknijZoomZdjecia = () => document.getElementById('modal-zoom-zdjecia').classList.add('hidden');

function updateImageTransform() {
    document.getElementById('zoom-image-element').style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
}

const zoomContainer = document.getElementById('zoom-container');

zoomContainer.onmousedown = (e) => { e.preventDefault(); startX = e.clientX - pointX; startY = e.clientY - pointY; panning = true; };
zoomContainer.onmouseup = () => { panning = false; };
zoomContainer.onmousemove = (e) => {
    e.preventDefault();
    if (!panning) return;
    pointX = e.clientX - startX; pointY = e.clientY - startY;
    updateImageTransform();
};
zoomContainer.onwheel = (e) => {
    e.preventDefault();
    const xs = (e.clientX - pointX) / scale, ys = (e.clientY - pointY) / scale;
    scale = e.deltaY < 0 ? scale * 1.1 : Math.max(1, scale / 1.1);
    pointX = e.clientX - xs * scale; pointY = e.clientY - ys * scale;
    if (scale === 1) { pointX = 0; pointY = 0; }
    updateImageTransform();
};

zoomContainer.ontouchstart = (e) => {
    if (e.touches.length === 1) {
        panning = true;
        startX = e.touches[0].clientX - pointX;
        startY = e.touches[0].clientY - pointY;
        lastTouchDistance = null;
    } else if (e.touches.length === 2) {
        panning = false;
        lastTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
};

zoomContainer.ontouchend = () => {
    panning = false;
    lastTouchDistance = null;
    if (scale < 1) { scale = 1; pointX = 0; pointY = 0; updateImageTransform(); }
};

zoomContainer.ontouchmove = (e) => {
    e.preventDefault();
    if (panning && e.touches.length === 1) {
        pointX = e.touches[0].clientX - startX;
        pointY = e.touches[0].clientY - startY;
        updateImageTransform();
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
        let currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        let factor = currentDistance / lastTouchDistance;
        scale = Math.max(1, Math.min(scale * factor, 5));
        lastTouchDistance = currentDistance;
        if (scale === 1) { pointX = 0; pointY = 0; }
        updateImageTransform();
    }
};

window.zmienMotyw = (tryb) => { localStorage.setItem("sklep_motyw", tryb); zastosujMotyw(tryb); };
function zastosujMotyw(tryb) {
    if (tryb === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
}
window.zmienCzcionke = (rozmiar) => { localStorage.setItem("sklep_czcionka", rozmiar); zastosujCzcionke(rozmiar); };
function zastosujCzcionke(rozmiar) {
    if (rozmiar && rozmiar !== "normal") document.documentElement.setAttribute("data-fontsize", rozmiar);
    else document.documentElement.removeAttribute("data-fontsize");
}

zastosujMotyw(localStorage.getItem("sklep_motyw") || "light");
zastosujCzcionke(localStorage.getItem("sklep_czcionka") || "normal");

window.otworzModalUstawienia = () => document.getElementById('modal-ustawienia').classList.remove('hidden');
window.zamknijModalUstawienia = () => document.getElementById('modal-ustawienia').classList.add('hidden');

window.otworzModalZmianyHasla = function() {
    document.getElementById('stare-haslo').value = "";
    document.getElementById('nowe-haslo-1').value = "";
    document.getElementById('nowe-haslo-2').value = "";
    document.getElementById('haslo-msg').innerText = "";
    document.getElementById('modal-zmien-haslo').classList.remove('hidden');
}
window.zamknijModalZmianyHasla = () => document.getElementById('modal-zmien-haslo').classList.add('hidden');

window.zmienWlasneHasloPotwierdz = async function() {
    const stareHaslo = document.getElementById('stare-haslo').value;
    const h1 = document.getElementById('nowe-haslo-1').value;
    const h2 = document.getElementById('nowe-haslo-2').value;
    const msg = document.getElementById('haslo-msg');
    msg.style.color = "red"; msg.innerText = "";

    if (!stareHaslo || !h1 || !h2) { msg.innerText = "Wypełnij wszystkie pola!"; return; }
    if (h1 !== h2) { msg.innerText = "Hasła się nie zgadzają!"; return; }
    if (h1.length < 6) { msg.innerText = "Nowe hasło musi mieć min. 6 znaków!"; return; }

    const user = auth.currentUser;
    if (!user) return;

    try {
        const credential = EmailAuthProvider.credential(user.email, stareHaslo);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, h1);
        msg.style.color = "green";
        msg.innerText = "Hasło zostało pomyślnie zmienione!";
        setTimeout(() => { zamknijModalZmianyHasla(); zamknijModalUstawienia(); }, 1500);
    } catch (error) {
        msg.innerText = (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? "Błąd: Podano niepoprawne aktualne hasło." : "Błąd: " + error.message;
    }
};

function pobierzBiezacyOkresSystemowy() {
    const teraz = new Date();
    return {
        miesiacStr: `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}`,
        okresStr: teraz.getDate() <= 15 ? "1-15" : "16-koniec"
    };
}

window.addEventListener("hashchange", () => {
    const hash = window.location.hash;
    ['modul-sprzedaz', 'modul-grafik', 'modul-pracownicy', 'modul-sprzatanie', 'modul-planogram', 'modul-misje', 'modul-statystyki', 'menu-tiles'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    if (hash === "#menu" || hash === "") {
        document.getElementById('menu-tiles').classList.remove('hidden');
        if (currentUserData) sprawdzPowiadomieniaMisje(currentUserData.imie, currentUserData.rola === 'admin');
    } else if (hash === "#sprzedaz") {
        document.getElementById('modul-sprzedaz').classList.remove('hidden');
        pokazWidokMiesieczny();
    } else if (hash === "#grafik") {
        document.getElementById('modul-grafik').classList.remove('hidden');
        if(!document.getElementById('grafik-miesiac').value) document.getElementById('grafik-miesiac').value = new Date().toISOString().slice(0, 7);
        document.getElementById('admin-grafik-panel').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        zaladujGrafikObrazkowy();
    } else if (hash === "#misje") {
        document.getElementById('modul-misje').classList.remove('hidden');
        document.getElementById('admin-misje-wrapper').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        zaladujMisje();
    } else if (hash === "#sprzatanie") {
        document.getElementById('modul-sprzatanie').classList.remove('hidden');
        const b = pobierzBiezacyOkresSystemowy();
        document.getElementById('sprzatanie-miesiac').value = b.miesiacStr;
        document.getElementById('sprzatanie-okres').value = b.okresStr;
        zaladujSprzatanie();
    } else if (hash === "#planogram") {
        document.getElementById('modul-planogram').classList.remove('hidden');
        document.getElementById('admin-planogram-kategoria-panel').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));
        zaladujPlanogramyMenu();
    } else if (hash === "#pracownicy") {
        document.getElementById('modul-pracownicy').classList.remove('hidden');
        zaladujlistePracownikow();
    } else if (hash === "#statystyki") {
        if (!(currentUserData && currentUserData.rola === 'admin')) { window.location.hash = "#menu"; return; }
        document.getElementById('modul-statystyki').classList.remove('hidden');
    } else if (hash === "#dzien") {
        document.getElementById('modul-sprzedaz').classList.remove('hidden');
        document.getElementById('view-monthly').classList.add('hidden');
        document.getElementById('view-daily').classList.remove('hidden');
    }
});

window.otworzModul = (nazwa) => { window.location.hash = "#" + nazwa; };

window.toggleEtatPole = function(prefix) {
    const umowa = document.getElementById(`${prefix}-p-umowa`).value;
    document.getElementById(`${prefix}-etat-box`).style.display = (umowa === 'Zlecenie') ? 'none' : 'block';
}

window.checkEtatCustom = function(prefix) {
    const etatVal = document.getElementById(`${prefix}-p-etat`).value;
    document.getElementById(`${prefix}-p-etat-custom`).classList.toggle('hidden', etatVal !== 'inny');
}

window.pokazOpcjeStatystyk = function() {
    document.getElementById('statystyki-opcje-panel').classList.remove('hidden');
}

window.toggleStatsCustomDates = function() {
    const typ = document.getElementById('stats-okres-typ').value;
    document.getElementById('stats-custom-dates-box').classList.toggle('hidden', typ !== 'custom');
}

window.przeliczIWygenerujStatystyki = async function() {
    const box = document.getElementById('statystyki-wynik-box');
    box.innerHTML = "Trwa przeliczanie i ładowanie danych...";

    const typOkresu = document.getElementById('stats-okres-typ').value;
    let dOd = "", dDo = "";
    let biezacyMiesiacCode = new Date().toISOString().slice(0, 7);

    const teraz = new Date();
    if (typOkresu === 'biezacy') {
        dOd = `${biezacyMiesiacCode}-01`;
        dDo = new Date(teraz.getFullYear(), teraz.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (typOkresu === 'poprzedni') {
        let prev = new Date(teraz.getFullYear(), teraz.getMonth() - 1, 1);
        let prevCode = prev.toISOString().slice(0, 7);
        dOd = `${prevCode}-01`;
        dDo = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (typOkresu === '30dni') {
        let d30 = new Date(); d30.setDate(d30.getDate() - 30);
        dOd = d30.toISOString().slice(0, 10);
        dDo = teraz.toISOString().slice(0, 10);
    } else if (typOkresu === 'custom') {
        dOd = document.getElementById('stats-date-from').value;
        dDo = document.getElementById('stats-date-to').value;
        if (!dOd || !dDo) return alert("Wybierz poprawny zakres dat (od-do)!");
    }

    try {
        let raportySnap = await getDocs(collection(db, "sprzedaz"));
        let przefiltrowaneRaporty = [];
        raportySnap.forEach(d => {
            let r = d.data();
            if (r.data >= dOd && r.data <= dDo) przefiltrowaneRaporty.push(r);
        });

        let htmlWynik = `<div style="display:flex; flex-direction:column; gap:15px; width:100%; box-sizing:border-box;">`;
        htmlWynik += `<div style="background:var(--group-bg); padding:10px; border-radius:6px; font-weight:bold; word-break:break-word;">📅 Wybrany okres raportowania: od ${dOd} do ${dDo}</div>`;

        if (document.getElementById('chk-stat-sprzedaz-ogolna').checked) {
            let sKawaW = 0, sHdW = 0, sSklepW = 0, sumaLaczna = 0;
            let najlepszyDzien = null, najgorszyDzien = null;

            przefiltrowaneRaporty.forEach(r => {
                let kawa = Number(r.kawa?.wartosc)||0;
                let hd = Number(r.hd?.wartosc)||0;
                let sklep = Number(r.sklep?.wartosc)||0;
                let sumaDnia = kawa + hd + sklep;
                let sprzedawcyDnia = r.sprzedawcy ? r.sprzedawcy.join(', ') : 'Brak danych';

                sKawaW += kawa; sHdW += hd; sSklepW += sklep; sumaLaczna += sumaDnia;

                if (!najlepszyDzien || sumaDnia > najlepszyDzien.suma) najlepszyDzien = { data: r.data, suma: sumaDnia, kawa, hd, sklep, sprzedawcy: sprzedawcyDnia };
                if (!najgorszyDzien || sumaDnia < najgorszyDzien.suma) najgorszyDzien = { data: r.data, suma: sumaDnia, kawa, hd, sklep, sprzedawcy: sprzedawcyDnia };
            });

            let dniLiczba = przefiltrowaneRaporty.length || 1;
            let sredniaDziennie = sumaLaczna / dniLiczba;

            htmlWynik += `
                <div class="field-group" style="border-left:4px solid #007bff;">
                    <h4 style="margin-top:0;">📊 Sprzedaż Ogólna i Kategoriowa</h4>
                    <div class="table-responsive">
                        <table class="standard-table" style="text-align: left;">
                            <tr><th>Wskaźnik / Kategoria</th><th>Wartość / Średnia</th></tr>
                            <tr><td><strong>Łączny obrót</strong></td><td>${sumaLaczna.toFixed(2)} zł (Dni: ${przefiltrowaneRaporty.length})</td></tr>
                            <tr><td><strong>Średnia dzienna</strong></td><td>${sredniaDziennie.toFixed(2)} zł/dzień</td></tr>
                            <tr><td><strong>☕ Kawa</strong></td><td>Łącznie: ${sKawaW.toFixed(2)} zł | Średnio: ${(sKawaW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                            <tr><td><strong>🌭 HD</strong></td><td>Łącznie: ${sHdW.toFixed(2)} zł | Średnio: ${(sHdW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                            <tr><td><strong>🛒 Sklep</strong></td><td>Łącznie: ${sSklepW.toFixed(2)} zł | Średnio: ${(sSklepW/dniLiczba).toFixed(2)} zł/dzień</td></tr>
                        </table>
                    </div>
                    ${najlepszyDzien ? `<p style="margin-top:8px;" class="val-green">🌟 Najlepszy dzień: <strong>${najlepszyDzien.data}</strong> (${najlepszyDzien.suma.toFixed(2)} zł) — Pracownicy: <strong>${najlepszyDzien.sprzedawcy}</strong></p>` : ''}
                    ${najgorszyDzien ? `<p class="val-red">🔻 Najgorszy dzień: <strong>${najgorszyDzien.data}</strong> (${najgorszyDzien.suma.toFixed(2)} zł) — Pracownicy: <strong>${najgorszyDzien.sprzedawcy}</strong></p>` : ''}
                </div>
            `;
        }

        if (document.getElementById('chk-stat-sprzedaz-pracownicy').checked) {
            let pracownicyWyniki = {};

            przefiltrowaneRaporty.forEach(r => {
                let osoby = r.sprzedawcy || [];
                let cnt = osoby.length;
                if (cnt > 0) {
                    let kawaUdzial = (Number(r.kawa?.wartosc)||0) / cnt;
                    let hdUdzial = (Number(r.hd?.wartosc)||0) / cnt;
                    let sklepUdzial = (Number(r.sklep?.wartosc)||0) / cnt;
                    let sumaUdzial = kawaUdzial + hdUdzial + sklepUdzial;

                    osoby.forEach(p => {
                        if (!pracownicyWyniki[p]) pracownicyWyniki[p] = { suma: 0, kawa: 0, hd: 0, sklep: 0, dni: 0 };
                        pracownicyWyniki[p].suma += sumaUdzial;
                        pracownicyWyniki[p].kawa += kawaUdzial;
                        pracownicyWyniki[p].hd += hdUdzial;
                        pracownicyWyniki[p].sklep += sklepUdzial;
                        pracownicyWyniki[p].dni += 1;
                    });
                }
            });

            let pRows = "";
            Object.keys(pracownicyWyniki).forEach(p => {
                let pw = pracownicyWyniki[p];
                pRows += `<tr><td><strong>${p}</strong></td><td>${pw.dni}</td><td>☕ ${pw.kawa.toFixed(2)} zł</td><td>🌭 ${pw.hd.toFixed(2)} zł</td><td>🛒 ${pw.sklep.toFixed(2)} zł</td><td><strong>${pw.suma.toFixed(2)} zł</strong></td></tr>`;
            });

            htmlWynik += `
                <div class="field-group" style="border-left:4px solid #28a745;">
                    <h4 style="margin-top:0;">👥 Sprzedaż w podziale na pracowników (Proporcjonalnie)</h4>
                    ${pRows ? `<div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Dni</th><th>Kawa</th><th>HD</th><th>Sklep</th><th>Suma</th></tr>${pRows}</table></div>` : '<p>Brak danych sprzedażowych w okresie.</p>'}
                </div>
            `;
        }

        if (document.getElementById('chk-stat-plany').checked) {
            let miesiacKlucz = dOd.slice(0, 7);
            const pDoc = await getDoc(doc(db, "plany_miesieczne", miesiacKlucz));
            let plany = pDoc.exists() ? pDoc.data() : { kawa: 0, hd: 0, sklep: 0 };

            let sKawaW = 0, sHdW = 0, sSklepW = 0;
            przefiltrowaneRaporty.forEach(r => {
                sKawaW += Number(r.kawa?.wartosc)||0;
                sHdW += Number(r.hd?.wartosc)||0;
                sSklepW += Number(r.sklep?.wartosc)||0;
            });

            let terazDate = new Date();
            let [rRok, rMies] = miesiacKlucz.split('-').map(Number);
            let dniWMiesiacu = new Date(rRok, rMies, 0).getDate();
            let biezacyDzien = (terazDate.getFullYear() === rRok && (terazDate.getMonth() + 1) === rMies) ? terazDate.getDate() : dniWMiesiacu;
            let ptProporcja = biezacyDzien / dniWMiesiacu;

            let planPropKawa = (plany.kawa || 0) * ptProporcja;
            let planPropHd = (plany.hd || 0) * ptProporcja;
            let planPropSklep = (plany.sklep || 0) * ptProporcja;

            let diffKawa100 = sKawaW - (plany.kawa||0);
            let diffHd100 = sHdW - (plany.hd||0);
            let diffSklep100 = sSklepW - (plany.sklep||0);

            let diffKawaProp = sKawaW - planPropKawa;
            let diffHdProp = sHdW - planPropHd;
            let diffSklepProp = sSklepW - planPropSklep;

            htmlWynik += `
                <div class="field-group" style="border-left:4px solid #17a2b8;">
                    <h4 style="margin-top:0;">🎯 Realizacja Planów Sprzedażowych (${miesiacKlucz})</h4>
                    <p style="font-size:0.85em; color:#6c757d;">Proporcja upływu miesiąca: Dzień ${biezacyDzien} z ${dniWMiesiacu} (${(ptProporcja*100).toFixed(1)}%)</p>
                    <div class="table-responsive">
                        <table class="standard-table">
                            <tr><th>Kategoria</th><th>Wykonanie</th><th>Plan Cały</th><th>Status 100%</th><th>Plan do Dziś</th><th>Status do Dziś</th></tr>
                            <tr>
                                <td><strong>☕ KAWA</strong></td>
                                <td>${sKawaW.toFixed(2)} zł</td>
                                <td>${(plany.kawa||0).toFixed(2)} zł</td>
                                <td class="${diffKawa100>=0?'val-green':'val-red'}">${diffKawa100.toFixed(2)} zł</td>
                                <td>${planPropKawa.toFixed(2)} zł</td>
                                <td class="${diffKawaProp>=0?'val-green':'val-red'}">${diffKawaProp.toFixed(2)} zł</td>
                            </tr>
                            <tr>
                                <td><strong>🌭 HD</strong></td>
                                <td>${sHdW.toFixed(2)} zł</td>
                                <td>${(plany.hd||0).toFixed(2)} zł</td>
                                <td class="${diffHd100>=0?'val-green':'val-red'}">${diffHd100.toFixed(2)} zł</td>
                                <td>${planPropHd.toFixed(2)} zł</td>
                                <td class="${diffHdProp>=0?'val-green':'val-red'}">${diffHdProp.toFixed(2)} zł</td>
                            </tr>
                            <tr>
                                <td><strong>🛒 SKLEP</strong></td>
                                <td>${sSklepW.toFixed(2)} zł</td>
                                <td>${(plany.sklep||0).toFixed(2)} zł</td>
                                <td class="${diffSklep100>=0?'val-green':'val-red'}">${diffSklep100.toFixed(2)} zł</td>
                                <td>${planPropSklep.toFixed(2)} zł</td>
                                <td class="${diffSklepProp>=0?'val-green':'val-red'}">${diffSklepProp.toFixed(2)} zł</td>
                            </tr>
                        </table>
                    </div>
                </div>
            `;
        }

        if (document.getElementById('chk-stat-sprzatanie').checked) {
            let sprzatanieSnap = await getDocs(collection(db, "sprzatanie"));
            let wykonaneRazem = 0, niewykonaneRazem = 0, zresetowaneAdmin = 0;
            let pracownicySprzatanie = {};

            sprzatanieSnap.forEach(docS => {
                let id = docS.id;
                let mPart = id.slice(0, 7);
                if (mPart >= dOd.slice(0, 7) && mPart <= dDo.slice(0, 7)) {
                    let polki = docS.data().półki || {};
                    Object.values(polki).forEach(p => {
                        let zrobione = p.czystosc && p.daty && p.planogram;
                        if (zrobione) {
                            wykonaneRazem++;
                            let kto = p.podpis || "Nieznany";
                            if (kto !== "-") pracownicySprzatanie[kto] = (pracownicySprzatanie[kto] || 0) + 1;
                        } else {
                            niewykonaneRazem++;
                        }
                        if (p.podpis === "-" && p.dataSprawdzenia) {
                            zresetowaneAdmin++;
                        }
                    });
                }
            });

            let spRows = "";
            Object.keys(pracownicySprzatanie).forEach(kto => {
                spRows += `<tr><td><strong>${kto}</strong></td><td>✔ ${pracownicySprzatanie[kto]} sprawdzonych półek</td></tr>`;
            });

            htmlWynik += `
                <div class="field-group" style="border-left:4px solid #ffc107;">
                    <h4 style="margin-top:0;">🧹 Kontrola Czystości i Półek</h4>
                    <p><strong>Wykonane zadania kontrolne:</strong> <span class="val-green">${wykonaneRazem}</span></p>
                    <p><strong>Niewykonane / w trakcie:</strong> <span class="val-red">${niewykonaneRazem}</span></p>
                    <p><strong>Cofnięte / zresetowane przez admina:</strong> ${zresetowaneAdmin}</p>
                    ${spRows ? `<h5 style="margin-bottom:5px;">Aktywność pracowników w sprzątaniu:</h5><div class="table-responsive"><table class="standard-table"><tr><th>Pracownik</th><th>Liczba wykonanych kontroli</th></tr>${spRows}</table></div>` : ''}
                </div>
            `;
        }

        htmlWynik += `</div>`;
        box.innerHTML = htmlWynik;

    } catch (e) {
        box.innerHTML = "<span class='error'>Błąd podczas obliczania statystyk: " + e.message + "</span>";
    }
}

window.toggleCleanupCustomDate = function() {
    const val = document.getElementById('cleanup-zakres').value;
    document.getElementById('cleanup-custom-box').classList.toggle('hidden', val !== 'custom');
}

window.uruchomProcedureUsuwaniaDanych = async function() {
    const wybor = document.getElementById('cleanup-zakres').value;
    let dataGraniczna = new Date();

    if (wybor === 'custom') {
        const customVal = document.getElementById('cleanup-custom-date').value;
        if (!customVal) return alert("Wybierz poprawną datę graniczną!");
        dataGraniczna = new Date(customVal);
    } else {
        let miesiace = parseInt(wybor);
        dataGraniczna.setMonth(dataGraniczna.getMonth() - miesiace);
    }

    let potwierdzenie1 = confirm(`⚠️ OSTRZEŻENIE: Zamierzasz trwale usunąć z serwera wszystkie dane starsze niż ${dataGraniczna.toISOString().slice(0, 10)}.\n\nCzy na pewno chcesz kontynuować?`);
    if (!potwierdzenie1) return;

    let potwierdzenie2 = confirm(`🔴 DRUGIE POTWIERDZENE: Tej operacji NIE DA SIĘ cofnąć. Wszystkie archiwalne raporty, misje i wpisy sprzed tej daty zostaną bezpowrotnie skasowane.\n\nKliknij OK, aby wykonać usunięcie.`);
    if (!potwierdzenie2) return;

    alert("Trwa usuwanie danych z serwera...");
    try {
        let usunieteKolekcje = ['sprzedaz', 'misje', 'prosby_o_zmiany'];
        for (let kol of usunieteKolekcje) {
            let snap = await getDocs(collection(db, kol));
            for (let d of snap.docs) {
                let dataD = d.data();
                let dataObiekt = null;
                if (dataD.data) dataObiekt = new Date(dataD.data);
                else if (dataD.doKiedy) dataObiekt = new Date(dataD.doKiedy);
                else if (dataD.dataUtworzenia) dataObiekt = new Date(dataD.dataUtworzenia);

                if (dataObiekt && dataObiekt < dataGraniczna) {
                    await deleteDoc(doc(db, kol, d.id));
                }
            }
        }
        alert("Operacja czyszczenia zakończona pomyślnie.");
    } catch (e) {
        alert("Błąd podczas usuwania danych: " + e.message);
    }
}

async function sprawdzPowiadomieniaMisje(imie, czyAdmin) {
    try {
        const snap = await getDocs(collection(db, "misje"));
        let noweCnt = 0;
        snap.forEach(d => {
            const data = d.data();
            if (czyAdmin) { if (data.status === "nowe") noweCnt++; }
            else { if (data.pracownik === imie && data.status === "nowe") noweCnt++; }
        });
        const badge = document.getElementById('misje-badge');
        if (noweCnt > 0) { badge.innerText = noweCnt; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    } catch (e) { console.error(e); }
}

async function wypelnijSelectPracownikow(selectId) {
    const sel = document.getElementById(selectId);
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let html = `<option value="">Wybierz pracownika</option>`;
        snap.forEach(d => { html += `<option value="${d.data().imie}">${d.data().imie}</option>`; });
        sel.innerHTML = html;
    } catch (e) { sel.innerHTML = `<option value="">Błąd ładowania</option>`; }
}

window.dodajMisje = async function() {
    const pracownik = document.getElementById('misja-pracownik-select').value;
    const zadanie = document.getElementById('misja-tresc').value.trim();
    const doKiedy = document.getElementById('misja-termin').value;
    if (!pracownik || !zadanie || !doKiedy) return alert("Wypełnij wszystkie pola misji!");
    try {
        await addDoc(collection(db, "misje"), { pracownik, zadanie, doKiedy, status: "nowe", uwagi: "", dataUtworzenia: new Date().toLocaleString() });
        alert("Misja przypisana!");
        document.getElementById('misja-tresc').value = "";
        document.getElementById('misja-termin').value = "";
        zaladujMisje();
    } catch (e) { alert("Błąd zapisu."); }
}

async function zaladujMisje() {
    const container = document.getElementById('misje-lista-container');
    container.innerHTML = "Pobieranie misji...";
    if (currentUserData && currentUserData.rola === 'admin') wypelnijSelectPracownikow('misja-pracownik-select');
    try {
        const snap = await getDocs(collection(db, "misje"));
        let html = `<table class="standard-table"><tr><th>Pracownik</th><th>Zadanie</th><th>Do kiedy</th><th>Status</th><th>Uwagi</th></tr>`;
        let count = 0, czyAdmin = currentUserData && currentUserData.rola === 'admin', mojeImie = currentUserData ? currentUserData.imie : "";
        let noweDlaMnie = 0, dzisiajStr = new Date().toISOString().slice(0, 10);

        for (const docSnap of snap.docs) {
            const id = docSnap.id, d = docSnap.data();
            if (!czyAdmin && d.pracownik !== mojeImie) continue;
            
            let aktualnyStatus = d.status;
            if (d.doKiedy && d.doKiedy < dzisiajStr && !['zrobione', 'zaliczone', 'po czasie'].includes(aktualnyStatus)) {
                aktualnyStatus = 'po czasie';
                await setDoc(doc(db, "misje", id), { status: 'po czasie' }, { merge: true });
            }

            count++;
            if ((!czyAdmin && d.pracownik === mojeImie && aktualnyStatus === "nowe") || (czyAdmin && aktualnyStatus === "nowe")) noweDlaMnie++;

            let kolory = { 'zrobione': '#28a745', 'zaliczone': '#28a745', 'po czasie': '#dc3545', 'do wyjaśnienia': '#dc3545', 'odebrane': '#17a2b8', 'nowe': '#ffc107' };
            let statusBadge = `<span style="background: ${kolory[aktualnyStatus]||'#ffc107'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">${aktualnyStatus}</span>`;
            
            let bezpiecznaTresc = encodeURIComponent(d.zadanie);
            let bezpieczneUwagi = encodeURIComponent(d.uwagi || '');
            html += `<tr class="cleaning-row" onclick="otworzModalUniwersalnaMisja('${id}', '${d.pracownik}', '${bezpiecznaTresc}', '${d.doKiedy}', '${aktualnyStatus}', '${bezpieczneUwagi}')">
                <td><strong>${d.pracownik}</strong></td>
                <td style="text-align:left;">${d.zadanie}</td>
                <td align="center">${d.doKiedy}</td>
                <td align="center">${statusBadge}</td>
                <td>${d.uwagi||'-'}</td>
            </tr>`;
        }

        if (noweDlaMnie > 0) {
            let msgAlerty = czyAdmin ? `⚠️ W systemie jest ${noweDlaMnie} nowych zadań oczekujących na podjęcie!` : `⚠️ Masz ${noweDlaMnie} nowe zadanie(-a)!`;
            container.innerHTML = `<div style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold;">${msgAlerty}</div>` + (count === 0 ? "<p style='color:#6c757d;'>Brak misji.</p>" : html + `</table>`);
        } else {
            container.innerHTML = count === 0 ? "<p style='color:#6c757d;'>Brak misji.</p>" : html + `</table>`;
        }
        sprawdzPowiadomieniaMisje(mojeImie, czyAdmin);
    } catch (e) { container.innerHTML = "Błąd pobierania."; }
}

window.otworzModalUniwersalnaMisja = async function(id, pracownik, zadanie, doKiedy, status, uwagi) {
    document.getElementById('m-edit-misja-id').value = id;
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    
    const adminSekcja = document.getElementById('admin-edit-misja-sekcja');
    const pracownikSekcja = document.getElementById('pracownik-view-misja-sekcja');
    const btnUsun = document.getElementById('btn-usun-misja-admin');
    const statusSel = document.getElementById('m-edit-misja-status');

    if (status === "nowe") {
        status = "odebrane";
        try {
            await setDoc(doc(db, "misje", id), { status: "odebrane" }, { merge: true });
        } catch(e) { console.error(e); }
    }

    if (czyAdmin) {
        adminSekcja.classList.remove('hidden');
        pracownikSekcja.classList.add('hidden');
        btnUsun.style.display = 'block';
        await wypelnijSelectPracownikow('m-edit-misja-pracownik');
        document.getElementById('m-edit-misja-pracownik').value = pracownik;
        document.getElementById('m-edit-misja-tresc-admin').value = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-admin').value = doKiedy;

        statusSel.innerHTML = `
            <option value="nowe">nowe</option>
            <option value="odebrane">odebrane</option>
            <option value="zrobione">zrobione</option>
            <option value="zaliczone">zaliczone</option>
            <option value="do wyjaśnienia">do wyjaśnienia</option>
        `;
    } else {
        adminSekcja.classList.add('hidden');
        pracownikSekcja.classList.remove('hidden');
        btnUsun.style.display = 'none';
        document.getElementById('m-edit-misja-tresc-pracownik').innerText = decodeURIComponent(zadanie);
        document.getElementById('m-edit-misja-termin-pracownik').innerText = doKiedy;

        let opcjaAktualnaTekst = status.charAt(0).toUpperCase() + status.slice(1);
        statusSel.innerHTML = `
            <option value="${status}">${opcjaAktualnaTekst}</option>
            <option value="zrobione">Zrobione</option>
        `;
    }

    statusSel.value = status;
    document.getElementById('m-edit-misja-uwagi').value = decodeURIComponent(uwagi);
    document.getElementById('modal-uniwersalna-misja').classList.remove('hidden');
}

window.zamknijModalUniwersalnaMisja = () => {
    document.getElementById('modal-uniwersalna-misja').classList.add('hidden');
    zaladujMisje();
}

window.zapiszUniwersalnaMisja = async function() {
    const id = document.getElementById('m-edit-misja-id').value;
    const status = document.getElementById('m-edit-misja-status').value;
    const uwagi = document.getElementById('m-edit-misja-uwagi').value.trim();
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';

    let daneZapisu = { status, uwagi };
    if (czyAdmin) {
        daneZapisu.pracownik = document.getElementById('m-edit-misja-pracownik').value;
        daneZapisu.zadanie = document.getElementById('m-edit-misja-tresc-admin').value.trim();
        daneZapisu.doKiedy = document.getElementById('m-edit-misja-termin-admin').value;
    }

    try {
        await setDoc(doc(db, "misje", id), daneZapisu, { merge: true });
        zamknijModalUniwersalnaMisja();
        alert("Zaktualizowano zadanie!");
    } catch (e) { alert("Błąd zapisu zadania."); }
}

window.usunMisjeZModala = async function() {
    if (confirm("Czy na pewno chcesz usunąć tę misję?")) {
        const id = document.getElementById('m-edit-misja-id').value;
        try {
            await deleteDoc(doc(db, "misje", id));
            document.getElementById('modal-uniwersalna-misja').classList.add('hidden');
            alert("Usunięto misję.");
            zaladujMisje();
        } catch (e) { alert("Błąd usuwania misji."); }
    }
}

async function pobierzListePolokDlaPlanogramu() {
    try {
        const docSnap = await getDoc(doc(db, "system_ustawienia", "planogramy_kategorie"));
        if (docSnap.exists() && docSnap.data().lista) return docSnap.data().lista;
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista: DOMYSLNE_POLKI });
        return DOMYSLNE_POLKI;
    } catch (e) { return DOMYSLNE_POLKI; }
}

async function zaladujPlanogramyMenu() {
    const container = document.getElementById('planogramy-lista-container');
    container.innerHTML = "Pobieranie listy półek...";
    try {
        const listaPolok = await pobierzListePolokDlaPlanogramu();
        const querySnapshot = await getDocs(collection(db, "planogramy"));
        const danePlanogramow = {};
        querySnapshot.forEach(docSnap => { danePlanogramow[docSnap.id] = docSnap.data(); });

        let html = `<table class="cleaning-table"><tr><th>Nazwa półki / strefy</th><th>Data modyfikacji</th><th>Status / Liczba zdjęć</th>`;
        const czyAdmin = currentUserData && currentUserData.rola === 'admin';
        if (czyAdmin) html += `<th>Akcja</th>`;
        html += `</tr>`;

        listaPolok.forEach((polka) => {
            const pData = danePlanogramow[polka];
            let statusBadge = `<span class="badge-pending">Brak planogramu</span>`;
            let dataUmieszczenia = "-";
            if (pData) {
                if (pData.zdjęcia && pData.zdjęcia.length > 0) {
                    dataUmieszczenia = pData.dataUmieszczenia || "-";
                    statusBadge = `<span class="badge-done">📷 ${pData.zdjęcia.length} zdjęć</span>`;
                } else if (pData.plik) {
                    dataUmieszczenia = pData.dataUmieszczenia || "-";
                    statusBadge = `<span class="badge-done">📷 1 zdjęcie</span>`;
                }
            }
            html += `<tr class="cleaning-row"><td onclick="otworzModalPlanogramu('${polka}')"><strong>${polka}</strong></td><td align="center" onclick="otworzModalPlanogramu('${polka}')">${dataUmieszczenia}</td><td align="center" onclick="otworzModalPlanogramu('${polka}')">${statusBadge}</td>`;
            if (czyAdmin) html += `<td><button onclick="usunPolkeZListyPlanogramu('${polka}')" style="background: #dc3545; padding: 4px 8px; font-size: 0.8em; margin:0; width:auto;">🗑️ Usuń</button></td>`;
            html += `</tr>`;
        });
        container.innerHTML = html + `</table>`;
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
}

window.dodajNowaPolkeDoListy = async function() {
    const nazwa = document.getElementById('nowa-polka-nazwa').value.trim();
    if (!nazwa) return alert("Wpisz nazwę strefy!");
    try {
        let lista = await pobierzListePolokDlaPlanogramu();
        if (lista.includes(nazwa)) return alert("Taka strefa już istnieje!");
        lista.push(nazwa); lista.sort();
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista });
        document.getElementById('nowa-polka-nazwa').value = "";
        zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd."); }
}

window.usunPolkeZListyPlanogramu = async function(polkaNazwa) {
    if (!confirm(`Usunąć strefę "${polkaNazwa}" z listy?`)) return;
    try {
        let lista = (await pobierzListePolokDlaPlanogramu()).filter(p => p !== polkaNazwa);
        await setDoc(doc(db, "system_ustawienia", "planogramy_kategorie"), { lista });
        await deleteDoc(doc(db, "planogramy", polkaNazwa));
        zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd."); }
}

let wymawiajacyPolkaPlanogram = "";
window.otworzModalPlanogramu = async function(polkaNazwa) {
    wymawiajacyPolkaPlanogram = polkaNazwa;
    document.getElementById('modal-planogram-tytul').innerText = `Planogram: ${polkaNazwa}`;
    const trescDiv = document.getElementById('modal-planogram-tresc');
    trescDiv.innerHTML = "Pobieranie zdjęć...";
    document.getElementById('modal-planogram-szczegoly').classList.remove('hidden');
    document.getElementById('admin-planogram-edycja').classList.toggle('hidden', !(currentUserData && currentUserData.rola === 'admin'));

    try {
        const docSnap = await getDoc(doc(db, "planogramy", polkaNazwa));
        if (docSnap.exists()) {
            let listaZdjec = docSnap.data().zdjęcia || (docSnap.data().plik ? [docSnap.data().plik] : []);
            if (listaZdjec.length > 0) {
                let galleryHtml = `<p style="font-size: 0.9em; margin-bottom: 8px;">Ostatnia modyfikacja: <strong>${docSnap.data().dataUmieszczenia || '-'}</strong></p><div class="planogram-gallery">`;
                listaZdjec.forEach((imgSrc, idx) => {
                    galleryHtml += `<div class="planogram-thumb-box"><img src="${imgSrc}" onclick="otworzZoomZdjecia('${imgSrc}')">`;
                    if (currentUserData && currentUserData.rola === 'admin') galleryHtml += `<button class="del-photo-btn" onclick="usunPojedynczeZdjeciePlanogramu(${idx})">🗑️ Usuń</button>`;
                    galleryHtml += `</div>`;
                });
                trescDiv.innerHTML = galleryHtml + `</div>`;
            } else { trescDiv.innerHTML = `<p style="color: #6c757d; text-align: center; padding: 20px;">Brak zdjęć.</p>`; }
        } else { trescDiv.innerHTML = `<p style="color: #6c757d; text-align: center; padding: 20px;">Brak zdjęć.</p>`; }
    } catch (e) { trescDiv.innerHTML = "Błąd pobierania."; }
}

window.zamknijModalPlanogramu = () => document.getElementById('modal-planogram-szczegoly').classList.add('hidden');

window.dodajZdjeciaDoPlanogramu = async function() {
    const fileInput = document.getElementById('admin-planogram-file');
    if (fileInput.files.length === 0) return alert("Wybierz zdjęcia!");
    const files = Array.from(fileInput.files);
    
    const wczytaneBase64 = await Promise.all(files.map(file => new Promise(resolve => {
        kompresujObraz(file, (dataUrl) => resolve(dataUrl));
    })));

    try {
        const docRef = doc(db, "planogramy", wymawiajacyPolkaPlanogram);
        const docSnap = await getDoc(docRef);
        let istniejace = docSnap.exists() ? (docSnap.data().zdjęcia || (docSnap.data().plik ? [docSnap.data().plik] : [])) : [];
        await setDoc(docRef, { polka: wymawiajacyPolkaPlanogram, zdjęcia: istniejace.concat(wczytaneBase64), dataUmieszczenia: new Date().toLocaleString(), autor: currentUserData ? currentUserData.imie : "Admin" });
        fileInput.value = "";
        otworzModalPlanogramu(wymawiajacyPolkaPlanogram);
        zaladujPlanogramyMenu();
    } catch (err) { alert("Błąd zapisu."); }
}

window.usunPojedynczeZdjeciePlanogramu = async function(index) {
    if (!confirm("Usunąć to zdjęcie?")) return;
    try {
        const docRef = doc(db, "planogramy", wymawiajacyPolkaPlanogram);
        let istniejace = (await getDoc(docRef)).data().zdjęcia || [];
        istniejace.splice(index, 1);
        if (istniejace.length > 0) await setDoc(docRef, { zdjęcia: istniejace, dataUmieszczenia: new Date().toLocaleString() }, { merge: true });
        else await deleteDoc(docRef);
        otworzModalPlanogramu(wymawiajacyPolkaPlanogram);
        zaladujPlanogramyMenu();
    } catch (e) { alert("Błąd."); }
}

window.zaladujSprzatanie = async function() {
    const miesiac = document.getElementById('sprzatanie-miesiac').value;
    const okres = document.getElementById('sprzatanie-okres').value;
    const container = document.getElementById('sprzatanie-container');
    const infoTryb = document.getElementById('info-tryb-pracy');
    if (!miesiac) return;

    const biezacy = pobierzBiezacyOkresSystemowy();
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    const czyBiezacyOkres = (miesiac === biezacy.miesiacStr && okres === biezacy.okresStr);

    if (!czyAdmin && !czyBiezacyOkres) infoTryb.innerHTML = `<span style="color: #dc3545;">🔒 Archiwum: Tylko do odczytu.</span>`;
    else if (czyAdmin) infoTryb.innerHTML = `<span style="color: #28a745;">⚙️ Tryb kierownika: Pełne uprawnienia edycji.</span>`;
    else infoTryb.innerHTML = `<span style="color: #007bff;">✏️ Bieżący okres: Możesz wypełniać zadania.</span>`;

    container.innerHTML = "Pobieranie listy...";
    try {
        const docSnap = await getDoc(doc(db, "sprzatanie", `${miesiac}_${okres}`));
        aktualneDaneSprzatania = docSnap.exists() ? docSnap.data().półki || {} : {};

        let html = `<table class="cleaning-table"><tr><th>Półka / Strefa</th><th>Status</th><th>Ostatnio sprawdzał</th></tr>`;
        DOMYSLNE_POLKI.forEach((polka, index) => {
            const pData = aktualneDaneSprzatania[index] || { czystosc: false, daty: false, planogram: false, podpis: "-" };
            const zrobione = pData.czystosc && pData.daty && pData.planogram;
            let statusBadge = zrobione ? `<span class="badge-done">✔ Zrobione</span>` : `<span class="badge-pending">⏳ Do zrobienia</span>`;
            if (zrobione && pData.komentarz) statusBadge += `<br><span class="badge-warning">⚠️ Uwagi</span>`;
            if (pData.zdjecie) statusBadge += `<br><span class="badge-photo">📷 Zdjęcie</span>`;

            html += `<tr class="cleaning-row" onclick="otworzModalPolki(${index})"><td><strong>${polka}</strong></td><td align="center">${statusBadge}</td><td style="font-size:0.85em;">${pData.podpis !== "-" ? pData.podpis + " (" + (pData.dataSprawdzenia || '') + ")" : "-"}</td></tr>`;
        });
        container.innerHTML = html + `</table>`;
    } catch (e) { container.innerHTML = "Błąd pobierania."; }
}

window.otworzModalPolki = function(index) {
    const polkaNazwa = DOMYSLNE_POLKI[index];
    const pData = aktualneDaneSprzatania[index] || { czystosc: false, daty: false, planogram: false, komentarz: "", zdjecie: "" };
    const zrobione = pData.czystosc && pData.daty && pData.planogram;
    const czyAdmin = currentUserData && currentUserData.rola === 'admin';
    
    const miesiac = document.getElementById('sprzatanie-miesiac').value;
    const okres = document.getElementById('sprzatanie-okres').value;
    const biezacy = pobierzBiezacyOkresSystemowy();
    const czyBiezacyOkres = (miesiac === biezacy.miesiacStr && okres === biezacy.okresStr);

    document.getElementById('modal-polka-tytuł').innerText = `Sprawdź półkę: ${polkaNazwa}`;
    document.getElementById('modal-polka-index').value = index;
    
    document.getElementById('m-czystosc').checked = pData.czystosc || false;
    document.getElementById('m-daty').checked = pData.daty || false;
    document.getElementById('m-planogram').checked = pData.planogram || false;
    document.getElementById('m-komentarz').value = pData.komentarz || '';
    document.getElementById('m-zdjecie').value = "";

    let tylkoDoOdczytu = !czyAdmin && (!czyBiezacyOkres || zrobione);
    ['m-czystosc', 'm-daty', 'm-planogram', 'm-komentarz', 'm-zdjecie'].forEach(id => document.getElementById(id).disabled = tylkoDoOdczytu);
    document.getElementById('btn-zapisz-polka').style.display = tylkoDoOdczytu ? 'none' : 'block';
    document.getElementById('btn-usun-polka').style.display = (czyAdmin && pData.podpis !== "-") ? 'block' : 'none';

    document.getElementById('m-zdjecie-preview').innerHTML = pData.zdjecie ? `<p style="font-size:0.85em; color:#28a745;">Załączone zdjęcie:</p><img src="${pData.zdjecie}" onclick="otworzZoomZdjecia('${pData.zdjecie}')" style="max-height: 150px; border-radius: 4px; cursor: pointer;">` : `<p style="font-size:0.85em; color:#6c757d;">Brak zdjęcia</p>`;
    document.getElementById('modal-polka').classList.remove('hidden');
}

window.zamknijModalPolki = () => document.getElementById('modal-polka').classList.add('hidden');

window.zapiszSzczegolyPolki = async function() {
    const index = document.getElementById('modal-polka-index').value;
    const miesiac = document.getElementById('sprzatanie-miesiac').value;
    const okres = document.getElementById('sprzatanie-okres').value;
    const fileInput = document.getElementById('m-zdjecie');
    const stareDane = aktualneDaneSprzatania[index] || {};

    let zapiszDoBazy = async (imgSrc) => {
        try {
            aktualneDaneSprzatania[index] = {
                nazwa: DOMYSLNE_POLKI[index],
                czystosc: document.getElementById('m-czystosc').checked,
                daty: document.getElementById('m-daty').checked,
                planogram: document.getElementById('m-planogram').checked,
                komentarz: document.getElementById('m-komentarz').value.trim(),
                zdjecie: imgSrc || stareDane.zdjecie || "",
                podpis: currentUserData ? currentUserData.imie : "Pracownik",
                dataSprawdzenia: new Date().toLocaleString()
            };
            await setDoc(doc(db, "sprzatanie", `${miesiac}_${okres}`), { półki: aktualneDaneSprzatania }, { merge: true });
            zamknijModalPolki();
            zaladujSprzatanie();
        } catch (e) { alert("Błąd zapisu."); }
    };

    if (fileInput.files && fileInput.files.length > 0) {
        kompresujObraz(fileInput.files[0], (dataUrl) => {
            zapiszDoBazy(dataUrl);
        });
    } else { await zapiszDoBazy(null); }
}

window.usunPotwierdzeniePolki = async function() {
    if (!confirm("Zresetować tę półkę?")) return;
    const index = document.getElementById('modal-polka-index').value;
    const miesiac = document.getElementById('sprzatanie-miesiac').value;
    const okres = document.getElementById('sprzatanie-okres').value;
    aktualneDaneSprzatania[index] = { nazwa: DOMYSLNE_POLKI[index], czystosc: false, daty: false, planogram: false, komentarz: "", zdjecie: "", podpis: "-", dataSprawdzenia: new Date().toLocaleString() };
    await setDoc(doc(db, "sprzatanie", `${miesiac}_${okres}`), { półki: aktualneDaneSprzatania }, { merge: true });
    zamknijModalPolki();
    zaladujSprzatanie();
}

window.dodajPracownika = async function() {
    const imie = document.getElementById('new-p-imie').value.trim();
    const login = document.getElementById('new-p-login').value.trim();
    const haslo = document.getElementById('new-p-haslo').value;
    const rola = document.getElementById('new-p-rola').value;
    const umowa = document.getElementById('new-p-umowa').value;
    let etat = umowa === 'UoP' ? (document.getElementById('new-p-etat').value === 'inny' ? document.getElementById('new-p-etat-custom').value.trim() : document.getElementById('new-p-etat').value) : "-";

    if (!imie || !login || !haslo) return alert("Uzupełnij pola pracownika!");
    try {
        const cred = await createUserWithEmailAndPassword(auth, `${login}@sp580.pl`, haslo);
        await setDoc(doc(db, "uzytkownicy", cred.user.uid), { imie, login, rola, umowa, etat });
        alert(`Dodano pracownika: ${imie}`);
        ['new-p-imie', 'new-p-login', 'new-p-haslo'].forEach(id => document.getElementById(id).value = "");
        zaladujlistePracownikow();
    } catch (e) { alert("Błąd: " + e.message); }
}

async function zaladujlistePracownikow() {
    const container = document.getElementById('pracownicy-list-container');
    container.innerHTML = "Pobieranie listy...";
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let table = `<div class="table-responsive"><table class="standard-table"><tr><th>Imię i nazwisko</th><th>Login</th><th>Rola</th><th>Umowa / Etat</th><th>Akcje</th></tr>`;
        snap.forEach(d => {
            const p = d.data(), id = d.id;
            table += `<tr><td>${p.imie}</td><td>${p.login||'-'}</td><td>${p.rola}</td><td>${p.umowa} (${p.etat})</td><td><button onclick="pokazSzczegolyPracownika('${id}', '${p.imie}', '${p.login||''}', '${p.rola}', '${p.umowa}', '${p.etat}')" style="padding:4px 8px; font-size:0.8em; margin:0; background:#007bff;">Edytuj</button><button onclick="usunPracownika('${id}', '${p.imie}')" style="padding:4px 8px; font-size:0.8em; margin:0; background:#dc3545; margin-top:4px;">Usuń</button></td></tr>`;
        });
        container.innerHTML = table + `</table></div>`;
    } catch (e) { container.innerHTML = "Błąd."; }
}

window.pokazSzczegolyPracownika = function(id, imie, login, rola, umowa, etat) {
    document.getElementById('edit-p-id').value = id;
    document.getElementById('edit-p-uid').value = id;
    document.getElementById('edit-p-imie').value = imie;
    document.getElementById('edit-p-login').value = login;
    document.getElementById('edit-p-nowe-haslo').value = "";
    document.getElementById('edit-p-rola').value = rola;
    document.getElementById('edit-p-umowa').value = umowa;
    toggleEtatPole('edit');
    if (umowa === 'UoP') {
        const etatSelect = document.getElementById('edit-p-etat'), etatCustom = document.getElementById('edit-p-etat-custom');
        let found = Array.from(etatSelect.options).some(o => o.value === etat);
        if (found) { etatSelect.value = etat; etatCustom.classList.add('hidden'); }
        else { etatSelect.value = 'inny'; etatCustom.value = etat; etatCustom.classList.remove('hidden'); }
    }
    document.getElementById('modal-szczegoly-pracownika').classList.remove('hidden');
}
window.zamknijEdycjePracownika = () => document.getElementById('modal-szczegoly-pracownika').classList.add('hidden');

window.zapiszEdycjePracownika = async function() {
    const id = document.getElementById('edit-p-id').value;
    const imie = document.getElementById('edit-p-imie').value.trim();
    const login = document.getElementById('edit-p-login').value.trim();
    const noweHasloAdmin = document.getElementById('edit-p-nowe-haslo').value;
    const rola = document.getElementById('edit-p-rola').value;
    const umowa = document.getElementById('edit-p-umowa').value;
    let etat = umowa === 'UoP' ? (document.getElementById('edit-p-etat').value === 'inny' ? document.getElementById('edit-p-etat-custom').value.trim() : document.getElementById('edit-p-etat').value) : "-";

    if (!imie) return alert("Imię nie może być puste!");
    try {
        await setDoc(doc(db, "uzytkownicy", id), { imie, login, rola, umowa, etat }, { merge: true });
        
        if (noweHasloAdmin && noweHasloAdmin.trim().length > 0) {
            if (noweHasloAdmin.length < 6) return alert("Nowe hasło musi mieć co najmniej 6 znaków!");
            const currentUser = auth.currentUser;
            const targetEmail = `${login}@sp580.pl`;
            
            if (currentUser && currentUser.email === targetEmail) {
                await updatePassword(currentUser, noweHasloAdmin);
            } else {
                alert("⚠️ Informacja: Zmiana hasła dla innego konta wymaga ponownego zalogowania lub uprawnień Cloud Functions w Firebase. Dane profilu w bazie zostały zaktualizowane, ale aby zmienić hasło logowania tego konta bezpośrednio, zaloguj się na nie lub zaktualizuj je w konsoli Firebase Auth.");
            }
        }

        zamknijEdycjePracownika();
        zaladujlistePracownikow();
        alert("Zaktualizowano dane pracownika!");
    } catch (e) { alert("Błąd zapisu: " + e.message); }
}

window.usunPracownika = async function(id, imie) {
    if (confirm(`Usunąć pracownika: ${imie}?`)) {
        try { await deleteDoc(doc(db, "uzytkownicy", id)); zaladujlistePracownikow(); } catch (e) { alert("Błąd."); }
    }
}

window.zaladujGrafikObrazkowy = async function() {
    const wybranyMiesiac = document.getElementById('grafik-miesiac').value;
    const previewContainer = document.getElementById('grafik-preview-container');
    if (!wybranyMiesiac) return;
    previewContainer.innerHTML = "Pobieranie grafiku...";
    try {
        const docSnap = await getDoc(doc(db, "grafik_obrazy", wybranyMiesiac));
        if (docSnap.exists() && docSnap.data().zdjecie) {
            let imgSrc = docSnap.data().zdjecie;
            previewContainer.innerHTML = `<img src="${imgSrc}" onclick="otworzZoomZdjecia('${imgSrc}')" title="Kliknij, aby powiększyć">`;
        } else {
            previewContainer.innerHTML = `<p style="color: #6c757d;">Brak grafiku.</p>`;
        }
        zaladujProsby(wybranyMiesiac);
    } catch (e) { previewContainer.innerHTML = "Błąd."; }
}

window.zapiszGrafikObrazkowy = async function() {
    const wybranyMiesiac = document.getElementById('grafik-miesiac').value;
    const fileInput = document.getElementById('grafik-file-input');
    if (!wybranyMiesiac || fileInput.files.length === 0) return alert("Wybierz miesiąc i plik!");
    
    kompresujObraz(fileInput.files[0], async (dataUrl) => {
        try {
            await setDoc(doc(db, "grafik_obrazy", wybranyMiesiac), { zdjecie: dataUrl, zaktualizowal: currentUserData?.imie || "Kierownik" });
            fileInput.value = "";
            zaladujGrafikObrazkowy();
        } catch (e) { alert("Błąd zapisu grafiku."); }
    });
}

window.usunGrafikObrazkowy = async function() {
    if (confirm("Usunąć grafik?")) { await deleteDoc(doc(db, "grafik_obrazy", document.getElementById('grafik-miesiac').value)); zaladujGrafikObrazkowy(); }
}

window.wyslijProsbe = async function() {
    const wybranyMiesiac = document.getElementById('grafik-miesiac').value;
    const tekst = document.getElementById('nowa-prosba-tekst').value.trim();
    if (!wybranyMiesiac || !tekst) return alert("Uzupełnij miesiąc i treść prośby!");
    try {
        await addDoc(collection(db, "prosby_o_zmiany"), { miesiac: wybranyMiesiac, autor: currentUserData?.imie || "Pracownik", tekst, status: "oczekujace", data: new Date().toLocaleString() });
        document.getElementById('nowa-prosba-tekst').value = "";
        zaladujProsby(wybranyMiesiac);
    } catch (e) { alert("Błąd."); }
}

window.zmienStatusProsby = async function(id, status) {
    await setDoc(doc(db, "prosby_o_zmiany", id), { status }, { merge: true });
    zaladujProsby(document.getElementById('grafik-miesiac').value);
}

window.usunProsbe = async function(id) {
    if (confirm("Usunąć prośbę?")) { await deleteDoc(doc(db, "prosby_o_zmiany", id)); zaladujProsby(document.getElementById('grafik-miesiac').value); }
}

async function zaladujProsby(miesiac) {
    const listaContainer = document.getElementById('prośby-lista-container');
    listaContainer.innerHTML = "Pobieranie próśb...";
    try {
        const snap = await getDocs(collection(db, "prosby_o_zmiany"));
        let html = "", prosby = [];
        snap.forEach(d => { if (d.data().miesiac === miesiac) prosby.push({ id: d.id, ...d.data() }); });
        if (prosby.length === 0) { listaContainer.innerHTML = "<p style='font-size:0.9em; color:#6c757d;'>Brak próśb.</p>"; return; }

        prosby.reverse().forEach(p => {
            let badge = p.status === "zatwierdzone" ? `<span style="background:#28a745; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em;">👍 Zatwierdzone</span>` : (p.status === "odrzucone" ? `<span style="background:#dc3545; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em;">👎 Odrzucone</span>` : `<span style="background:#ffc107; color:black; padding:2px 6px; border-radius:4px; font-size:0.8em;">⏳ Oczekuje</span>`);
            let actions = (currentUserData?.rola === 'admin') ? `<div style="margin-top:6px; display:flex; gap:6px;"><button onclick="zmienStatusProsby('${p.id}', 'zatwierdzone')" style="background:#28a745; padding:4px; font-size:0.8em; width:auto;">👍 Zatwierdź</button><button onclick="zmienStatusProsby('${p.id}', 'odrzucone')" style="background:#dc3545; padding:4px; font-size:0.8em; width:auto;">👎 Odrzuć</button></div>` : "";
            let delBtn = (currentUserData?.rola === 'admin' || currentUserData?.imie === p.autor) ? `<button onclick="usunProsbe('${p.id}')" style="background:#6c757d; padding:4px; font-size:0.8em; margin-top:6px; width:auto;">🗑️ Usuń</button>` : "";

            html += `<div class="request-item"><div style="display:flex; justify-content:space-between;"><strong>👤 ${p.autor}</strong>${badge}</div><div style="font-size:0.8em; color:#6c757d;">(${p.data})</div><div>${p.tekst}</div>${actions}${delBtn}</div>`;
        });
        listaContainer.innerHTML = html;
    } catch (e) { listaContainer.innerHTML = "Błąd."; }
}

window.pokazWidokMiesieczny = function() {
    document.getElementById('view-monthly').classList.remove('hidden');
    document.getElementById('view-daily').classList.add('hidden');
    if(!document.getElementById('wybrany-miesiac').value) document.getElementById('wybrany-miesiac').value = new Date().toISOString().slice(0, 7);
    zaladujMiesiacTabela();
    if (currentUserData && currentUserData.rola === 'admin') {
        document.getElementById('admin-daily-section').classList.remove('hidden');
        pobierzRaportyDlaAdmina();
    }
}

window.przejdzDoDnia = function(ds) {
    window.location.hash = "#dzien";
    document.getElementById('view-monthly').classList.add('hidden');
    document.getElementById('view-daily').classList.remove('hidden');
    document.getElementById('raport-data').value = ds;
    sprawdzWczytajDaneDlaDaty();
}

window.zmienDateWFormularzu = () => sprawdzWczytajDaneDlaDaty();

async function pobierzPracownikowDoCheckboxow(zaznaczeni = []) {
    const container = document.getElementById('sprzedawcy-checkboxes-container');
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let html = "";
        snap.forEach(d => {
            let imie = d.data().imie;
            html += `<label style="display:flex; align-items:center; gap:8px; margin:4px 0; cursor:pointer;"><input type="checkbox" name="sprzedawca-chk" value="${imie}" ${zaznaczeni.includes(imie)?'checked':''} style="width:18px; height:18px;"> ${imie}</label>`;
        });
        container.innerHTML = html || "Brak pracowników.";
    } catch (e) { container.innerHTML = "Błąd."; }
}

async function sprawdzWczytajDaneDlaDaty() {
    const d = document.getElementById('raport-data').value;
    if (!d) return;
    const snap = await getDoc(doc(db, "sprzedaz", d));
    let wybrane = snap.exists() ? (snap.data().sprzedawcy || []) : [];
    if (snap.exists()) {
        document.getElementById('kawa-ilosc').value = snap.data().kawa?.ilosc || '';
        document.getElementById('kawa-wartosc').value = snap.data().kawa?.wartosc || '';
        document.getElementById('hd-ilosc').value = snap.data().hd?.ilosc || '';
        document.getElementById('hd-wartosc').value = snap.data().hd?.wartosc || '';
        document.getElementById('sklep-wartosc').value = snap.data().sklep?.wartosc || '';
    } else {
        ['kawa-ilosc', 'kawa-wartosc', 'hd-ilosc', 'hd-wartosc', 'sklep-wartosc'].forEach(id => document.getElementById(id).value = '');
    }
    await pobierzPracownikowDoCheckboxow(wybrane);
}

window.zaloguj = async function() {
    const login = document.getElementById('login-input').value.trim();
    const haslo = document.getElementById('password-input').value;
    const err = document.getElementById('error-msg');
    err.innerText = "";
    try {
        await signInWithEmailAndPassword(auth, `${login}@sp580.pl`, haslo);
    } catch (error) { err.innerText = "Błąd: Nieprawidłowy login lub hasło."; }
}

window.wyloguj = () => signOut(auth);

window.zapiszSprzedaz = async function() {
    const data = document.getElementById('raport-data').value;
    const sprzedawcy = Array.from(document.querySelectorAll('input[name="sprzedawca-chk"]:checked')).map(cb => cb.value);
    if (!data || sprzedawcy.length === 0) return alert("Wybierz datę i min. 1 sprzedawcę!");

    const btnZapisz = document.getElementById('btn-zapisz-raport');
    btnZapisz.disabled = true;
    btnZapisz.innerText = "Zapisywanie...";

    const docRef = doc(db, "sprzedaz", data);
    const docSnap = await getDoc(docRef);
    const imieAkt = currentUserData ? currentUserData.imie : "Użytkownik";
    const nowStr = new Date().toLocaleString();

    let dane = {
        data, sprzedawcy,
        kawa: { ilosc: Number(document.getElementById('kawa-ilosc').value)||0, wartosc: Number(document.getElementById('kawa-wartosc').value)||0 },
        hd: { ilosc: Number(document.getElementById('hd-ilosc').value)||0, wartosc: Number(document.getElementById('hd-wartosc').value)||0 },
        sklep: { wartosc: Number(document.getElementById('sklep-wartosc').value)||0 }
    };

    if (docSnap.exists()) {
        dane.utworzyl = docSnap.data().utworzyl;
        dane.dataUtworzenia = docSnap.data().dataUtworzenia || nowStr;
        dane.zmodyfikowal = imieAkt;
        dane.dataModyfikacji = nowStr;
    } else {
        dane.utworzyl = imieAkt;
        dane.dataUtworzenia = nowStr;
    }

    try {
        await setDoc(docRef, dane);
        btnZapisz.disabled = false;
        btnZapisz.innerText = "Zapisz / Aktualizuj Raport";
        
        document.getElementById('view-daily').classList.add('hidden');
        document.getElementById('view-monthly').classList.remove('hidden');
        history.replaceState(null, "", "#sprzedaz");
        zaladujMiesiacTabela();
        if (currentUserData && currentUserData.rola === 'admin') {
            pobierzRaportyDlaAdmina();
        }

        setTimeout(() => {
            alert("Zapisano pomyślnie!");
        }, 50);
    } catch (e) {
        alert("Błąd zapisu raportu: " + e.message);
        btnZapisz.disabled = false;
        btnZapisz.innerText = "Zapisz / Aktualizuj Raport";
    }
}

window.usunRaportSprzedazy = async function(dataId) {
    if (!confirm(`Czy na pewno chcesz usunąć raport sprzedaży z dnia ${dataId}?`)) return;
    try {
        await deleteDoc(doc(db, "sprzedaz", dataId));
        alert("Raport został usunięty z serwera.");
        pobierzRaportyDlaAdmina();
        zaladujMiesiacTabela();
    } catch (e) {
        alert("Błąd podczas usuwania raportu: " + e.message);
    }
}

async function pobierzRaportyDlaAdmina() {
    const listDiv = document.getElementById('reports-list');
    try {
        const snap = await getDocs(collection(db, "sprzedaz"));
        let html = "", raporty = [];
        snap.forEach(d => raporty.push(d.data()));
        
        raporty.sort((a, b) => {
            let tA = new Date(a.dataModyfikacji || a.dataUtworzenia || a.data).getTime();
            let tB = new Date(b.dataModyfikacji || b.dataUtworzenia || b.data).getTime();
            return tB - tA;
        });

        raporty.forEach(r => {
            let audit = `Utworzył: <strong>${r.utworzyl || 'Nieznany'}</strong> (${r.dataUtworzenia || ''})`;
            if (r.zmodyfikowal) audit += `<br>Korekta: ${r.zmodyfikowal} (${r.dataModyfikacji})`;
            
            let adminDeleteBtn = (currentUserData && currentUserData.rola === 'admin') ? `<button onclick="event.stopPropagation(); usunRaportSprzedazy('${r.data}')" style="background:#dc3545; padding:5px 10px; font-size:0.85em; margin-top:8px; width:auto; display:block;">🗑️ Usuń raport z serwera</button>` : "";

            html += `<div class="report-box" onclick="przejdzDoDnia('${r.data}')"><strong>📅 ${r.data}</strong> | Sprzedawcy: <strong>${r.sprzedawcy?.join(', ')}</strong><br>Kawa: ${r.kawa.ilosc} / ${r.kawa.wartosc} zł | HD: ${r.hd.ilosc} / ${r.hd.wartosc} zł | Sklep: ${r.sklep.wartosc} zł<div class="audit-info">${audit}</div>${adminDeleteBtn}</div>`;
        });
        listDiv.innerHTML = html || "Brak raportów.";
    } catch (e) { listDiv.innerHTML = "Błąd."; }
}

window.zapiszPlanyMiesieczne = async function() {
    if (!(currentUserData && currentUserData.rola === 'admin')) return alert("Brak uprawnień. Tylko administrator może zmieniać plany!");
    const m = document.getElementById('wybrany-miesiac').value;
    if (!m) return;
    await setDoc(doc(db, "plany_miesieczne", m), {
        kawa: Number(document.getElementById('input-plan-kawa').value)||0,
        hd: Number(document.getElementById('input-plan-hd').value)||0,
        sklep: Number(document.getElementById('input-plan-sklep').value)||0
    });
    alert("Zapisano plany!");
    zaladujMiesiacTabela();
}

window.zaladujMiesiacTabela = async function() {
    const container = document.getElementById('monthly-table-container');
    const plansContainer = document.getElementById('plans-container');
    const m = document.getElementById('wybrany-miesiac').value;
    if (!m) return;
    container.innerHTML = "Pobieranie...";

    try {
        const snap = await getDocs(collection(db, "sprzedaz"));
        let mapa = {};
        snap.forEach(d => { if (d.data().data?.startsWith(m)) mapa[d.data().data] = d.data(); });
        
        let plany = { kawa: 0, hd: 0, sklep: 0 };
        const pDoc = await getDoc(doc(db, "plany_miesieczne", m));
        if (pDoc.exists()) plany = pDoc.data();

        const [rok, mies] = m.split('-').map(Number);
        const dni = new Date(rok, mies, 0).getDate();
        let sKawaI = 0, sKawaW = 0, sHdI = 0, sHdW = 0, sSklepW = 0;
        let table = `<div class="table-responsive"><table class="month-table"><tr><th>Dzień</th><th>Sprzedawcy</th><th>Kawa (szt/zł)</th><th>HD (szt/zł)</th><th>Sklep (zł)</th></tr>`;

        for (let d = 1; d <= dni; d++) {
            let ds = String(d).padStart(2, '0'), pd = `${m}-${ds}`, r = mapa[pd];
            if (r) {
                sKawaI += Number(r.kawa?.ilosc)||0; sKawaW += Number(r.kawa?.wartosc)||0;
                sHdI += Number(r.hd?.ilosc)||0; sHdW += Number(r.hd?.wartosc)||0;
                sSklepW += Number(r.sklep?.wartosc)||0;
                table += `<tr class="cleaning-row" onclick="przejdzDoDnia('${pd}')"><td><strong>${ds}</strong></td><td>${r.sprzedawcy?.join(', ')}</td><td>${r.kawa?.ilosc}/${r.kawa?.wartosc}</td><td>${r.hd?.ilosc}/${r.hd?.wartosc}</td><td>${r.sklep?.wartosc}</td></tr>`;
            } else {
                table += `<tr class="cleaning-row" onclick="przejdzDoDnia('${pd}')" style="color:#999;"><td><strong>${ds}</strong></td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
            }
        }
        table += `<tr class="sum-row"><td colspan="2">SUMA</td><td>${sKawaI} / ${sKawaW.toFixed(2)}</td><td>${sHdI} / ${sHdW.toFixed(2)}</td><td>${sSklepW.toFixed(2)}</td></tr></table></div>`;
        container.innerHTML = table;

        const czyAdmin = currentUserData && currentUserData.rola === 'admin';
        const d68K = sKawaW - (plany.kawa*0.68), d68H = sHdW - (plany.hd*0.68), d68S = sSklepW - (plany.sklep*0.68);
        const d100K = sKawaW - plany.kawa, d100H = sHdW - plany.hd, d100S = sSklepW - plany.sklep;

        plansContainer.innerHTML = `
            <div class="table-responsive">
                <table class="standard-table" style="margin-top:5px;">
                    <tr><th>Wskaźnik</th><th>KAWA (zł)</th><th>HD (zł)</th><th>SKLEP (zł)</th></tr>
                    <tr><td><strong>Plan kwotowy</strong></td><td><input type="number" step="0.01" id="input-plan-kawa" value="${plany.kawa||''}" ${czyAdmin?'':'readonly'} style="margin:0; text-align:center;"></td><td><input type="number" step="0.01" id="input-plan-hd" value="${plany.hd||''}" ${czyAdmin?'':'readonly'} style="margin:0; text-align:center;"></td><td><input type="number" step="0.01" id="input-plan-sklep" value="${plany.sklep||''}" ${czyAdmin?'':'readonly'} style="margin:0; text-align:center;"></td></tr>
                    <tr><td><strong>Do 68%</strong></td><td class="${d68K>=0?'val-green':'val-red'}">${d68K.toFixed(2)} zł</td><td class="${d68H>=0?'val-green':'val-red'}">${d68H.toFixed(2)} zł</td><td class="${d68S>=0?'val-green':'val-red'}">${d68S.toFixed(2)} zł</td></tr>
                    <tr><td><strong>Do 100%</strong></td><td class="${d100K>=0?'val-green':'val-red'}">${d100K.toFixed(2)} zł</td><td class="${d100H>=0?'val-green':'val-red'}">${d100H.toFixed(2)} zł</td><td class="${d100S>=0?'val-green':'val-red'}">${d100S.toFixed(2)} zł</td></tr>
                </table>
            </div>${czyAdmin?'<button onclick="zapiszPlanyMiesieczne()" style="background:#28a745; margin-top:10px;">💾 Zapisz plany</button>':''}
        `;
    } catch (e) { container.innerHTML = "Błąd tabeli."; }
}

onAuthStateChanged(auth, async (user) => {
    const loginScr = document.getElementById('login-screen');
    const appScr = document.getElementById('app-screen');
    if (user) {
        loginScr.classList.add('hidden');
        appScr.classList.remove('hidden');
        window.location.hash = "#menu";
        try {
            const snap = await getDoc(doc(db, "uzytkownicy", user.uid));
            if (snap.exists()) {
                currentUserData = snap.data();
                document.getElementById('user-name').innerText = currentUserData.imie;
                let czyAdmin = currentUserData.rola === 'admin';
                document.getElementById('role-container').innerHTML = czyAdmin ? `<span class="admin-badge">PANEL KIEROWNIKA</span>` : `<p>Rola: Pracownik</p>`;
                
                document.querySelectorAll('.admin-only-tile').forEach(el => {
                    el.style.display = czyAdmin ? "flex" : "none";
                });

                sprawdzPowiadomieniaMisje(currentUserData.imie, czyAdmin);
            }
        } catch(e) { console.error(e); }
    } else {
        currentUserData = null;
        appScr.classList.add('hidden');
        loginScr.classList.remove('hidden');
        document.getElementById('login-input').value = "";
        document.getElementById('password-input').value = "";
        document.getElementById('error-msg').innerText = "";
    }
});
