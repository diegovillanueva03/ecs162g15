#Python Script used to find the lng and lat for a location.
#Uses Google Maps Geocoding API
#Here for reference, used to construct the DB. --> set up venv/run seperately
#Worked Suprisingly Well!
#https://developers.google.com/maps/documentation/geocoding/start

import json
import time
import requests
import os
import sys
from dotenv import load_dotenv


load_dotenv()

API_KEY = os.getenv('GOOGLE_API_KEY')
INPUT_FILE = './seed/locations.json'
OUTPUT_FILE = 'restrooms_with_coords.json'

def geocode_location(building_name):
	address = f"{building_name}, Davis, CA"
	url = "https://maps.googleapis.com/maps/api/geocode/json"
	params = {
		'address': address,
		'key': API_KEY
	}

	try:
		resp = requests.get(url, params=params, timeout=5)
		data = resp.json()

		if data.get('status') == 'OK' and data['results']:
			location = data['results'][0]['geometry']['location']
			return location['lat'], location['lng']
		else:
			print(f"Geocoding failed for '{building_name}': {data.get('status')}")
			return None, None

	except requests.RequestException as e:
		print(f"ERROR!! Request error for '{building_name}': {e}")
		return None, None

def main():
	with open(INPUT_FILE, 'r') as infile:
		restrooms = json.load(infile)

	for i, restroom in enumerate(restrooms):
		if restroom.get('lat') is None or restroom.get('lng') is None:
			building_name = restroom.get('building-name', '')
			if not building_name:
				print(f"Error!!Missing building name at index {i}")
				continue

			lat, lng = geocode_location(building_name)
			restroom['lat'] = lat
			restroom['lng'] = lng

			time.sleep(0.2)

	with open(OUTPUT_FILE, 'w') as outfile:
		json.dump(restrooms, outfile, indent=2)

	print(f"Geocoding complete. Output saved to '{OUTPUT_FILE}'")

if __name__ == '__main__':
	main()
