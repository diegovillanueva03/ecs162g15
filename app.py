import os
import re
import json
import requests
from typing import Optional
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, json
from authlib.integrations.flask_client import OAuth
from authlib.common.security import generate_token
from pymongo import MongoClient
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId

# Sources:
# https://wiki.openstreetmap.org/wiki/Overpass_API
# query nearby buildings using overpass api:
# https://stackoverflow.com/questions/76458081/overpass-around-to-find-addresses-in-certain-radius-from-a-coordinate
#
#
#

load_dotenv(dotenv_path='.env.dev')

LEAFLET_API_KEY = os.environ.get("LEAFLET_API_KEY")

app = Flask(__name__)
app.secret_key = os.urandom(24)





MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
MONGO_CLIENT = MongoClient(MONGO_URI)
db = MONGO_CLIENT["restroom_review"]
LOCATIONS_COLLECTION = db["restrooms"]
REVIEWS_COLLECTION = db["reviews"]

OAUTH = OAuth(app)
NONCE = generate_token()

OAUTH.register(
    name=os.getenv('OIDC_CLIENT_NAME'),
    client_id=os.getenv('OIDC_CLIENT_ID'),
    client_secret=os.getenv('OIDC_CLIENT_SECRET'),
    #server_metadata_url='http://dex:5556/.well-known/openid-configuration',
    authorization_endpoint="http://localhost:5556/auth",
    token_endpoint="http://dex:5556/token",
    jwks_uri="http://dex:5556/keys",
    userinfo_endpoint="http://dex:5556/userinfo",
    device_authorization_endpoint="http://dex:5556/device/code",
    client_kwargs={'scope': 'openid email profile'}
)

@app.route('/get-building-name', methods=['POST'])
def get_building_name():
    data = request.get_json()
    lat = data.get('lat')
    lng = data.get('lng')
    radius = 25

    #query overpass api to get building name
    query = f"""
        [out:json];
        (
            way(around:{radius},{lat},{lng})[building][name];
            relation(around:{radius},{lat},{lng})[building][name];
        );
        out center;
    """
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    return jsonify(response.json())

@app.route('/')
def home():
    return render_template('index.html')

# TODO: Need login endpoint
# TODO: Need logout endpoint

@app.route('/add-restroom-location', methods=['POST'])
def add_restroom_location():
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    email = user.get("email")


    try:
        data = request.get_json()
        lat = data.get("lat")
        lng = data.get("lng")
        name = data.get("name")
        description = data.get("description")

        if not lat or not lng or not description or not name:
            return jsonify({'error': 'Missing headline, content, name, or description'}), 400

        location = {
            "lat": lat,
            "lng": lng,
            "description": description,
            "creator-email": email,
            "building-name": name
            "timestamp": datetime.now(timezone.utc)
        }
        result = LOCATIONS_COLLECTION.insert_one(location)
        location['_id'] = str(result.inserted_id)
        return jsonify(location), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add-restroom-review/<restroom_id>', methods=['POST'])
def add_restroom_review():
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    email = user.get("email")

    try:
        data = request.get_json()
        locationid = data.get("locationid")
        username = data.get("username")
        rating = data.get("rating")
        content = data.get("content")

        if not rating or not content:
            return jsonify({'error': 'Missing rating or content'}), 400

        review = {
            "locationid": locationid,
            "username": username,
            "rating": rating,
            "content": content,
            "creator-email": email,
            "timestamp": datetime.now(timezone.utc)
        }
        result = REVIEWS_COLLECTION.insert_one(review)
        review['_id'] = str(result.inserted_id)
        return jsonify(review), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add-restroom-review/<restroom_id>', methods=['POST'])
def remove_restroom_location():
    # TODO: Remove restroom location and all associated reviews
    pass


@app.route('/add-restroom-review/<restroom_id>', methods=['POST'])
def remove_restroom_review():
    # TODO: Remove restroom review either as a moderator
    #  or unprivileged user (Can only remove their review)
    pass

@app.route('/restroom-locations', methods=['GET'])
def get_restroom_locations():
    try:
        locations = list(LOCATIONS_COLLECTION.find({}))
        for loc in locations:
            loc['_id'] = str(loc['_id'])
        return jsonify(locations)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/restroom/<restroom_id>', methods=['GET'])
def view_restroom(restroom_id):
    try:
        obj_id = ObjectId(restroom_id)
        restroom = LOCATIONS_COLLECTION.find_one({'_id': obj_id})
        reviews = list(REVIEWS_COLLECTION.find({'locationid': restroom_id}))
        if restroom:
            restroom['_id'] = str(restroom['_id'])
            for r in reviews:
                r['_id'] = str(r['_id'])
            return render_template('restroom.j2', restroom=restroom, reviews=reviews)
        return "Not found", 404
    except InvalidId:
        return "Invalid ID", 400


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
