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
LOCATIONS_COLLECTION = db["locations"]
REVIEWS_COLLECTION = db["reviews"]

LOCATIONS_COLLECTION.delete_many({})
REVIEWS_COLLECTION.delete_many({})
if LOCATIONS_COLLECTION.count_documents({}) == 0 and REVIEWS_COLLECTION.count_documents({}) == 0:
    with open('seed/locations.json', 'r') as f:
        LOCATIONS_COLLECTION.insert_many(json.load(f))
    with open('seed/reviews.json', 'r') as f:
        REVIEWS_COLLECTION.insert_many(json.load(f))

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

@app.route('/login')
def login():
    session['nonce'] = NONCE
    redirect_uri = 'http://localhost:8000/authorize'
    oauth_client = OAUTH.create_client(os.getenv('OIDC_CLIENT_NAME'))
    return oauth_client.authorize_redirect(redirect_uri, nonce=NONCE)

@app.route('/authorize')
def authorize():
    oauth_client = OAUTH.create_client(os.getenv('OIDC_CLIENT_NAME'))
    token = oauth_client.authorize_access_token()
    nonce = session.get('nonce')
    user_info = oauth_client.parse_id_token(token, nonce=nonce)
    session['user'] = user_info
    return redirect('/')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/user')
def get_user():
    user = session.get('user')
    if user:
        return jsonify(user)
    return jsonify({"error": "Unauthorized"}), 401

def perform_authorized_action(action):
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    email = user.get("email")
    username = user.get("username")

    try:
        return action(email, username)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add-restroom-location', methods=['POST'])
def add_restroom_location():
    def action(email, username):
         data = request.get_json()
         lat = data.get("lat")
         lng = data.get("lng")
         name = data.get("name")
         description = data.get("description")

         if not lat or not lng or not name or not description:
             return jsonify({'error': 'Missing or malformed data'}), 400

         location = {
             "lat": lat,
             "lng": lng,
             "name": name,
             "description": description,
             "creator-email": email,
             "timestamp": datetime.now(timezone.utc)
         }
         result = LOCATIONS_COLLECTION.insert_one(location)
         location['_id'] = str(result.inserted_id)
         return jsonify(location), 201
    return perform_authorized_action(action)

@app.route('/add-restroom-review', methods=['POST'])
def add_restroom_review():
    def action(email, username):
         data = request.get_json()
         restroomid = data.get("restroomid")
         rating = data.get("rating")
         content = data.get("content")

         if not restroomid or not rating or not content:
             return jsonify({'error': 'Missing id, rating, or content'}), 400

         document = {
             "restroomid": restroomid,
             "rating": rating,
             "content": content,
             "username": username,
             "creator-email": email,
             "timestamp": datetime.now(timezone.utc)
         }
         result = REVIEWS_COLLECTION.insert_one(document)
         document['_id'] = str(result.inserted_id)
         return jsonify(document), 201
    return perform_authorized_action(action)

@app.route('/remove-restroom/<restroom_id>', methods=['POST'])
def remove_restroom_location(restroom_id):
    def action(email, username):
        oid = ObjectId(restroom_id)
        restroom = LOCATIONS_COLLECTION.find_one({'_id': oid}) or LOCATIONS_COLLECTION.find_one({'_id': restroom_id})
        if not restroom:
                return jsonify({'error': 'Restroom not found'}), 404

        creator = restroom.get("creator-email")
        if creator and email != "admin@mail.com" and email != "mod@mail.com" email !=  email != creator and username not in ["moderador", "admin"]:
            return jsonify({'error': 'Unauthorized'}), 401

        LOCATIONS_COLLECTION.delete_one({'_id': ObjectId(restroom_id)})
        REVIEWS_COLLECTION.delete_many({'restroomid': restroom_id})
        restroom['_id'] = str(restroom['_id'])
        return jsonify(restroom), 200
    return perform_authorized_action(action)

@app.route('/remove-restroom_review/<review_id>', methods=['POST'])
def remove_restroom_review(review_id):
    def action(email, username):
        try:
            oid = ObjectId(review_id)
            review = REVIEWS_COLLECTION.find_one({'_id': oid}) or REVIEWS_COLLECTION.find_one({'_id': review_id})
        except InvalidId:
            return jsonify({'error': 'Invalid review ID'}), 400

        if not review:
            return jsonify({'error': 'Review not found'}), 404

        creator = review.get("creator-email")
        if creator and email != "admin@mail.com" and email != "mod@mail.com" email !=  email != creator and username not in ["moderador", "admin"]:
            return jsonify({'error': 'Unauthorized'}), 401

        REVIEWS_COLLECTION.delete_one({'_id': oid})
        review['_id'] = str(review['_id'])
        return jsonify(review), 200
    return perform_authorized_action(action)

@app.route('/restroom-locations')
def get_restroom_locations():
    try:
        locations = list(LOCATIONS_COLLECTION.find({}))
        for loc in locations:
            loc['_id'] = str(loc['_id'])
        return jsonify(locations)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-restroom-reviews/<restroom_id>', methods=['GET'])
def get_restroom_reviews(restroom_id):
    try:
        reviews_cursor = REVIEWS_COLLECTION.find({"locationid":restroom_id})

        review_list = []
        for review in reviews_cursor:
            review['_id'] = str(review['_id'])
            if isinstance(review.get('locationid'), ObjectId):
                review['locationid'] = str(review['locationid'])
            review_list.append(review)
        return jsonify(review_list), 200

    except InvalidId:
        return "Invalid Id", 400

@app.route('/restroom/<restroom_id>', methods=['GET'])
def view_restroom(restroom_id):
    try:
        oid = ObjectId(restroom_id)
        restroom = LOCATIONS_COLLECTION.find_one({'_id': oid}) or LOCATIONS_COLLECTION.find_one({'_id': restroom_id})
        reviews = list(REVIEWS_COLLECTION.find({'restroomid': restroom_id}))
        if restroom:
            restroom['_id'] = str(restroom['_id'])
            for r in reviews:
                r['_id'] = str(r['_id'])
            return render_template('restroom.j2', restroom=restroom, reviews=reviews)
        return "Not found", 404
    except InvalidId:
        return "Invalid ID", 400

@app.route('/new-restroom-sidebar')
def new_restroom_sidebar():
    return render_template('new_restroom.j2')


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
