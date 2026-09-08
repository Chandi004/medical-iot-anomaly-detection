from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect
)

import asyncio

from backend.websocket_manager import ConnectionManager 
from fastapi.middleware.cors import CORSMiddleware

from backend.database import get_connection


app = FastAPI(
    title="Medical IoT Monitoring API",
    description="REST API for real-time medical sensor monitoring",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
manager = ConnectionManager()
# ============================================================
# Root
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Medical IoT Monitoring API",
        "status": "running"
    }


# ============================================================
# Health Check
# ============================================================

@app.get("/health")
def health():
    try:
        connection = get_connection()
        connection.close()

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as e:

        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


# ============================================================
# Statistics
# ============================================================

@app.get("/stats")
def get_stats():

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute(
            "SELECT COUNT(*) FROM sensor_readings"
        )
        total_readings = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM alerts"
        )
        total_alerts = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(DISTINCT patient_id) FROM sensor_readings"
        )
        total_patients = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM alerts
            WHERE severity = 'HIGH'
            """
        )
        high_severity_alerts = cursor.fetchone()[0]

        return {
            "total_patients": total_patients,
            "total_readings": total_readings,
            "total_alerts": total_alerts,
            "high_severity_alerts": high_severity_alerts
        }

    finally:

        cursor.close()
        connection.close()


# ============================================================
# Patients
# ============================================================

@app.get("/patients")
def get_patients():

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT DISTINCT ON (patient_id)
                patient_id,
                timestamp,
                heart_rate,
                spo2,
                temperature,
                systolic_bp,
                diastolic_bp,
                status
            FROM sensor_readings
            ORDER BY patient_id, timestamp DESC
            """
        )

        rows = cursor.fetchall()

        patients = []

        for row in rows:

            patients.append({
                "patient_id": row[0],
                "timestamp": row[1],
                "heart_rate": row[2],
                "spo2": row[3],
                "temperature": row[4],
                "systolic_bp": row[5],
                "diastolic_bp": row[6],
                "status": row[7]
            })

        return patients

    finally:

        cursor.close()
        connection.close()


# ============================================================
# Recent Sensor Readings
# ============================================================

@app.get("/readings")
def get_readings(
    patient_id: str | None = Query(
        default=None
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=500
    )
):

    connection = get_connection()
    cursor = connection.cursor()

    try:

        if patient_id:

            cursor.execute(
                """
                SELECT
                    patient_id,
                    timestamp,
                    heart_rate,
                    spo2,
                    temperature,
                    systolic_bp,
                    diastolic_bp,
                    status
                FROM sensor_readings
                WHERE patient_id = %s
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (patient_id, limit)
            )

        else:

            cursor.execute(
                """
                SELECT
                    patient_id,
                    timestamp,
                    heart_rate,
                    spo2,
                    temperature,
                    systolic_bp,
                    diastolic_bp,
                    status
                FROM sensor_readings
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (limit,)
            )

        rows = cursor.fetchall()

        readings = []

        for row in rows:

            readings.append({
                "patient_id": row[0],
                "timestamp": row[1],
                "heart_rate": row[2],
                "spo2": row[3],
                "temperature": row[4],
                "systolic_bp": row[5],
                "diastolic_bp": row[6],
                "status": row[7]
            })

        return readings

    finally:

        cursor.close()
        connection.close()


# ============================================================
# Alerts
# ============================================================

@app.get("/alerts")
def get_alerts(
    patient_id: str | None = Query(
        default=None
    ),
    severity: str | None = Query(
        default=None
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=500
    )
):

    connection = get_connection()
    cursor = connection.cursor()

    try:

        query = """
            SELECT
                id,
                patient_id,
                timestamp,
                alert_type,
                severity,
                message
            FROM alerts
        """

        conditions = []
        parameters = []

        if patient_id:

            conditions.append(
                "patient_id = %s"
            )

            parameters.append(
                patient_id
            )

        if severity:

            conditions.append(
                "severity = %s"
            )

            parameters.append(
                severity
            )

        if conditions:

            query += " WHERE " + " AND ".join(
                conditions
            )

        query += """
            ORDER BY timestamp DESC
            LIMIT %s
        """

        parameters.append(limit)

        cursor.execute(
            query,
            tuple(parameters)
        )

        rows = cursor.fetchall()

        alerts = []

        for row in rows:

            alerts.append({
                "id": row[0],
                "patient_id": row[1],
                "timestamp": row[2],
                "alert_type": row[3],
                "severity": row[4],
                "message": row[5]
            })

        return alerts

    finally:

        cursor.close()
        connection.close()


# ============================================================
# Individual Patient
# ============================================================

@app.get("/patients/{patient_id}")
def get_patient(patient_id: str):

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT
                patient_id,
                timestamp,
                heart_rate,
                spo2,
                temperature,
                systolic_bp,
                diastolic_bp,
                status
            FROM sensor_readings
            WHERE patient_id = %s
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (patient_id,)
        )

        row = cursor.fetchone()

        if not row:

            raise HTTPException(
                status_code=404,
                detail="Patient not found"
            )

        patient = {
            "patient_id": row[0],
            "timestamp": row[1],
            "heart_rate": row[2],
            "spo2": row[3],
            "temperature": row[4],
            "systolic_bp": row[5],
            "diastolic_bp": row[6],
            "status": row[7]
        }

        return patient

    finally:

        cursor.close()
        connection.close()
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    print("WebSocket client connected.")

    try:

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)

        print("WebSocket client disconnected.")

    except Exception:

        manager.disconnect(websocket)
async def monitor_database():

    last_reading_id = 0
    last_alert_id = 0

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute(
            "SELECT COALESCE(MAX(id), 0) FROM sensor_readings"
        )

        last_reading_id = cursor.fetchone()[0]


        cursor.execute(
            "SELECT COALESCE(MAX(id), 0) FROM alerts"
        )

        last_alert_id = cursor.fetchone()[0]

    finally:

        cursor.close()
        connection.close()


    print(
        f"WebSocket database monitor started."
    )

    print(
        f"Starting reading ID: {last_reading_id}"
    )

    print(
        f"Starting alert ID: {last_alert_id}"
    )


    while True:

        try:

            connection = get_connection()
            cursor = connection.cursor()


            # -----------------------------------------
            # NEW SENSOR READINGS
            # -----------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
                    patient_id,
                    timestamp,
                    heart_rate,
                    spo2,
                    temperature,
                    systolic_bp,
                    diastolic_bp,
                    status
                FROM sensor_readings
                WHERE id > %s
                ORDER BY id ASC
                LIMIT 100
                """,
                (last_reading_id,)
            )


            readings = cursor.fetchall()


            for row in readings:

                message = {

                    "type": "reading",

                    "data": {

                        "id": row[0],

                        "patient_id": row[1],

                        "timestamp": row[2].isoformat(),

                        "heart_rate": row[3],

                        "spo2": row[4],

                        "temperature": row[5],

                        "systolic_bp": row[6],

                        "diastolic_bp": row[7],

                        "status": row[8],

                    }

                }


                await manager.broadcast(
                    message
                )


                last_reading_id = row[0]


            # -----------------------------------------
            # NEW ALERTS
            # -----------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
                    patient_id,
                    timestamp,
                    alert_type,
                    severity,
                    message
                FROM alerts
                WHERE id > %s
                ORDER BY id ASC
                LIMIT 100
                """,
                (last_alert_id,)
            )


            alerts = cursor.fetchall()


            for row in alerts:

                message = {

                    "type": "alert",

                    "data": {

                        "id": row[0],

                        "patient_id": row[1],

                        "timestamp": row[2].isoformat(),

                        "alert_type": row[3],

                        "severity": row[4],

                        "message": row[5],

                    }

                }


                await manager.broadcast(
                    message
                )


                last_alert_id = row[0]


            cursor.close()
            connection.close()


        except Exception as e:

            print(
                "WebSocket database monitor error:",
                e
            )


        await asyncio.sleep(1)
@app.on_event("startup")
async def startup_event():

    asyncio.create_task(
        monitor_database()
    )