import pytest
import json
from flask import session
from app import app
from unittest.mock import patch

# Sources:
# https://docs.pytest.org/en/stable/contents.html
#

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_home(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'<html' in response.data 

def test_get_user_auth(client):
    with client.session_transaction() as sess:
        sess['user'] = {
            "email": "test@example.com",
            "name": "Test",
        }

    response = client.get("/user")
    assert response.status_code == 200
    data = response.get_json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test"

def test_get_user_unauthenticated(client):
    response = client.get('/user')
    assert response.status_code == 401
    assert response.get_json()["error"] == "Unauthorized"

@patch("app.requests.post")
def test_get_building_name_valid(mock_post, client):
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {"elements": []}
    response = client.post("/get-building-name", json={"lat": 38.539, "lng": -121.753})
    assert response.status_code == 200
    assert response.get_json() == {"elements": []}

def test_get_building_name_invalid(client):
    response = client.post("/get-building-name", json={"lat": None, "lng": None})
    assert response.status_code == 200

def test_add_restroom_location_unauthorized(client):
    response = client.post("/add-restroom-location", json={})
    assert response.status_code == 401
    assert response.get_json()["error"] == "Unauthorized"

def test_login(client):
    response = client.get('/login')
    assert response.status_code == 302 #found
    assert 'http://localhost:5556/auth' in response.headers['Location']

def test_logout(client):
    with client.session_transaction() as sess:
        sess['user'] = {"email": "test@example.com"}
    response = client.get("/logout")
    assert response.status_code == 302
    assert response.headers['Location'] == '/'
    with client.session_transaction() as sess:
        assert "user" not in sess