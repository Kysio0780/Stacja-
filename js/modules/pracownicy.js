'use strict';
// Moduł Pracownicy: terminy badań/BHP, powiadomienia, formularz, lista, dodawanie/edycja/usuwanie.

/* ==================== TERMINY BADAŃ / BHP ==================== */
function getStanTerminu(dataStr) {
    if (!dataStr) return 'ok';
    const dzisiaj = new Date(); dzisiaj.setHours(0, 0, 0, 0);
    const dataWaznosci = new Date(dataStr); dataWaznosci.setHours(0, 0, 0, 0);
    if (dataWaznosci < dzisiaj) return 'expired';

    const zaMiesiac = new Date(); zaMiesiac.setHours(0, 0, 0, 0); zaMiesiac.setDate(zaMiesiac.getDate() + 30);
    return dataWaznosci <= zaMiesiac ? 'warning' : 'ok';
}

function formatujDateZIkona(dataStr) {
    if (!dataStr) return '-';
    const stan = getStanTerminu(dataStr);
    if (stan === 'expired') return `${dataStr} <span class="badge badge-danger" title="Ważność wygasła!">!</span>`;
    if (stan === 'warning') return `${dataStr} <span class="badge badge-pending" title="Wygasa w ciągu 30 dni!">!</span>`;
    return dataStr;
}

async function sprawdzPowiadomieniaPracownicyGlobal() {
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let jestProblem = false;
        snap.forEach(d => {
            const p = d.data();
            if (getStanTerminu(p.badania) !== 'ok' || getStanTerminu(p.sanepid) !== 'ok' || getStanTerminu(p.bhp) !== 'ok') jestProblem = true;
        });
        const badge = document.getElementById('pracownicy-badge');
        if (badge) badge.classList.toggle('hidden', !jestProblem);
    } catch (e) { console.error(e); }
}

/* ==================== MODUŁ WIADOMOŚCI ==================== */
window.toggleEtatPole = (prefix) => {
    const umowa = document.getElementById(`${prefix}-p-umowa`).value;
    document.getElementById(`${prefix}-etat-box`).style.display = (umowa === 'Zlecenie') ? 'none' : 'block';
};

window.checkEtatCustom = (prefix) => {
    const etatVal = document.getElementById(`${prefix}-p-etat`).value;
    document.getElementById(`${prefix}-p-etat-custom`).classList.toggle('hidden', etatVal !== 'inny');
};

/* ==================== ZARZĄDZANIE PRACOWNIKAMI ==================== */
window.zaladujlistePracownikow = async function() {
    const container = document.getElementById('pracownicy-list-container');
    container.innerHTML = "Pobieranie listy...";
    try {
        const snap = await getDocs(collection(db, "uzytkownicy"));
        let html = `<div class="table-responsive"><table class="standard-table"><tr><th style="text-align:left;">Pracownik</th><th>Umowa / Etat</th><th>🩺 Badania</th><th>🦠 Sanepid</th><th>🛡️ BHP</th></tr>`;
        snap.forEach(docSnap => {
            const p = docSnap.data(), id = docSnap.id;
            const umowaTxt = p.umowa === 'Zlecenie' ? 'Zlecenie' : `UoP (${p.etat || '1/1'})`;
            html += `<tr class="cleaning-row" onclick="window.otworzEdycjePracownika('${id}', '${p.uid||''}', '${p.imie}', '${p.login}', '${p.rola}', '${p.umowa||'UoP'}', '${p.etat||'1/1'}', '${p.badania||''}', '${p.sanepid||''}', '${p.bhp||''}')">
                <td style="text-align:left;"><strong>${p.imie}</strong><br><span class="text-muted" style="font-size:0.8em;">${p.login} (${p.rola === 'admin' ? 'Admin' : 'Pracownik'})</span></td>
                <td>${umowaTxt}</td>
                <td>${formatujDateZIkona(p.badania)}</td>
                <td>${formatujDateZIkona(p.sanepid)}</td>
                <td>${formatujDateZIkona(p.bhp)}</td>
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
        sprawdzPowiadomieniaPracownicyGlobal();
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.otworzEdycjePracownika = function(id, uid, imie, login, rola, umowa, etat, badania, sanepid, bhp) {
    document.getElementById('edit-p-id').value = id;
    document.getElementById('edit-p-uid').value = uid;
    document.getElementById('edit-p-imie').value = imie;
    document.getElementById('edit-p-login').value = login;
    document.getElementById('edit-p-nowe-haslo').value = "";
    document.getElementById('edit-p-rola').value = rola;
    document.getElementById('edit-p-umowa').value = umowa;
    
    const standardoweEtaty = ['1/1', '3/4', '1/2', '1/4'];
    const etatSelect = document.getElementById('edit-p-etat');
    const etatCustomInput = document.getElementById('edit-p-etat-custom');
    
    if (standardoweEtaty.includes(etat)) {
        etatSelect.value = etat; etatCustomInput.classList.add('hidden');
    } else {
        etatSelect.value = 'inny'; etatCustomInput.value = etat; etatCustomInput.classList.remove('hidden');
    }

    document.getElementById('edit-p-badania').value = badania;
    document.getElementById('edit-p-sanepid').value = sanepid;
    document.getElementById('edit-p-bhp').value = bhp;
    window.toggleEtatPole('edit');
    document.getElementById('modal-szczegoly-pracownika').classList.remove('hidden');
};

window.zamknijEdycjePracownika = () => document.getElementById('modal-szczegoly-pracownika').classList.add('hidden');

window.zapiszEdycjePracownika = async function() {
    const id = document.getElementById('edit-p-id').value;
    const umowa = document.getElementById('edit-p-umowa').value;
    const noweHasloAdmin = document.getElementById('edit-p-nowe-haslo').value.trim();

    if (noweHasloAdmin && noweHasloAdmin.length < 6) {
        return alert("Nowe hasło musi mieć minimum 6 znaków!");
    }

    let etat = '-';
    if (umowa === 'UoP') {
        const selEtat = document.getElementById('edit-p-etat').value;
        etat = (selEtat === 'inny') ? document.getElementById('edit-p-etat-custom').value.trim() : selEtat;
    }

    try {
        await setDoc(doc(db, "uzytkownicy", id), {
            imie: document.getElementById('edit-p-imie').value.trim(),
            login: document.getElementById('edit-p-login').value.trim().toLowerCase(),
            rola: document.getElementById('edit-p-rola').value,
            umowa, etat,
            badania: document.getElementById('edit-p-badania').value,
            sanepid: document.getElementById('edit-p-sanepid').value,
            bhp: document.getElementById('edit-p-bhp').value
        }, { merge: true });

        if (noweHasloAdmin) {
            const user = auth.currentUser;
            if (user && document.getElementById('edit-p-uid').value === user.uid) {
                await updatePassword(user, noweHasloAdmin);
                alert("Zaktualizowano profil oraz Twoje własne hasło!");
            } else {
                alert("Dane zaktualizowane.\n\nUwaga: Ze względów bezpieczeństwa Firebase, hasło innego pracownika można zresetować z poziomu konsoli Firebase lub pracownik może je zmienić samodzielnie po zalogowaniu.");
            }
        } else {
            alert("Zaktualizowano dane pracownika!");
        }

        window.zamknijEdycjePracownika();
        window.zaladujlistePracownikow();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.usunPracownikaZModala = async function() {
    const id = document.getElementById('edit-p-id').value;
    const imie = document.getElementById('edit-p-imie').value;
    if (confirm(`Czy na pewno chcesz trwale usunąć pracownika ${imie} z bazy danych?`)) {
        try {
            await deleteDoc(doc(db, "uzytkownicy", id));
            window.zamknijEdycjePracownika();
            window.zaladujlistePracownikow();
        } catch (e) { alert("Błąd usuwania."); }
    }
};

window.dodajPracownika = async function() {
    const imie = document.getElementById('new-p-imie').value.trim();
    const login = document.getElementById('new-p-login').value.trim().toLowerCase();
    const haslo = document.getElementById('new-p-haslo').value;
    const rola = document.getElementById('new-p-rola').value;
    const umowa = document.getElementById('new-p-umowa').value;
    const badania = document.getElementById('new-p-badania').value;
    const sanepid = document.getElementById('new-p-sanepid').value;
    const bhp = document.getElementById('new-p-bhp').value;

    let etat = '-';
    if (umowa === 'UoP') {
        const selEtat = document.getElementById('new-p-etat').value;
        etat = (selEtat === 'inny') ? document.getElementById('new-p-etat-custom').value.trim() : selEtat;
    }

    if (!imie || !login || !haslo) return alert("Wypełnij Imię, Login oraz Hasło!");

    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, `${login}@sp580.pl`, haslo);
        await setDoc(doc(db, "uzytkownicy", userCredential.user.uid), {
            uid: userCredential.user.uid, imie, login, rola, umowa, etat, badania, sanepid, bhp
        });
        await signOut(secondaryAuth);
        alert(`Dodano pracownika: ${imie}`);
        ['new-p-imie', 'new-p-login', 'new-p-haslo', 'new-p-badania', 'new-p-sanepid', 'new-p-bhp', 'new-p-etat-custom'].forEach(id => document.getElementById(id).value = "");
        window.zaladujlistePracownikow();
    } catch (error) { alert("Błąd dodawania pracownika: " + error.message); }
};
