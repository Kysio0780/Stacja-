# System Obsługi Sklepu – struktura projektu

Aplikacja nie ma kroku budowania. Pliki są zwykłymi skryptami i arkuszami stylów.
Wygląd i działanie są takie same jak w pojedynczym `index.html`.

```
index.html          szkielet HTML (widoki, modale) + lista <link>/<script>
manifest.json       (dodaj własny plik – index.html się do niego odwołuje)
css/                style, numerowane w kolejności kaskady
js/config.js        konfiguracja Firebase
js/core/            firebase, state, utils, ui, zoom, settings, router
js/modules/         jeden plik na moduł aplikacji (grafik, premia, tps, ...)
js/modules/auth.js  logowanie – ładowany jako OSTATNI (uruchamia aplikację)
```

## Zasady
1. Kolejność `<script defer>` w `index.html` ma znaczenie. Nowy plik dodawaj przed `auth.js`.
2. Kolejność `<link>` w CSS też ma znaczenie (`10-responsive.css` zawsze ostatni).
3. Wszystkie pliki JS współdzielą zakres globalny, tak jak dawny jeden skrypt. Funkcje wołane z HTML
   (`onclick="..."`) nadal są przypisane jako `window.nazwa = ...`.
4. Współdzielony stan (`currentUserData`, `listaTowarowTps` itd.) jest w `js/core/state.js`.
5. Importy Firebase są w jednym miejscu: inline `<script type="module">` w `index.html`.
   `js/core/firebase.js` udostępnia je pod dawnymi nazwami (`doc`, `getDoc`, `db`, `auth`...).

## Uwaga o uruchamianiu
Aplikacja działa po otwarciu `index.html` bezpośrednio (file://), z GitHub Pages i w WebView/Capacitor.
Nie zamieniaj skryptów na `type="module"` z zewnętrznymi plikami. Przeglądarki blokują je przy file://.
