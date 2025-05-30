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
# 
# 
# 
# 

load_dotenv(dotenv_path='.env.dev')

LEAFLET_API_KEY = os.environ.get("LEAFLET_API_KEY")

app = Flask(__name__)
app.secret_key = os.urandom(24)


oauth = OAuth(app)
nonce = generate_token()


mongo_uri = os.getenv("MONGO_URI", "mongodb://mongo:27017")
client = MongoClient(mongo_uri)
db = client["mydatabase"]
comments_collection = db["comments"]

oauth.register(
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

@app.route('/')
def home():
    return render_template('index.html')



if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
