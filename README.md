# Real-Time Medical IoT Sensor Anomaly Detection and Alerting System

A real-time Big Data and IoT analytics system that collects simulated medical sensor data, processes it using Apache Kafka and Apache Spark Structured Streaming, detects abnormal patient readings using rule-based anomaly detection, stores the processed data in PostgreSQL, and provides a real-time web dashboard using React and FastAPI.

---

## Project Overview

Healthcare IoT devices continuously generate vital-sign data such as:

- Heart Rate
- Blood Oxygen Saturation (SpO2)
- Body Temperature
- Systolic Blood Pressure
- Diastolic Blood Pressure

Monitoring this data manually becomes difficult when the volume and frequency of sensor readings increase.

This project demonstrates a real-time data pipeline that:

1. Generates medical IoT sensor readings.
2. Publishes sensor data to Apache Kafka.
3. Processes streaming data using Apache Spark Structured Streaming.
4. Detects abnormal readings using predefined medical thresholds.
5. Prevents repeated duplicate alerts using a cooldown mechanism.
6. Stores sensor readings and alerts in PostgreSQL.
7. Exposes the processed data through a FastAPI backend.
8. Displays real-time patient monitoring information through a React dashboard.
9. Uses WebSockets to update the dashboard in real time.

---

## System Architecture

```text
                    ┌─────────────────────────┐
                    │  Python Sensor Simulator│
                    │                         │
                    │  Heart Rate             │
                    │  SpO2                   │
                    │  Temperature            │
                    │  Blood Pressure         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Apache Kafka        │
                    │                         │
                    │ medical-sensor-data     │
                    └────────────┬────────────┘
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │ Apache Spark Structured Streaming   │
              │                                     │
              │ • JSON Parsing                      │
              │ • Stream Processing                 │
              │ • Rule-Based Anomaly Detection      │
              │ • Alert Generation                  │
              │ • Alert Cooldown                    │
              └────────────────┬────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │      PostgreSQL         │
                    │                         │
                    │ sensor_readings         │
                    │ alerts                  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       FastAPI           │
                    │                         │
                    │ REST API + WebSocket    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     React Dashboard     │
                    │                         │
                    │ • Patient Monitoring    │
                    │ • Sensor Charts         │
                    │ • Alerts                │
                    │ • Analytics             │
                    │ • Real-Time Updates      │
                    └─────────────────────────┘
