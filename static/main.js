"use strict";

/* SOURCES

    https://leafletjs.com/examples/quick-start/
    https://www.w3schools.com/html/html5_geolocation.asp


 */

const SILO_COORDS = [38.539, -121.753];
const BASE_ZOOM = 15;
const ENHANCED_ZOOM = 19;

let cached_coords;
let map;
let location_dot;
let restroom_markers = [];

function initMap(origin, zoom) {
    if(map == null) {
        map = L.map('map', {
            center: origin,
            zoom: zoom
        });
    } else {
        map.setView(origin, zoom, {
            animate: true,
        });
    }

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: ENHANCED_ZOOM,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}

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
        map.setView(coords, ENHANCED_ZOOM, {
            animate: true,
        });
    }).catch((error) => {
        console.log("Could not get location coordinates", error);
    });
}

function addRestroomMarker(coords) {
    for(let m of restroom_markers) {
        let latLng = m.getLatLng();
        if(latLng.equals(coords))
            return null;
    }

    let marker = L.marker(coords, {
        riseOnHover: true,

    }).bindPopup('<header>Restroom Marker Example</header><p>Rating: 0/5<br/>Reviews:</p>',
        {});
    restroom_markers.push(marker);
    marker.addTo(map);
    return marker;
}

(function () {
    window.addEventListener("load", init);

    async function init() {

        //Initialize Map to Default of Silo Coordinates with base zoom
        initMap(SILO_COORDS, BASE_ZOOM);

        //Set center to current location if available and zoom.
        //Also marks current location with an Apple Maps-like circle
        initCurrentLocation();

        map.on('dblclick', function(e) {
            addRestroomMarker(e.latlng);
            console.log(e.latlng);
        });

            //open sidebar
            const connected = document.getElementById("sidebar-tester");
            if(connected){
                connected.style.display = "inline";
                connected.addEventListener("click", () => {
                    document.getElementById("account-sidebar").classList.add("show");
                    document.getElementById("user-email").textContent = `${user.email}`;
            })};

            //close sidebar
            document.getElementById("close-sidebar").addEventListener("click", () => {
            document.getElementById("account-sidebar").classList.remove("show");
        });

    }
})();

if (typeof module !== 'undefined') {
    module.exports = {
        // Functions to test here
    };
}
