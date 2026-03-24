import requests

BASE_URL = "http://localhost:8080"

# API documentation accessible at {BASE_URL}/api-docs

session = requests.Session()

# Login
login_data = {"username": "your_username", "password": "your_password"}

resp = session.post(f"{BASE_URL}/api/login", json=login_data)

print("Login status:", resp.status_code)
print("Cookies after login:", session.cookies.get_dict())

# Call authenticated endpoint (user projects)
api_resp = session.get(f"{BASE_URL}/api/projects-deep")

print("API response:", api_resp.status_code)

projects = api_resp.json()

for project in projects:
    print(f"Project: {project['name']} (ID: {project['id']})")
    print("Volumes:")
    for volume in project.get("volumes", []):
        print(f"  - {volume['name']} (ID: {volume['id']})")
    print("Models:")
    for model in project.get("models", []):
        print(f"  - {model['name']} (ID: {model['id']})")
