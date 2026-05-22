from flask_mail import Mail, Message
from flask import Flask, request, jsonify, Response
import os
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import bcrypt
import json

app = Flask(__name__)
CORS(app)
# Read mail credentials from environment when available (recommended)
app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "True") == "True"
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "tipa090704@gmail.com")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "tiipa@974")
app.config["MAIL_SENDER_NAME"] = os.environ.get("MAIL_SENDER_NAME", "FitPulse Support System")

mail = Mail(app)

# ---------------- DATABASE ----------------
client = MongoClient("mongodb://localhost:27017/")
db = client["fitpulse"]
users = db["users"]
health = db["health"]

# ---------------- HELPERS ----------------
def to_int(value):
    try:
        return int(value)
    except:
        return 0

def to_float(value):
    try:
        return float(value)
    except:
        return 0.0

def send_critical_mail(
    email,
    username,
    issues
):
    msg = Message(
        subject="FitPulse Critical Health Alert",
        sender=(app.config.get("MAIL_SENDER_NAME"), app.config.get("MAIL_USERNAME")),
        recipients=[email],
    )

    msg.body = f"""

Hello {username},

Notification From FitPulse

Your Recent Health Report Detected:

Status: Critical

Issues:

{chr(10).join(f"• {i}" for i in issues)}

Please monitor your health.

THANK YOU FOR USING FITPULSE !!!

"""

    try:
        mail.send(msg)
        print(f"Email sent to {email}")
        return True
    except Exception as e:
        # Log the error but do not raise — saving the health record should not fail
        print(f"Failed to send email to {email}: {e}")
        return False

# ---------------- PREPROCESS ----------------
def preprocess(data):
    heart = to_int(data.get("heart_rate"))
    steps = to_int(data.get("steps"))
    sleep = to_float(data.get("sleep_hours"))

    # Validation
    if heart < 0 or heart > 220:
        heart = 0
    if steps < 0:
        steps = 0
    if sleep < 0 or sleep > 24:
        sleep = 0

    timestamp = data.get("timestamp")
    if not timestamp:
        timestamp = datetime.now().isoformat()

    return {
        "username": data.get("username", ""),
        "timestamp": timestamp,
        "heart_rate": heart,
        "steps": steps,
        "sleep_hours": sleep
    }

# ---------------- REGISTER ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json

    if users.find_one({"email": data["email"]}):
        return jsonify({"msg": "User already exists"}), 400

    hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())

    users.insert_one({

        "username":
        data["username"],

        "email":
        data["email"],

        "password":
        hashed,

        "email_alert":
        False

    })

    return jsonify({"msg": "Registered successfully"})

# ---------------- LOGIN ----------------
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    user = users.find_one({"email": data["email"]})

    if not user:
        return jsonify({"msg": "User not found"}), 404

    if bcrypt.checkpw(data["password"].encode(), user["password"]):
        return jsonify({
            "msg": "Login success",
            "username": user["username"]
        })

    return jsonify({"msg": "Invalid password"}), 401

# ---------------- TOGGLE EMAIL ALERT ----------------
@app.route("/toggle-email-alert", methods=["POST"])
def toggle_email_alert():

    data = request.json

    print("DATA:", data)

    result = users.update_one(

        {
            "username":
            data["username"]
        },

        {
            "$set":{

                "email_alert":
                data["enabled"]

            }
        }

    )

    return jsonify({

        "msg":
        "Email preference updated"

    })

# ---------------- SAVE ----------------

def analyze_health(data):
    score = 0
    issues = []

    if data["heart_rate"] > 100 or data["heart_rate"] < 60:
        score += 1
        issues.append("Abnormal Heart Rate")

    if data["steps"] < 5000:
        score += 1
        issues.append("Low Activity")

    if data["sleep_hours"] < 6:
        score += 1
        issues.append("Poor Sleep")

    # Final status
    if score == 0:
        status = "Normal"
    elif score == 1:
        status = "Warning"
    else:
        status = "Critical"

    return {
        "anomaly_score": score,
        "status": status,
        "issues": issues
    }

def analyze_with_history(username, new_data):
    user_data = list(health.find({"username": username}).sort("_id", 1))

    # If not enough data, fallback to rule-based
    if len(user_data) < 3:
        return analyze_health(new_data)

    avg_hr = sum(to_int(d.get("heart_rate", 0)) for d in user_data) / len(user_data)
    avg_steps = sum(to_int(d.get("steps", 0)) for d in user_data) / len(user_data)
    avg_sleep = sum(to_float(d.get("sleep_hours", 0)) for d in user_data) / len(user_data)

    score = 0
    issues = []

    # Compare with average (personalized)
    if abs(new_data["heart_rate"] - avg_hr) > 20:
        score += 1
        issues.append("Unusual Heart Rate (vs history)")

    if new_data["steps"] < avg_steps * 0.5:
        score += 1
        issues.append("Low Activity (vs history)")

    if new_data["sleep_hours"] < 6:
        score += 1
        issues.append("Poor Sleep (vs history)")

    if score == 0:
        status = "Normal"
    elif score == 1:
        status = "Warning"
    else: 
        status = "Critical"

    return {
        "anomaly_score": score,
        "status": status,
        "issues": issues
    }

@app.route("/save", methods=["POST"])
def save():
    data = request.json
    clean = preprocess(data)

    # ✅ USE THIS (Milestone 3)
    analysis = analyze_with_history(clean["username"], clean)

    clean["anomaly_score"] = analysis["anomaly_score"]
    clean["status"] = analysis["status"]
    clean["issues"] = analysis["issues"]

    inserted = health.insert_one(clean)

    if clean["status"] == "Critical":
        user = users.find_one({"username": clean["username"]})
        if user and user.get("email_alert"):
            send_critical_mail(user["email"], clean["username"], clean["issues"])



    return Response(json.dumps({
        "msg": "Saved successfully",
        "id": inserted.inserted_id
    }, default=str), mimetype="application/json")

# ---------------- GET DATA ----------------
@app.route("/data/<username>", methods=["GET"])
def get_data(username):
    records = []

    for doc in health.find({"username": username}).sort("_id", 1):
        records.append({
            "id": str(doc["_id"]),
            "timestamp": doc.get("timestamp", ""),
            "heart_rate": to_int(doc.get("heart_rate")),
            "steps": to_int(doc.get("steps")),
            "sleep_hours": to_float(doc.get("sleep_hours")),
            "status": doc.get("status", "Normal"),
            "anomaly_score": doc.get("anomaly_score", 0),
            "issues": doc.get("issues", [])
        })

    return jsonify(records)

# ---------------- CLEAR ALL ----------------
@app.route("/clear/<username>", methods=["DELETE"])
def clear_data(username):
    result = health.delete_many({"username": username})
    return jsonify({"msg": f"Cleared {result.deleted_count} record(s)"})

# ---------------- DELETE SELECTED ----------------
@app.route("/delete-selected", methods=["DELETE", "OPTIONS"])
def delete_selected():
    if request.method == "OPTIONS":
        return jsonify({"msg": "OK"}), 200

    data = request.json
    username = data.get("username")
    ids = data.get("ids", [])

    object_ids = []
    for i in ids:
        try:
            object_ids.append(ObjectId(i))
        except:
            continue

    result = health.delete_many({
        "username": username,
        "_id": {"$in": object_ids}
    })

    return jsonify({"msg": f"Deleted {result.deleted_count} record(s)"})

# ---------------- TEST EMAIL ----------------
@app.route("/test-email", methods=["POST"])
def test_email():
    data = request.json or {}
    email = data.get("email") or app.config.get("MAIL_USERNAME")
    username = data.get("username", "TestUser")
    issues = data.get("issues", ["Test issue"]) or ["Test issue"]

    sent = send_critical_mail(email, username, issues)
    if sent:
        print(f"/test-email: sent to {email}")
        return jsonify({"msg": "Test email sent", "to": email}), 200
    else:
        print(f"/test-email: failed to send to {email}")
        return jsonify({"msg": "Failed to send test email; check credentials/logs", "to": email}), 200

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
