'use strict';
// Podgląd i zoom zdjęć (mysz + dotyk).

/* ZOOM ZDJĘCIA */
let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0, lastTouchDistance = null;

window.otworzZoomZdjecia = function(src) {
    document.getElementById('zoom-image-element').src = src;
    scale = 1; pointX = 0; pointY = 0;
    updateImageTransform();
    document.getElementById('modal-zoom-zdjecia').classList.remove('hidden');
};

window.zamknijZoomZdjecia = () => document.getElementById('modal-zoom-zdjecia').classList.add('hidden');

function updateImageTransform() {
    document.getElementById('zoom-image-element').style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
}

const zoomContainer = document.getElementById('zoom-container');
zoomContainer.onmousedown = (e) => { e.preventDefault(); startX = e.clientX - pointX; startY = e.clientY - pointY; panning = true; };
zoomContainer.onmouseup = () => { panning = false; };
zoomContainer.onmousemove = (e) => {
    if (!panning) return;
    e.preventDefault();
    pointX = e.clientX - startX; pointY = e.clientY - startY;
    updateImageTransform();
};
zoomContainer.onwheel = (e) => {
    e.preventDefault();
    const xs = (e.clientX - pointX) / scale, ys = (e.clientY - pointY) / scale;
    scale = e.deltaY < 0 ? Math.min(scale * 1.15, 6) : Math.max(1, scale / 1.15);
    pointX = e.clientX - xs * scale; pointY = e.clientY - ys * scale;
    if (scale === 1) { pointX = 0; pointY = 0; }
    updateImageTransform();
};

zoomContainer.ontouchstart = (e) => {
    if (e.touches.length === 1) {
        panning = true;
        startX = e.touches[0].clientX - pointX;
        startY = e.touches[0].clientY - pointY;
        lastTouchDistance = null;
    } else if (e.touches.length === 2) {
        panning = false;
        lastTouchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
};
zoomContainer.ontouchend = () => {
    panning = false; lastTouchDistance = null;
    if (scale < 1) { scale = 1; pointX = 0; pointY = 0; updateImageTransform(); }
};
zoomContainer.ontouchmove = (e) => {
    e.preventDefault();
    if (panning && e.touches.length === 1) {
        pointX = e.touches[0].clientX - startX;
        pointY = e.touches[0].clientY - startY;
        updateImageTransform();
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
        let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.max(1, Math.min(scale * (currentDistance / lastTouchDistance), 5));
        lastTouchDistance = currentDistance;
        if (scale === 1) { pointX = 0; pointY = 0; }
        updateImageTransform();
    }
};
