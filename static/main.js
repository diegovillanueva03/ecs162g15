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

const accountSidebar = document.getElementById('account-sidebar');
const userReviewSection = document.getElementById('user-review-section');
const locationNameElement = document.getElementById('location-name');

// sidebar functions
function openReviewSidebar(){
    if(accountSidebar){
        accountSidebar.classList.add('show');
    }
}

function closeReviewSidebar(){
    if (accountSidebar){
        accountSidebar.classList.remove('show');
        if(userReviewSection){
            userReviewSection.innerHTML = ''; //clear the review section
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if(closeSidebarBtn){
        closeSidebarBtn.addEventListener('click', closeReviewSidebar);
    }
});

//get reviews for retroom location
async function fetchReviews(restroomId, buildingName){
    if(!userReviewSection){
        console.error('error');
        return;
    }

    //loading message
    userReviewSection.innerHTML = '<h3>Loading Reviews...</h3>';

    //update location name 
    if(locationNameElement){
        locationNameElement.textContent = buildingName;
    }

    openReviewSidebar();

    try{
        const response = await fetch(`/get-restroom-reviews/${restroomId}`);
        if(!response.ok){
            throw new Error(`Error: ${response.status}`);
        }
        const reviews = await response.json();

        userReviewSection.innerHTML = '';

        if (reviews.length == 0){
            userReviewSection.innerHTML = '<p>Not reviews yet.</p>';
        } else {
            reviews.forEach(review => {
                const reviewElement = document.createElement('div');
                reviewElement.className = 'bg-white';

                const reviewDate = new Date(review.timestamp.$date || review.timestamp);
                
                reviewElement.innerHTML = 
                `
                <p>${review.username || 'Jane Doe'}</p>
                <p><span>${'★'.repeat(review.rating)}</span></p>
                <p>${review.content}</p>
                <p>${reviewDate.toLocaleDateString()}</p>
                `;
                userReviewSection.appendChild(reviewElement);
            });
        }
    } catch (error){
        console.error('Error fetching reviews.');
        userReviewSection.innerHTML = `<p>${error.message}</p>`;
    }
}

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
    const restroomId = loc._id;

    for (let m of restroom_markers) {
        let latLng = m.getLatLng();
        if (latLng.equals(coords))
            return null;
    }

    let marker = L.marker(coords, {
        riseOnHover: true,
    }).addTo(map);

    marker._restroomId = restroomId;
    marker._buildingName = 'Loading...';
    restroom_markers.push(marker);

    const { lat, lng } = coords;

    marker.bindPopup('<header>Loading building name...</header>').openPopup();

    // //open sidebar when marker is clicked
    // const sidebar = document.getElementById("account-sidebar");
    // if (sidebar && !sidebar.classList.contains("show")) {
    //     sidebar.classList.add("show");
    // }
    openReviewSidebar(); //maybe fix, bc will open without reviews

    if (!isNew && loc._id) {
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
    }

    //close sidebar when popup is closed
    marker.on('popupclose', () => {
        closeReviewSidebar();
    });

    getBuildingName(loc.lat, loc.lng, restroomId).then(({ name, popupText }) => {
        marker.name = name;
        marker.setPopupContent(popupText);
        const buildingName = name;
        marker._buildingName = buildingName;

        if(locationNameElement){
            locationNameElement.textContent = buildingName;
        }

        const popupContent = `
            ${popupText}
            <button id="seeReviewsBtn_${restroomId}">See Reviews</button>
        `;

        marker.setPopupContent(popupContent)
            .on('popupopen', function() {
                const seeReviewsBtn = document.getElementById(`seeReviewsBtn_${restroomId}`);
                if(seeReviewsBtn){
                    seeReviewsBtn.onclick = () => {
                        fetchReviews(restroomId, buildingName);
                    };
                }
                openReviewSidebar();
                fetchReviews(restroomId, buildingName);
            });
            marker.openPopup();
    }).catch(err => {
        console.error("Error getting building name:", err);
        marker.setPopupContent("<header>Error retrieving building name</header>");
    });

    return marker;
}


async function getBuildingName(lat, lng) {
    return fetch('/get-building-name', {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ lat, lng })
    })
        .then(res => res.json())
        .then(data => {
            let popupText = '';
            let name = 'Unknown';
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
            return { name, popupText };
        })
        .catch(error => {
            console.log("Error retrieving location:", error);
            return { name: "Error", popupText: "<header>Error retrieving location</header>" };
        });
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
                        addNewRestroomMarker(loc);
                    }
                }
            })
            .catch(err => {
                console.error("Failed to load restrooms:", err);
            });

        map.on('dblclick', function (e) {
            addRestroomMarker(e.latlng);
            console.log(e.latlng);
        }, true);

        //close marker popup when sidebar is closed
        document.getElementById("close-sidebar").addEventListener("click", () => {
            closeReviewSidebar();
            if (map) {
                map.closePopup();
            }
        });

        const loginButton = document.getElementById("login-button");
        if (loginButton) {
            loginButton.addEventListener("click", () => {
                window.location.href = "/login";
            });
        }

        fetch('/user')
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('Not logged in');
            })
            .then(user => {
                //logged in
                const right_corner = document.getElementById("account-dropdown");
                const login_container = document.getElementById("login-container");

                if (login_container) login_container.style.display = "none";

                right_corner.style.display = "inline-block";
                right_corner.innerHTML = `
                    <button id="account" class="button">Account <img src="../static/images/down_carat.png" alt="down carat" id="carat"></button>
                    <div id="dropdown" style="visibility: hidden;">
                        <div id="account-name" class="drop-option">${user.email}</div>
                        <button id="logout-button" class="button">Log Out</button>
                    </div>
                `;

                const account_button = document.getElementById("account");
                const dropdown = document.getElementById("dropdown");
                const carat = document.getElementById("carat");

                account_button.addEventListener("click", () => {
                    if (dropdown.style.visibility === 'hidden') {
                        dropdown.style.visibility = 'visible';
                        carat.src = "../static/images/up_carat.png";
                    } else {
                        dropdown.style.visibility = 'hidden';
                        carat.src = "../static/images/down_carat.png";
                    }
                });

                const logout_button = document.getElementById("logout-button");
                logout_button.addEventListener("click", () => {
                    window.location.href = "/logout";
                });

            })
            .catch(() => {
                //not logged in
                const right_corner = document.getElementById("account-dropdown");
                const login_container = document.getElementById("login-container");

                right_corner.style.display = "none";
                if (login_container) {
                    login_container.style.display = "inline-block";
                    const login_button = document.getElementById("login-button");
                    login_button.addEventListener("click", () => {
                        window.location.href = "/login";
                    });
                }
            });
    }
})();

function addNewRestroomMarker(loc) {
    const marker = addRestroomMarker(loc);

    if (!marker) return;

    const sidebar = document.getElementById("account-sidebar");
    if (sidebar && !sidebar.classList.contains("show")) {
        sidebar.classList.add("show");
    }

    fetch('/new-restroom-sidebar')
        .then(res => res.text())
        .then(html => {
            sidebar.innerHTML = html;

            document.getElementById("submit-restroom").addEventListener("click", async () => {
                const description = document.getElementById("restroom-description").value;
                const { name } = await getBuildingName(loc.lat, loc.lng);

                fetch('/add-restroom-location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lat: loc.lat,
                        lng: loc.lng,
                        name: name,
                        description: description,
                    })
                })
                    .then(res => res.json())
                    .then(result => {
                        if (result._id) {
                            alert("Restroom added successfully.");
                        } else {
                            alert("Error: " + result.error);
                        }
                    })
                    .catch(err => {
                        console.error("Submit failed:", err);
                        alert("Faled to submit.");
                    });
            });
        })
        .catch(err => {
            console.error("Failed to load form:", err);
            sidebar.innerHTML = "<p>Error loading form.</p>";
        });
}



if (typeof module !== 'undefined') {
    module.exports = {
        // Functions to test here
    };
}
