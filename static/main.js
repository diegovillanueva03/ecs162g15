"use strict";

/* SOURCES

    https://leafletjs.com/examples/quick-start/
    https://www.w3schools.com/html/html5_geolocation.asp
    https://wiki.openstreetmap.org/wiki/Overpass_API


 */

const SILO_COORDS = [38.539, -121.753];
const BASE_ZOOM = 15;
const ENHANCED_ZOOM = 19;

let cached_coords;
let map;
let location_dot;
let restroom_markers = [];

function initMap(origin, zoom) {
    if (map == null) {
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
        if (location_dot != null)
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

function addRestroomMarker(loc, isNew = false) {
    const coords = [loc.lat, loc.lng]
    for (let m of restroom_markers) {
        let latLng = m.getLatLng();
        if (latLng.equals(coords))
            return null;
    }

    let marker = L.marker(coords, {
        riseOnHover: true,
    }).addTo(map);

    restroom_markers.push(marker);

    const { lat, lng } = coords;

    marker.bindPopup('<header>Loading building name...</header>').openPopup();

    //open sidebar when marker is clicked
    const sidebar = document.getElementById("account-sidebar");
    if (sidebar && !sidebar.classList.contains("show")) {
        sidebar.classList.add("show");
    }

    marker.on('popupopen', () => {
        if (sidebar && !sidebar.classList.contains("show")) {
            sidebar.classList.add("show");
        }

        fetch(`/restroom/${loc._id}/sidebar`)
            .then(res => res.text())
            .then(html => {
                document.getElementById("account-sidebar").innerHTML = html;
            })
            .catch(err => {
                console.error("Failed to load sidebar:", err);
                document.getElementById("account-sidebar").innerHTML = "<p>Error loading info.</p>";
            });
    });

    //close sidebar when popup is closed
    marker.on('popupclose', () => {
        document.getElementById("account-sidebar").classList.remove("show");
    });

    fetch('/get-building-name', {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ lat, lng })
    })
        .then(res => res.json())
        .then(data => {
            let popupText = '';
            if (data.elements && data.elements.length > 0) {
                let closestElement = null;
                let closestDistance = Infinity;
                //loop through response
                for (const obj of data.elements) {
                    const objLat = obj.center?.lat;
                    const objLng = obj.center?.lon;
                    if (objLat == null || objLng == null) continue;

                    //distance formula to get closest building using its center (not exact)
                    const dist = ((objLat - lat) ** 2 + (objLng - lng) ** 2) ** (1 / 2);

                    if (dist < closestDistance) {
                        closestDistance = dist;
                        closestElement = obj;
                    }
                }
                //get building/place name
                const name = closestElement?.tags?.name
                    || closestElement?.tags?.place;

                popupText = `<header>${name}</header>
                         <p>Rating: 0/5<br/>Reviews:</p>`;
            } else {
                popupText = `<header>No name found</header>`;
            }
            marker.setPopupContent(popupText);
        })
        .catch(error => {
            console.log("Error retrieving location:", error);
            marker.setPopupContent(`<header>Error retrieving location</header>`);
        });

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

        fetch('/restroom-locations')
            .then(res => res.json())
            .then(data => {
                for (const loc of data) {
                    if (loc.lat != null && loc.lng != null) {
                        addRestroomMarker(loc);
                    }
                }
            })
            .catch(err => {
                console.error("Failed to load restrooms:", err);
            });


        map.on('dblclick', function (e) {
            addRestroomMarker(e.latlng);
            console.log(e.latlng);
        });

        const connected = document.getElementById("sidebar-tester");
        if (connected) {
            connected.style.display = "inline";
            connected.addEventListener("click", () => {
                document.getElementById("account-sidebar").classList.add("show");
                document.getElementById("user-email").textContent = `${user.email}`;
            })
        };

        //close marker popup when sidebar is closed
        document.getElementById("close-sidebar").addEventListener("click", () => {
            document.getElementById("account-sidebar").classList.remove("show");
            if (map) {
                map.closePopup();
            }
        });
    }
})();


if (typeof module !== 'undefined') {
    module.exports = {
        // Functions to test here
    };
}
