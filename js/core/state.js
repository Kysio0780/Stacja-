'use strict';
// Współdzielony stan aplikacji i stałe (zmienne globalne używane przez wiele modułów).

let currentUserData = null;
let aktualneDaneSprzatania = {};
let aktualnyTabWiadomosci = "wszystkie";
let aktualniePodgladanaWiadomosc = null;
let listaTowarowTps = [];

const DOMYSLNE_POLKI = [
    "Akcesoria", "Alkohol", "Chemia", "Kasa 1: 5 półek", "Kasa 1: 9 półek", 
    "Kasa 2: 5 półek", "Kasa 2: 9 półek", "Kawy / Sosy", "Lodówka mała", 
    "Lodówka Napoje", "Lodówka Piwo", "Oleje", "Piwo", "Soki i Woda", "Strefa zakasowa"
];
