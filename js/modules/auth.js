'use strict';
// Logowanie, wylogowanie i onAuthStateChanged (uruchamia aplikację — ładowany jako OSTATNI).

/* ==================== LOGOWANIE I AUTORYZACJA ==================== */
window.zaloguj = async function() {
    const login = document.getElementById('login-input').value.trim().toLowerCase();
    const pass = document.getElementById('password-input').value;
    document.getElementById('error-msg').innerText = "";
    if (!login || !pass) return;
    try {
        await signInWithEmailAndPassword(auth, `${login}@sp580.pl`, pass);
    } catch (error) { document.getElementById('error-msg').innerText = "Błąd: Niepoprawny login lub hasło."; }
};

window.wyloguj = () => { window.location.hash = ""; signOut(auth); };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        ustawBiezacaDateWNaglowku();
        const docSnap = await getDoc(doc(db, "uzytkownicy", user.uid));
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            const imieKrotkie = currentUserData.imie.split(' ')[0];
            document.getElementById('profile-btn-label').innerText = imieKrotkie;
            const czyAdmin = currentUserData.rola === 'admin';
            document.getElementById('admin-daily-section').classList.toggle('hidden', !czyAdmin);
            document.getElementById('tile-pracownicy').style.display = czyAdmin ? 'flex' : 'none';
            document.getElementById('tile-statystyki').style.display = czyAdmin ? 'flex' : 'none';
            
            sprawdzPowiadomieniaMisje(imieKrotkie, czyAdmin);
            sprawdzPowiadomieniaWiadomosci(currentUserData.imie);
            sprawdzPowiadomieniaPracownicyGlobal();
            sprawdzPowiadomieniaTpsGlobal();
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
    } else {
        currentUserData = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});
