let {
    openReviewSidebar,
    closeReviewSidebar,
    initMap,
    loadCurrentCoordinates,
} = require('../main.js');

//mock leaflet
global.L = {
    map: jest.fn(() => ({
        setView: jest.fn(),
        on: jest.fn(),
    })),
    tileLayer: jest.fn(() => ({
        addTo: jest.fn(),
    })),
    circleMarker: jest.fn(() => ({
        addTo: jest.fn(),
    })),
};

describe('Sidebar', () => {
    let accountSidebar, userReviewSection, locationNameElement;

    beforeEach(() => {
        document.body.innerHTML = `
      <div id="account-sidebar"></div>
      <div id="user-review-section"></div>
      <div id="location-name"></div>
    `;

        accountSidebar = document.getElementById('account-sidebar');
        userReviewSection = document.getElementById('user-review-section');
        locationNameElement = document.getElementById('location-name');
    });

    test('openReviewSidebar', () => {
        openReviewSidebar();
        expect(accountSidebar.classList.contains('show')).toBe(true);
    });

    test('closeReviewSidebar', () => {
        accountSidebar.classList.add('show');
        userReviewSection.innerHTML = 'Review';

        closeReviewSidebar();
        expect(accountSidebar.classList.contains('show')).toBe(false);
        expect(userReviewSection.innerHTML).toBe('');
    });
});

describe('Map Functions', () => {
    test('initMap initializes map if not already initialized', () => {
        global.map = null;
        initMap([0, 0], 5);
        expect(L.map).toHaveBeenCalled();
        expect(L.tileLayer).toHaveBeenCalled();
    });

    test('initMap updates map view if already initialized', () => {
        const setViewMock = jest.fn();
        global.map = { setView: setViewMock };
        initMap([1, 1], 10);
        expect(setViewMock).toHaveBeenCalledWith([1, 1], 10, { animate: true });
    });
});

describe('Geolocation and Current Location', () => {
    test('loadCurrentCoordinates receives coordinates', async () => {
        const coords = { latitude: 38.539, longitude: -121.753 };
        const getCurrentPositionMock = jest.fn().mockImplementation((success) =>
            success({ coords })
        );
        global.navigator.geolocation = { getCurrentPosition: getCurrentPositionMock };

        const result = await loadCurrentCoordinates();
        expect(result).toEqual([38.539, -121.753]);
    });

    test('loadCurrentCoordinates rejects if not user blocks location', async () => {
        global.navigator.geolocation = null;

        await expect(loadCurrentCoordinates()).rejects.toThrow(
            'Geolocation API is not supported by this browser.'
        );
    });
});
