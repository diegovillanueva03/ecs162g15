"use strict";

/* SOURCES

    https://leafletjs.com/examples/quick-start/
    https://www.w3schools.com/html/html5_geolocation.asp


 */



let current_coords;

async function setCurrentCoordinates() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            } else {
                reject(new Error("Geolocation API is not supported by this browser."));
            }
        });
}

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

        setCurrentCoordinates()
            .then((position) => {
                current_coords = position.coords;
                console.log(current_coords.latitude);
                console.log(current_coords.longitude);
                map.setView([current_coords.latitude, current_coords.longitude]);
            })
            .catch((error) => {
                console.log("Could not get location coordinates", error);
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
