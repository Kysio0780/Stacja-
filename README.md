# System Obsługi Sklepu (SklepApp)

Aplikacja PWA do bieżącej obsługi sklepu: sprzedaż, grafik, obecności, raporty operacyjne,
planogramy, liczenia, misje i wiadomości wewnętrzne. Backendem jest **Firebase**
(Authentication + Cloud Firestore). Nie ma kroku budowania — pliki to zwykłe skrypty i arkusze stylów.

## Uruchamianie

- Otwórz `index.html` bezpośrednio (`file://`), z GitHub Pages albo w WebView/Capacitor.
- Konfiguracja Firebase jest w `js/config.js` (klucz webowy jest publiczny; dostęp chronią reguły Firestore).
- Importy Firebase są w jednym inline `<script type="module">` w `index.html`;
  `js/core/firebase.js` udostępnia je pod nazwami `db`, `auth`, `doc`, `getDoc`, `setDoc` itd.
- **Nie zamieniaj skryptów na zewnętrzne `type="module"`** — przeglądarki blokują je przy `file://`.
- PWA: `manifest.json` z `display: fullscreen`, ikony `icon-192.png` / `icon-512.png`
  oraz metatagi `apple-mobile-web-app-capable`. Po „Dodaj do ekranu głównego" aplikacja działa bez paska przeglądarki.
- Po zmianach w JS/CSS zrób **Ctrl+F5** (twarde odświeżenie), żeby nie wziąć starej wersji z cache.

## Struktura

```
index.html                  widoki, modale i lista <link>/<script> (kolejność ma znaczenie)
manifest.json               konfiguracja PWA
css/00..10-*.css            style w kolejności kaskady (10-responsive.css jako ostatni)
js/config.js                konfiguracja Firebase
js/core/firebase.js         eksport importów Firebase na zakres globalny
js/core/state.js            współdzielony stan (currentUserData, dane grafiku itd.)
js/core/utils.js            formatowanie dat, ucieczka HTML/JS, kompresja zdjęć
js/core/ui.js               modale, dropdown, obsługa Esc / prawego przycisku
js/core/zoom.js             podgląd i zoom zdjęć (osobna warstwa nad modalami)
js/core/router.js           routing po hashu (#menu, #grafik, #raporty, ...)
js/core/settings.js         motywy, rozmiar czcionki, tryb kiosku, hasło, preferencje per użytkownik
js/core/storage-stats.js    licznik rozmiaru zdjęć w Firestore (widoczny dla admina)
js/modules/*.js             jeden plik na moduł
js/modules/auth.js          logowanie — zawsze ładowany jako OSTATNI (uruchamia aplikację)
js/vendor/                  lokalne kopie jsPDF i html2canvas (generowanie PDF)
```

## Moduły i uprawnienia

| Moduł | Opis | Dostęp |
|---|---|---|
| Sprzedaż | Raporty dzienne, tabela miesięczna z celem dziennym (plan / dni miesiąca), plany i analizy | wszyscy (plany edytuje admin) |
| Raporty | Raport operacyjny: paliwa (stan OK / dostawa per paliwo, alert StockOut), liczniki, historia i statystyki | wszyscy (historia i progi paliw tylko admin) |
| Sprzątanie | Kontrola półek: czystość, daty, planogram, zdjęcie kontrolne | wszyscy |
| Planogramy | Zdjęcia półek z galerii lub aparatu, galeria i zoom | wszyscy (dodawanie tylko admin) |
| TPSy | Terminy przydatności towarów | wszyscy |
| Liczenie | Kategorie towarowe, liczenia z plusami/minusami, historia i sumy | wszyscy (kategorie i wyniki edytuje admin) |
| Premia | Kalkulator premii, puule i warunki | wszyscy (konfiguracja tylko admin) |
| Grafik | Tabela grafiku, potwierdzanie obecności, podgląd i wydruk PDF listy obecności | wszyscy (edycja tylko admin) |
| Wiadomości | Wewnętrzna poczta z załącznikami i aparatem | wszyscy |
| Misje | Zadania dla pracowników (można przypisać wielu naraz) | wszyscy (tworzenie tylko admin) |
| Pracownicy, Statystyki, Finanse | Zarządzanie pracownikami, raporty statystyczne i czyszczenie danych | tylko admin |

## Zasady kodu

1. Kolejność `<script defer>` i `<link>` w `index.html` ma znaczenie — nowy plik dodawaj przed `auth.js`, CSS `10-responsive.css` zawsze ostatni.
2. Pliki JS współdzielą zakres globalny; funkcje wołane z HTML (`onclick="..."`) są przypisywane na `window`.
3. Nowe moduły ładują dane z Firestore bezpośrednio; zapisy zdjęć przechodzą przez `kompresujObraz()` z `utils.js`
   (max 1500 px, JPEG 0.80, limit ~495 kB na string base64 — dokument Firestore ma limit 1 MiB).
4. Aparat (`js/modules/aparat.js`) jest współdzielony przez planogramy, wiadomości i sprzątanie — przyjmuje callback z plikiem.
5. Preferencje (motyw, rozmiar i krój czcionki) są zapisywane per użytkownik w `preferencje_uzytkownika/{uid}`;
   `localStorage` służy tylko jako wygląd przed zalogowaniem. Dostępne kroje: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins.
   Tryb kiosku jest ustawieniem urządzenia (domyślnie włączony).
6. Raporty operacyjne zapisują się w dwóch osobnych dokumentach: `raporty_paliwa/{YYYY-MM-DD}` i
   `raporty_liczniki/{YYYY-MM-DD}`; stare `raporty_operacyjne` są czytane tylko dla zgodności wstecznej.
   Progi paliw: `system_ustawienia/raporty_paliwa_min`.

## Reguły Firestore — czego wymaga aplikacja

- odczyt/zapis własnych dokumentów użytkownika (`preferencje_uzytkownika`, `uzytkownicy`),
- odczyt/zapis `raporty_paliwa` i `raporty_liczniki` (także przez pracowników),
- odczyt `grafiki`, `sprzedaz`, `potwierdzenia_obecnosci`, `misje` oraz **`raporty_operacyjne`** (statystyki liczą się w przeglądarce),
- zapis `preferencje_uzytkownika`, `potwierdzenia_obecnosci`, `raporty_operacyjne`, `zdjecia` w kolekcjach modułów,
- zapis `system_ustawienia` (kategorie liczeń, progi paliw) wyłącznie dla admina.

Bez odpowiednich reguł zapytania listujące (`getDocs`) zostaną odrzucone — moduł pokaże wtedy błąd ładowania.

## Aplikacja Android (APK)

Projekt jest opakowany w **Capacitor** — dzięki temu działa jako osobna aplikacja z własną ikoną
i bez paska przeglądarki (wnętrze to systemowy WebView, nie przeglądarka internetowa).

- `capacitor.config.json` — identyfikator `pl.sklepapp.stacja`, `webDir: www`,
- `scripts/prepare-web.js` — kopiuje `index.html`, `css/`, `js/`, ikony do `www/` i buduje
  `js/vendor/capacitor-native.js` (bundle pluginów, żeby nie wprowadzać bundlera do całej aplikacji),
- `js/native-entry.js` — importy pluginów `@capacitor/core`, `app`, `camera`, `filesystem`, `share`,
- `js/core/native.js` — nakładka działająca tylko w APK: natywny aparat, zapis/udostępnianie PDF
  oraz zamykanie aplikacji przyciskiem ✕ w nagłówku,
- `assets/icon.png` i `assets/splash.png` — źródła natywnej ikony i ekranu startowego (1024×1024 i 2732×2732,
  przygotowane z `icon-512.png`). Pliki `icon-192.png` / `icon-512.png` w katalogu głównym są tylko dla PWA —
  system Android ich nie używa. W workflow je generuje `@capacitor/assets` do `android/app/src/main/res/`.
- `.github/workflows/build-apk.yml` — buduje APK w chmurze po każdym pushu na `main` albo ręcznie
  (zakładka Actions → „Build Android APK" → „Run workflow"). Gotowy plik jest w artefakcie
  `sklep-app-debug-apk`.

### Podpisany APK release (zalecane)

Ważne: build z sekretami podpisu daje `sklep-app-release-apk` i **stabilny podpis** — kolejne wersje można
instalować jedna na drugą bez odinstalowywania. Bez sekretów workflow buduje `sklep-app-debug-apk`
(klucz zmienia się przy każdym buildzie, więc aktualizacja kończy się błędem „Aplikacja nie została zainstalowana").

Jak przygotować sekrety (jednorazowo):

1. Uruchom ręcznie workflow **„Generate Signing Keystore"** (Actions → Generate Signing Keystore → Run workflow).
2. Skopiuj z logów cztery wartości i dodaj je jako sekrety repozytorium:
   - `SIGNING_KEYSTORE_BASE64`
   - `SIGNING_STORE_PASSWORD`
   - `SIGNING_KEY_PASSWORD`
   - `SIGNING_KEY_ALIAS` = `sklepapp`
3. Plik `release.keystore` jest też w artefakcie tego workflow — **zapisz go w bezpiecznym miejscu**.
   Jeśli go zgubisz, nie zaktualizujesz już aplikacji pod tym samym podpisem.
4. Uruchom „Build Android APK" — artefakt będzie nazwany `sklep-app-release-apk`.

### Pierwszy build

1. W Firebase Console pobierz `google-services.json` dla aplikacji Android o pakiecie
   `pl.sklepapp.stacja` (Project settings → Your apps → Add app → Android).
2. Dodaj jego **zawartość** jako sekret repozytorium o nazwie `GOOGLE_SERVICES_JSON`
   (Settings → Secrets and variables → Actions → New repository secret).
3. Uruchom workflow. Jeśli sekretu nie ma, build się uda z placeholderem, ale push nie zadziała.

Lokalnie (wymagany Node 24 + Android Studio / JDK 17):

```
npm install
npm run prepare:web
npx cap add android
cp google-services.placeholder.json android/app/google-services.json   # lub prawdziwy plik
npx cap sync android
npm run build:apk
```

⚠️ Do poprawnego działania pushów potrzebny jest prawdziwy `google-services.json` — zastępczy plik
pozwala tylko zbudować APK.

## Kopie zapasowe

Przed każdym wgraniem na GitHub tworzony jest snapshot zdalnej gałęzi `main` w
`D:\OpenCode backup\Stacja-<data>\` i weryfikowany po hashach blobów Git.
