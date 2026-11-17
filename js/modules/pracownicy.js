'use strict';
// Moduł Pracownicy: terminy badań/BHP, powiadomienia, formularz, lista, dodawanie/edycja/usuwanie.

/* ==================== TERMINY BADAŃ / BHP ==================== */
function parsujDateBezStrefy(dataStr) {
    const d = pobierzDateDoObiektu(dataStr);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getStanTerminu(dataStr) {
    if (!dataStr) return 'ok';
    const dzisiaj = new Date(); dzisiaj.setHours(0, 0, 0, 0);
    const dataWaznosci = parsujDateBezStrefy(dataStr);
    if (!dataWaznosci) return 'ok';
    if (dataWaznosci < dzisiaj) return 'expired';

    const zaMiesiac = new Date(); zaMiesiac.setHours(0, 0, 0, 0); zaMiesiac.setDate(zaMiesiac.getDate() + 30);
    return dataWaznosci <= zaMiesiac ? 'warning' : 'ok';
}

async function czyLoginZajety(login, idPomin = null) {
    try {
        const q = query(collection(db, "uzytkownicy"), where("login", "==", login), limit(5));
        const snap = await getDocs(q);
        return snap.docs.some(d => d.id !== idPomin);
    } catch (e) {
        console.warn("Nie udało się sprawdzić unikalności loginu:", e);
        return false;
    }
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
            html += `<tr class="cleaning-row" onclick="window.otworzEdycjePracownikaPoId('${ucieczkaJs(id)}')">
                <td style="text-align:left;"><strong>${ucieczkaHtml(p.imie || 'Brak imienia')}</strong><br><span class="text-muted" style="font-size:0.8em;">${ucieczkaHtml(p.login || 'brak loginu')} (${p.rola === 'admin' ? 'Admin' : 'Pracownik'})</span></td>
                <td>${ucieczkaHtml(umowaTxt)}</td>
                <td>${formatujDateZIkona(p.badania)}</td>
                <td>${formatujDateZIkona(p.sanepid)}</td>
                <td>${formatujDateZIkona(p.bhp)}</td>
            </tr>`;
        });
        container.innerHTML = html + `</table></div>`;
        sprawdzPowiadomieniaPracownicyGlobal();
    } catch (e) { container.innerHTML = "Błąd ładowania."; }
};

window.otworzEdycjePracownikaPoId = async function(id) {
    try {
        const snap = await getDoc(doc(db, "uzytkownicy", id));
        if (!snap.exists()) return alert("Nie znaleziono pracownika.");
        const p = snap.data();
        window.otworzEdycjePracownika(
            id, p.uid || id, p.imie || '', p.login || '', p.rola || 'pracownik',
            p.umowa || 'UoP', p.etat || '1/1', p.badania || '', p.sanepid || '', p.bhp || ''
        );
    } catch (e) { alert("Błąd pobierania danych pracownika: " + e.message); }
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
    const uid = document.getElementById('edit-p-uid').value || id;
    const imie = document.getElementById('edit-p-imie').value.trim();
    const login = document.getElementById('edit-p-login').value.trim().toLowerCase();
    const umowa = document.getElementById('edit-p-umowa').value;
    const noweHasloAdmin = document.getElementById('edit-p-nowe-haslo').value.trim();

    if (!imie || !login) return alert("Imię i login są wymagane!");
    if (!/^[a-z0-9._-]+$/.test(login)) return alert("Login może zawierać tylko małe litery, cyfry, kropkę, myślnik i podkreślenie.");
    if (noweHasloAdmin && noweHasloAdmin.length < 6) {
        return alert("Nowe hasło musi mieć minimum 6 znaków!");
    }
    if (await czyLoginZajety(login, id)) {
        return alert("Ten login jest już zajęty przez innego pracownika!");
    }

    let etat = '-';
    if (umowa === 'UoP') {
        const selEtat = document.getElementById('edit-p-etat').value;
        etat = (selEtat === 'inny') ? document.getElementById('edit-p-etat-custom').value.trim() : selEtat;
    }

    try {
        const istniejacy = await getDoc(doc(db, "uzytkownicy", id));
        const poprzednie = istniejacy.exists() ? istniejacy.data() : {};
        const authEmail = poprzednie.authEmail || `${poprzednie.login || login}@sp580.pl`;

        const dane = {
            uid,
            authEmail,
            imie,
            login,
            rola: document.getElementById('edit-p-rola').value,
            umowa, etat,
            badania: document.getElementById('edit-p-badania').value,
            sanepid: document.getElementById('edit-p-sanepid').value,
            bhp: document.getElementById('edit-p-bhp').value
        };

        await setDoc(doc(db, "uzytkownicy", id), dane, { merge: true });

        const user = auth.currentUser;
        if (noweHasloAdmin) {
            if (user && uid === user.uid) {
                await updatePassword(user, noweHasloAdmin);
                alert("Zaktualizowano profil oraz Twoje własne hasło!");
            } else {
                alert("Dane zaktualizowane.\n\nUwaga: Ze względów bezpieczeństwa Firebase, hasło innego pracownika można zresetować z poziomu konsoli Firebase lub pracownik może je zmienić samodzielnie po zalogowaniu.");
            }
        } else {
            alert("Zaktualizowano dane pracownika!");
        }

        if (user && uid === user.uid) {
            currentUserData = { ...(currentUserData || {}), ...dane };
            document.getElementById('profile-btn-label').innerText = pobierzImieKrotkie(imie);
        }

        window.zamknijEdycjePracownika();
        window.zaladujlistePracownikow();
    } catch (e) { alert("Błąd zapisu: " + e.message); }
};

window.usunPracownikaZModala = async function() {
    const id = document.getElementById('edit-p-id').value;
    const uid = document.getElementById('edit-p-uid').value || id;
    const imie = document.getElementById('edit-p-imie').value;
    if (confirm(`Czy na pewno chcesz trwale usunąć profil pracownika ${imie}? Historyczne raporty i wiadomości pozostaną w bazie.`)) {
        try {
            await deleteDoc(doc(db, "uzytkownicy", id));
            const user = auth.currentUser;
            if (user && uid === user.uid) {
                try { await deleteUser(user); } catch (e) { console.warn("Nie udało się usunąć konta Auth:", e); }
                await signOut(auth);
            }
            window.zamknijEdycjePracownika();
            window.zaladujlistePracownikow();
        } catch (e) { alert("Błąd usuwania: " + e.message); }
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
    if (!/^[a-z0-9._-]+$/.test(login)) return alert("Login może zawierać tylko małe litery, cyfry, kropkę, myślnik i podkreślenie.");
    if (haslo.length < 6) return alert("Hasło musi mieć minimum 6 znaków!");
    if (await czyLoginZajety(login)) return alert("Ten login jest już zajęty!");

    // Unikalna nazwa aplikacji pomocniczej — dzięki temu kolejne dodawanie pracowników nie kończy się błędem.
    const nazwaAplikacji = `Secondary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const secondaryApp = initializeApp(firebaseConfig, nazwaAplikacji);
    const secondaryAuth = getAuth(secondaryApp);
    let utworzonyUzytkownik = null;
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, `${login}@sp580.pl`, haslo);
        utworzonyUzytkownik = userCredential.user;
        await setDoc(doc(db, "uzytkownicy", utworzonyUzytkownik.uid), {
            uid: utworzonyUzytkownik.uid,
            authEmail: `${login}@sp580.pl`,
            imie, login, rola, umowa, etat, badania, sanepid, bhp
        });
        alert(`Dodano pracownika: ${imie}`);
        ['new-p-imie', 'new-p-login', 'new-p-haslo', 'new-p-badania', 'new-p-sanepid', 'new-p-bhp', 'new-p-etat-custom'].forEach(id => document.getElementById(id).value = "");
        window.zaladujlistePracownikow();
    } catch (error) {
        // Cofamy utworzone konto Auth, jeśli zapis profilu w Firestore się nie udał.
        if (utworzonyUzytkownik) {
            try { await deleteUser(utworzonyUzytkownik); } catch (e) { console.warn("Nie udało się wycofać konta Auth:", e); }
        }
        alert("Błąd dodawania pracownika: " + error.message);
    } finally {
        try { await signOut(secondaryAuth); } catch (e) { /* ignore */ }
        try { await deleteApp(secondaryApp); } catch (e) { console.warn("Nie udało się zwolnić aplikacji pomocniczej:", e); }
    }
};
