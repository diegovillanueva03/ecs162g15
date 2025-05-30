"use strict";

/* SOURCES

    https://leafletjs.com/examples/quick-start/

 */

(function () {
    window.addEventListener("load", init);

    async function init() {

        let map = L.map('map', {
            center: [38.539, -121.753],
            zoom: 15
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

    }
})();

if (typeof module !== 'undefined') {
    module.exports = {
        // Functions to test here
    };
}
