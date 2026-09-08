import random
from datetime import datetime, timezone


def generate_sensor_reading(patient_id):
    """
    Generate a simulated medical sensor reading.
    """

    # Normal physiological values
    heart_rate = random.randint(60, 100)
    spo2 = random.randint(95, 100)
    temperature = round(random.uniform(36.1, 37.5), 1)

    systolic_bp = random.randint(110, 130)
    diastolic_bp = random.randint(70, 85)

    # Occasionally introduce abnormal readings
    if random.random() < 0.05:

        abnormal_type = random.choice([
            "high_heart_rate",
            "low_spo2",
            "high_temperature",
            "high_blood_pressure"
        ])

        if abnormal_type == "high_heart_rate":
            heart_rate = random.randint(120, 160)

        elif abnormal_type == "low_spo2":
            spo2 = random.randint(80, 91)

        elif abnormal_type == "high_temperature":
            temperature = round(random.uniform(38.5, 40.5), 1)

        elif abnormal_type == "high_blood_pressure":
            systolic_bp = random.randint(145, 180)
            diastolic_bp = random.randint(90, 110)

    return {
        "patient_id": patient_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": heart_rate,
        "spo2": spo2,
        "temperature": temperature,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp
    }