import psycopg2


DB_HOST = "postgres"
DB_PORT = "5432"
DB_NAME = "medical_iot"
DB_USER = "medical_user"
DB_PASSWORD = "medical_pass"


def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )