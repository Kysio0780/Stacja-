// Ten plik jest bundlowany przez esbuild do js/vendor/capacitor-native.js.
// Dzięki temu zwykłe <script> w aplikacji mogą używać natywnych pluginów
// bez wprowadzania bundlera do całego projektu.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

window.NativeBridge = {
    Capacitor,
    LocalNotifications,
    PushNotifications,
    Camera,
    CameraResultType,
    CameraSource
};
