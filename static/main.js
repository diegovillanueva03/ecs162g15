"use strict";

/* SOURCES

    https://leafletjs.com/examples/quick-start/
    https://www.w3schools.com/html/html5_geolocation.asp


 */



let cached_coords;
let map;
let location_dot;

async function loadCurrentCoordinates() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    resolve([position.coords.latitude, position.coords.longitude]);
                }, reject);
            } else {
                reject(new Error("Geolocation API is not supported by this browser."));
            }
        });
}

function initCurrentLocation() {
    loadCurrentCoordinates().then((coords) => {
        if(location_dot != null)
            map.removeLayer(location_dot);
        location_dot = L.circleMarker(coords, {
            interactive: false,
            color: '#ffffff',
            fillColor: '#3388ff',
            fillOpacity: 1.0,
        }).addTo(map);
        map.setView(coords, 20, {
            animate: true,
        });
    }).catch((error) => {
        console.log("Could not get location coordinates", error);
    });
}

(function () {
    window.addEventListener("load", init);

    async function init() {

        map = L.map('map', {
            center: [38.539, -121.753],
            zoom: 15
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        initCurrentLocation();


    }
})();

if (typeof module !== 'undefined') {
    module.exports = {
        // Functions to test here
    };
}
