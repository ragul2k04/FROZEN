# Secure Banking Transaction Web Application
#
# SETUP INSTRUCTIONS:
# 1. Install dependencies:
#    pip install -r requirements.txt
#
# 2. Set Environment Variables:
#    - For the Gemini API Key:
#      On Linux/macOS: export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
#      On Windows: set GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
#    - It is also recommended to set FLASK_SECRET_KEY and TOKEN_SECRET_SALT for production.
#
# 3. Initialize the database:
#    python database.py
#
# 4. Run the application:
#    python app.py
#
# 5. Open your browser and navigate to http://127.0.0.1:5000

import hashlib
import os
import random
import sqlite3
import time
from datetime import datetime, timedelta

import google.generativeai as genai
from flask import Flask, jsonify, render_template, request, session

app = Flask(__name__)
# IMPORTANT: In production, use environment variables for secret keys.
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev_secret_key_for_testing_purposes')

# --- GEMINI API SETUP ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('banking.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- RENDER HTML PAGES ---

@app.route('/')
def index():
    """Renders the bank selection page."""
    return render_template('index.html')

@app.route('/verification')
def verification():
    """Renders the customer verification page."""
    return render_template('verification.html')

@app.route('/transaction')
def transaction():
    """Renders the transaction type and amount page."""
    return render_template('transaction.html')

@app.route('/eform')
def eform():
    """Renders the electronic form page."""
    return render_template('eform.html')

@app.route('/branch_verify')
def branch_verify():
    """Renders the branch verification page."""
    return render_template('branch_verify.html')

# --- API ENDPOINTS ---

@app.route('/api/verify_customer', methods=['POST'])
def verify_customer():
    """Verifies customer details against the database."""
    data = request.json
    account_number = data.get('accountNumber')
    name = data.get('name')
    mobile = data.get('mobile')

    conn = get_db_connection()
    customer = conn.execute(
        'SELECT * FROM customers WHERE account_number = ? AND name = ? AND mobile = ?',
        (account_number, name, mobile)
    ).fetchone()
    conn.close()

    if customer:
        session['customer_account'] = customer['account_number']
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'message': 'Invalid customer details.'}), 401

@app.route('/api/generate_token', methods=['POST'])
def generate_token():
    """Generates a token and creates a pending transaction record."""
    data = request.json
    account_number = data.get('accountNumber')
    amount = data.get('amount')
    transaction_type = data.get('transactionType')

    if not all([account_number, amount, transaction_type]):
        return jsonify({'success': False, 'message': 'Missing transaction details.'}), 400

    timestamp = int(time.time())
    # IMPORTANT: In production, use an environment variable for the salt.
    secret_salt = os.environ.get('TOKEN_SECRET_SALT', 'super_secret_salt_for_dev')

    token_string = f"{account_number}{amount}{timestamp}{secret_salt}"
    token = hashlib.sha256(token_string.encode()).hexdigest()[:16].upper()

    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO transactions (token, account_number, amount, transaction_type, status) VALUES (?, ?, ?, ?, ?)',
            (token, account_number, float(amount), transaction_type, 'pending')
        )
        conn.commit()
        return jsonify({'success': True, 'token': token})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Failed to create a unique transaction.'}), 500
    finally:
        conn.close()

@app.route('/api/generate_otp', methods=['POST'])
def generate_otp():
    """Generates a 6-digit OTP and simulates sending it."""
    otp = str(random.randint(100000, 999999))
    session['otp'] = otp
    session['otp_expiry'] = (datetime.now() + timedelta(minutes=5)).isoformat()

    print(f"Generated OTP for session: {otp}")
    return jsonify({'success': True, 'message': 'OTP generated and sent.'})

@app.route('/api/verify_transaction', methods=['POST'])
def verify_transaction():
    """Verifies transaction details and updates the transaction status."""
    data = request.json
    token = data.get('token')
    otp = data.get('otp')
    fingerprint_verified = data.get('fingerprintVerified')

    # 1. Verify OTP
    if 'otp' not in session or 'otp_expiry' not in session:
        return jsonify({'success': False, 'message': 'OTP not generated or session expired.'}), 400

    if session['otp'] != otp:
        return jsonify({'success': False, 'message': 'Invalid OTP.'}), 401

    if datetime.now() > datetime.fromisoformat(session['otp_expiry']):
        return jsonify({'success': False, 'message': 'OTP has expired.'}), 401

    # 2. Verify Fingerprint (Simulated)
    if not fingerprint_verified:
        return jsonify({'success': False, 'message': 'Fingerprint verification failed.'}), 401

    conn = get_db_connection()
    try:
        transaction = conn.execute('SELECT * FROM transactions WHERE token = ?', (token,)).fetchone()

        if not transaction:
            return jsonify({'success': False, 'message': 'Invalid transaction token.'}), 404

        if transaction['status'] != 'pending':
            return jsonify({'success': False, 'message': 'This transaction has already been processed.'}), 409

        conn.execute(
            'UPDATE transactions SET status = ?, otp = ? WHERE token = ?',
            ('completed', otp, token)
        )
        conn.commit()

        # Clear session data after successful transaction
        session.pop('otp', None)
        session.pop('otp_expiry', None)

        return jsonify({'success': True, 'message': 'Transaction completed successfully.'})
    finally:
        conn.close()

@app.route('/api/customer/<account_number>', methods=['GET'])
def get_customer(account_number):
    """Retrieves customer details by account number."""
    conn = get_db_connection()
    customer = conn.execute('SELECT account_number, name, mobile, bank FROM customers WHERE account_number = ?', (account_number,)).fetchone()
    conn.close()

    if customer:
        return jsonify(dict(customer))
    else:
        return jsonify({'message': 'Customer not found.'}), 404

@app.route('/api/chatbot', methods=['POST'])
def chatbot():
    """Handles chatbot requests using the Gemini API."""
    data = request.json
    user_message = data.get('message')

    try:
        response = model.generate_content(user_message)
        return jsonify({'reply': response.text})
    except Exception as e:
        print(f"Error with Gemini API: {e}")
        return jsonify({'reply': 'Sorry, I am having trouble connecting to the AI assistant.'}), 500

if __name__ == '__main__':
    app.run(debug=True)
