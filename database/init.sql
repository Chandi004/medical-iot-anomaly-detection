CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    heart_rate INTEGER,
    spo2 INTEGER,
    temperature FLOAT,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_sensor_patient
ON sensor_readings(patient_id);


CREATE INDEX IF NOT EXISTS idx_sensor_timestamp
ON sensor_readings(timestamp);


CREATE INDEX IF NOT EXISTS idx_alert_patient
ON alerts(patient_id);