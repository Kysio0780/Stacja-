'use strict';
// Cloud Functions (v2) dla SklepApp: push FCM przy nowej wiadomości i nowej misji.
// Wdrożenie: firebase deploy --only functions  (wymagany plan Blaze)

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function tokenyUzytkownikow(ids) {
    const unikalne = [...new Set((ids || []).filter(Boolean).map(String))];
    const snapy = await Promise.all(unikalne.map(id => db.collection('uzytkownicy').doc(id).get()));
    return snapy
        .map(s => (s.exists ? s.data().fcmToken : null))
        .filter(t => typeof t === 'string' && t.length > 0);
}

async function wyslijPush(tokens, notification, data) {
    if (!tokens.length) { console.log('Brak tokenów FCM — pomijam wysyłkę.'); return; }
    try {
        const wynik = await admin.messaging().sendEachForMulticast({
            tokens,
            notification,
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        });
        console.log(`Wysłano ${wynik.successCount} pushy, nieudanych: ${wynik.failureCount}.`);
    } catch (err) {
        console.error('Błąd wysyłania FCM:', err);
    }
}

const skrot = (tekst) => {
    const t = String(tekst || '');
    return t.length > 90 ? t.slice(0, 87) + '...' : t;
};

exports.onNowaWiadomosc = onDocumentCreated('wiadomosci/{wiadomoscId}', async (event) => {
    const w = event.data ? event.data.data() : {};
    const odbiorcy = Array.isArray(w.odbiorcyIds) ? w.odbiorcyIds : [];
    const nadawca = String(w.nadawcaId || '');
    const adresaci = odbiorcy.filter(id => String(id) !== nadawca);
    const tokens = await tokenyUzytkownikow(adresaci);
    await wyslijPush(tokens, {
        title: w.wazne ? `⭐ Ważna wiadomość od ${w.nadawca || 'pracownika'}` : `Wiadomość od ${w.nadawca || 'pracownika'}`,
        body: skrot(w.tresc) || 'Nowa wiadomość w aplikacji.'
    }, { type: 'wiadomosc', id: event.params.wiadomoscId, view: '#wiadomosci' });
});

exports.onNowaMisja = onDocumentCreated('misje/{misjaId}', async (event) => {
    const m = event.data ? event.data.data() : {};
    const uid = String(m.pracownikId || '');
    if (!uid) return;
    const tokens = await tokenyUzytkownikow([uid]);
    await wyslijPush(tokens, {
        title: '🎯 Nowa misja',
        body: skrot(m.zadanie) || 'Masz nowe zadanie w aplikacji.'
    }, { type: 'misja', id: event.params.misjaId, view: '#misje' });
});
