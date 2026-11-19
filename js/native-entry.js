// Ten plik jest bundlowany przez esbuild do js/vendor/capacitor-native.js.
// Dzięki temu zwykłe <script> w aplikacji mogą używać natywnych pluginów
// bez wprowadzania bundlera do całego projektu.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

window.NativeBridge = {
    Capacitor,
    App,
    LocalNotifications,
    PushNotifications,
    Camera,
    Filesystem,
    Directory,
    Share,
    CameraResultType,
    CameraSource
};
