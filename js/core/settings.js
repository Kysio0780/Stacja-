'use strict';
// Motywy, rozmiar czcionki, zmiana własnego hasła.

/* MOTYWY I CZCIONKA */
window.zmienMotyw = (tryb) => { localStorage.setItem("sklep_motyw", tryb); zastosujMotyw(tryb); };
function zastosujMotyw(tryb) {
    if (tryb && tryb !== "light") document.documentElement.setAttribute("data-theme", tryb);
    else document.documentElement.removeAttribute("data-theme");
    const selectDD = document.getElementById('wybor-motywu-dd');
    if (selectDD) selectDD.value = tryb || "light";
}

window.zmienCzcionke = (rozmiar) => { localStorage.setItem("sklep_czcionka", rozmiar); zastosujCzcionke(rozmiar); };
function zastosujCzcionke(rozmiar) {
    if (rozmiar && rozmiar !== "normal") document.documentElement.setAttribute("data-fontsize", rozmiar);
    else document.documentElement.removeAttribute("data-fontsize");
    const selectDD = document.getElementById('wybor-czcionki-dd');
    if (selectDD) selectDD.value = rozmiar || "normal";
}

zastosujMotyw(localStorage.getItem("sklep_motyw") || "light");
zastosujCzcionke(localStorage.getItem("sklep_czcionka") || "normal");

/* ZMIANA HASŁA */
window.otworzModalZmianyHasla = () => {
    ['stare-haslo', 'nowe-haslo-1', 'nowe-haslo-2'].forEach(id => document.getElementById(id).value = "");
    document.getElementById('haslo-msg').innerText = "";
    document.getElementById('modal-zmien-haslo').classList.remove('hidden');
};
window.zamknijModalZmianyHasla = () => document.getElementById('modal-zmien-haslo').classList.add('hidden');

window.zmienWlasneHasloPotwierdz = async function() {
    const stareHaslo = document.getElementById('stare-haslo').value;
    const h1 = document.getElementById('nowe-haslo-1').value;
    const h2 = document.getElementById('nowe-haslo-2').value;
    const msg = document.getElementById('haslo-msg');
    msg.style.color = "var(--danger)"; msg.innerText = "";

    if (!stareHaslo || !h1 || !h2) { msg.innerText = "Wypełnij wszystkie pola!"; return; }
    if (h1 !== h2) { msg.innerText = "Hasła się nie zgadzają!"; return; }
    if (h1.length < 6) { msg.innerText = "Nowe hasło musi mieć min. 6 znaków!"; return; }

    const user = auth.currentUser;
    if (!user) return;

    try {
        const credential = EmailAuthProvider.credential(user.email, stareHaslo);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, h1);
        msg.style.color = "var(--success)";
        msg.innerText = "Hasło zostało pomyślnie zmienione!";
        setTimeout(window.zamknijModalZmianyHasla, 1400);
    } catch (error) {
        msg.innerText = (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')
            ? "Błąd: Podano niepoprawne aktualne hasło." : "Błąd: " + error.message;
    }
};
