'use strict';
// Moduł aparatu — wspólny podgląd kamery dla wszystkich miejsc dodawania zdjęć.
// Otwierający moduł przekazuje funkcję, która odbiera zrobiony plik (callback).

let strumienAparatu = null;
let odbiorcaZdjeciaAparatu = null;

function ustawPrzyciskiAparatu(etap) {
    const podglad = etap === 'podglad';
    const zrob = document.getElementById('aparat-btn-zrob');
    const zatwierdz = document.getElementById('aparat-btn-zatwierdz');
    const nowe = document.getElementById('aparat-btn-nowe');
    if (zrob) zrob.classList.toggle('hidden', podglad);
    if (zatwierdz) zatwierdz.classList.toggle('hidden', !podglad);
    if (nowe) nowe.classList.toggle('hidden', !podglad);
    if (!podglad && zrob) zrob.disabled = false;
}

function zatrzymajAparat() {
    if (strumienAparatu) {
        strumienAparatu.getTracks().forEach(track => track.stop());
        strumienAparatu = null;
    }
    const video = document.getElementById('aparat-video');
    if (video) video.srcObject = null;
}

window.zamknijAparat = function() {
    zatrzymajAparat();
    odbiorcaZdjeciaAparatu = null;
    const modal = document.getElementById('modal-aparat');
    if (modal) modal.classList.add('hidden');
};

// callback(plik) zostaje wywołany po naciśnięciu „Zatwierdź".
window.otworzAparat = async function(callback) {
    if (typeof callback !== 'function') { alert('Brak odbiorcy zdjęcia z aparatu.'); return; }

    // W APK używamy natywnego aparatu (systemowy podgląd i zatwierdzenie).
    if (window.NativeApp && typeof window.NativeApp.isNative === 'function' && window.NativeApp.isNative()) {
        try {
            const dataUrl = await window.NativeApp.takePicture();
            if (!dataUrl) return;
            const blob = await fetch(dataUrl).then(r => r.blob());
            callback(new File([blob], `aparat_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        } catch (e) {
            alert('Nie udało się zrobić zdjęcia: ' + e.message);
        }
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ta przeglądarka nie udostępnia aparatu. Użyj wyboru zdjęcia z pliku.');
        return;
    }

    odbiorcaZdjeciaAparatu = callback;

    const modal = document.getElementById('modal-aparat');
    const blad = document.getElementById('aparat-blad');
    const video = document.getElementById('aparat-video');
    const canvas = document.getElementById('aparat-canvas');

    blad.classList.add('hidden');
    blad.innerText = '';
    video.classList.remove('hidden');
    canvas.classList.add('hidden');
    ustawPrzyciskiAparatu('zdjecie');
    modal.classList.remove('hidden');

    try {
        zatrzymajAparat();
        strumienAparatu = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });
        video.srcObject = strumienAparatu;
        await video.play();
    } catch (e) {
        blad.innerText = 'Nie udało się uruchomić aparatu: ' + e.message +
            '. Sprawdź uprawnienia przeglądarki lub użyj wyboru zdjęcia z pliku.';
        blad.classList.remove('hidden');
        const zrob = document.getElementById('aparat-btn-zrob');
        if (zrob) zrob.disabled = true;
    }
};

window.zrobZdjecieAparatem = function() {
    const video = document.getElementById('aparat-video');
    if (!video || !video.videoWidth) return alert('Aparat jeszcze się nie uruchomił.');

    const canvas = document.getElementById('aparat-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    ustawPrzyciskiAparatu('podglad');
};

window.zrobNoweZdjecieAparatem = function() {
    const video = document.getElementById('aparat-video');
    const canvas = document.getElementById('aparat-canvas');
    canvas.classList.add('hidden');
    video.classList.remove('hidden');
    ustawPrzyciskiAparatu('zdjecie');
    if (video.srcObject) video.play().catch(() => { });
};

window.zatwierdzZdjecieAparatem = async function() {
    const canvas = document.getElementById('aparat-canvas');
    if (!canvas || !canvas.width) return alert('Najpierw zrób zdjęcie.');
    const odbiorca = odbiorcaZdjeciaAparatu;
    if (!odbiorca) return alert('Nie wiadomo, gdzie zapisać zdjęcie. Zamknij i spróbuj ponownie.');

    const przekaz = plik => {
        window.zamknijAparat();
        odbiorca(plik);
    };

    try {
        if (canvas.toBlob) {
            canvas.toBlob(blob => {
                if (!blob) { alert('Nie udało się utworzyć zdjęcia. Spróbuj ponownie.'); return; }
                przekaz(new File([blob], `aparat_${Date.now()}.jpg`, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
        } else {
            // Starsze przeglądarki — data URL zostanie zamieniony na plik przy zapisie.
            przekaz(canvas.toDataURL('image/jpeg', 0.92));
        }
    } catch (e) { alert('Błąd zapisu zdjęcia: ' + e.message); }
};

/* ===== Konkretne miejsca użycia aparatu ===== */

window.otworzAparatDlaPlanogramu = function() {
    window.otworzAparat(plik => window.zapiszZdjeciaWPlanogramie([plik]));
};

window.otworzAparatDlaWiadomosci = function() {
    // Wywołanie przechodzi przez normalną walidację formularza wiadomości.
    window.wyslijWiadomosc({ aparat: true });
};

window.otworzAparatDlaSprzatania = function() {
    // Wywołanie przechodzi przez normalne zapisywanie szczegółów półki.
    window.zapiszSzczegolyPolki({ aparat: true });
};
