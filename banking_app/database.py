import sqlite3
from datetime import datetime

def init_db():
    """Initializes the database and creates tables if they don't exist."""
    conn = sqlite3.connect('banking.db')
    c = conn.cursor()

    # Create customers table
    c.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_number TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            bank TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create transactions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            account_number TEXT NOT NULL,
            amount REAL NOT NULL,
            transaction_type TEXT NOT NULL,
            status TEXT NOT NULL,
            otp TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Insert sample data if customers table is empty
    c.execute("SELECT COUNT(*) FROM customers")
    if c.fetchone()[0] == 0:
        sample_customers = [
            ('1234567890', 'John Doe', '9876543210', 'Canara Bank'),
            ('4561234567', 'Jane Smith', '9876543211', 'SBI'),
            ('7890123456', 'Raj Kumar', '9876543212', 'Indian Bank'),
            ('9991234567', 'Priya Singh', '9876543213', 'Kotak Mahindra')
        ]
        c.executemany('INSERT INTO customers (account_number, name, mobile, bank) VALUES (?, ?, ?, ?)', sample_customers)
        print("Sample customer data inserted.")

    conn.commit()
    conn.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()
