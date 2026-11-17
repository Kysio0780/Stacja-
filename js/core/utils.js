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
