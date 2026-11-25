// Ten plik jest bundlowany przez esbuild do js/vendor/capacitor-native.js.
// Dzięki temu zwykłe <script> w aplikacji mogą używać natywnych pluginów
// bez wprowadzania bundlera do całego projektu.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

window.NativeBridge = {
    Capacitor,
    App,
    Camera,
    CameraResultType,
    CameraSource,
    Filesystem,
    Directory,
    Share,
    NativeBiometric
};
