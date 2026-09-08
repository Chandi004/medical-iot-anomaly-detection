from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json,
    col,
    to_timestamp,
    concat,
    lit,
    when
)
from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    IntegerType,
    DoubleType
)

import psycopg2

from anomaly_detector import detect_anomalies


# ============================================================
# Configuration
# ============================================================

ALERT_COOLDOWN_SECONDS = 30


# ============================================================
# Spark Session
# ============================================================

spark = (
    SparkSession.builder
    .appName("MedicalIoTStreaming")
    .master("local[*]")

    # --------------------------------------------------------
    # Hadoop / Local Filesystem Configuration
    # --------------------------------------------------------
    .config(
        "spark.hadoop.fs.defaultFS",
        "file:///"
    )
    .config(
        "spark.hadoop.fs.file.impl",
        "org.apache.hadoop.fs.LocalFileSystem"
    )
    .config(
        "spark.hadoop.fs.file.impl.disable.cache",
        "true"
    )

    # --------------------------------------------------------
    # Streaming checkpoint cleanup
    # --------------------------------------------------------
    .config(
        "spark.sql.streaming.forceDeleteTempCheckpointLocation",
        "true"
    )

    .getOrCreate()
)


spark.sparkContext.setLogLevel("WARN")


# ============================================================
# PostgreSQL Configuration
# ============================================================

# IMPORTANT:
# These names refer to Docker Compose service names.
#
# PostgreSQL container/service:
#     postgres
#
# PostgreSQL port inside Docker network:
#     5432

DB_HOST = "postgres"
DB_PORT = "5432"
DB_NAME = "medical_iot"
DB_USER = "medical_user"
DB_PASSWORD = "medical_pass"


# ============================================================
# Kafka Sensor Data Schema
# ============================================================

schema = StructType([
    StructField(
        "patient_id",
        StringType(),
        True
    ),

    StructField(
        "timestamp",
        StringType(),
        True
    ),

    StructField(
        "heart_rate",
        IntegerType(),
        True
    ),

    StructField(
        "spo2",
        IntegerType(),
        True
    ),

    StructField(
        "temperature",
        DoubleType(),
        True
    ),

    StructField(
        "systolic_bp",
        IntegerType(),
        True
    ),

    StructField(
        "diastolic_bp",
        IntegerType(),
        True
    )
])


# ============================================================
# Read Data From Kafka
# ============================================================

raw_stream = (
    spark
    .readStream
    .format("kafka")

    # IMPORTANT:
    # "kafka" is the Docker Compose Kafka service name.
    .option(
        "kafka.bootstrap.servers",
        "kafka:9092"
    )

    .option(
        "subscribe",
        "medical-sensor-data"
    )

    # Start from new messages when the streaming query begins.
    .option(
        "startingOffsets",
        "latest"
    )

    .load()
)


# ============================================================
# Parse Kafka JSON
# ============================================================

sensor_stream = (
    raw_stream

    # Convert Kafka binary value to string.
    .selectExpr(
        "CAST(value AS STRING) AS json_value"
    )

    # Convert JSON string into structured data.
    .select(
        from_json(
            col("json_value"),
            schema
        ).alias("data")
    )

    # Extract individual fields.
    .select("data.*")
)


# ============================================================
# Convert Timestamp
# ============================================================

sensor_stream = sensor_stream.withColumn(
    "event_time",
    to_timestamp("timestamp")
)


# ============================================================
# Detect Anomalies
# ============================================================

analyzed_stream = detect_anomalies(
    sensor_stream
)


# ============================================================
# Create Readable Alert Message
# ============================================================

analyzed_stream = analyzed_stream.withColumn(
    "alert_message",

    # --------------------------------------------------------
    # High Heart Rate
    # --------------------------------------------------------
    when(
        col("alert_type") == "HIGH_HEART_RATE",

        concat(
            lit("Patient "),
            col("patient_id"),
            lit(" has high heart rate: "),
            col("heart_rate").cast("string")
        )
    )

    # --------------------------------------------------------
    # Low SpO2
    # --------------------------------------------------------
    .when(
        col("alert_type") == "LOW_SPO2",

        concat(
            lit("Patient "),
            col("patient_id"),
            lit(" has low SpO2: "),
            col("spo2").cast("string")
        )
    )

    # --------------------------------------------------------
    # High Temperature
    # --------------------------------------------------------
    .when(
        col("alert_type") == "HIGH_TEMPERATURE",

        concat(
            lit("Patient "),
            col("patient_id"),
            lit(" has high temperature: "),
            col("temperature").cast("string")
        )
    )

    # --------------------------------------------------------
    # High Blood Pressure
    # --------------------------------------------------------
    .when(
        col("alert_type") == "HIGH_BLOOD_PRESSURE",

        concat(
            lit("Patient "),
            col("patient_id"),
            lit(" has high blood pressure: "),
            col("systolic_bp").cast("string"),
            lit("/"),
            col("diastolic_bp").cast("string")
        )
    )

    # --------------------------------------------------------
    # Normal reading
    # --------------------------------------------------------
    .otherwise(
        lit(None)
    )
)


# ============================================================
# Function: Save Spark Batch to PostgreSQL
# ============================================================

def save_to_postgresql(batch_df, batch_id):

    print()
    print("========================================")
    print(f"Processing Spark Batch: {batch_id}")
    print("========================================")


    # ========================================================
    # Avoid processing empty batches
    # ========================================================

    if batch_df.isEmpty():

        print("Batch is empty.")

        return


    # ========================================================
    # PostgreSQL Connection
    # ========================================================

    connection = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

    cursor = connection.cursor()


    try:

        # ====================================================
        # Save ALL Sensor Readings
        # ====================================================

        readings = batch_df.select(
            "patient_id",
            "event_time",
            "heart_rate",
            "spo2",
            "temperature",
            "systolic_bp",
            "diastolic_bp",
            "status"
        ).collect()


        # ----------------------------------------------------
        # Sensor reading INSERT query
        # ----------------------------------------------------

        reading_insert_query = """
            INSERT INTO sensor_readings
            (
                patient_id,
                timestamp,
                heart_rate,
                spo2,
                temperature,
                systolic_bp,
                diastolic_bp,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """


        # ----------------------------------------------------
        # Insert each sensor reading
        # ----------------------------------------------------

        for row in readings:

            cursor.execute(
                reading_insert_query,
                (
                    row["patient_id"],
                    row["event_time"],
                    row["heart_rate"],
                    row["spo2"],
                    row["temperature"],
                    row["systolic_bp"],
                    row["diastolic_bp"],
                    row["status"]
                )
            )


        print(
            f"Saved {len(readings)} sensor readings."
        )


        # ====================================================
        # Find Abnormal Readings
        # ====================================================

        alerts_df = batch_df.filter(
            col("alert_type") != "NONE"
        )


        # ====================================================
        # Collect Alert Information
        # ====================================================

        # IMPORTANT:
        # Use event_time instead of the original timestamp
        # string so Python can calculate cooldown intervals.

        alerts = alerts_df.select(
            "patient_id",
            "event_time",
            "alert_type",
            "severity",
            "alert_message"
        ).collect()


        # ====================================================
        # Alert INSERT Query
        # ====================================================

        alert_insert_query = """
            INSERT INTO alerts
            (
                patient_id,
                timestamp,
                alert_type,
                severity,
                message
            )
            VALUES (%s, %s, %s, %s, %s)
        """


        # ====================================================
        # Previous Alert Query
        # ====================================================

        # Cooldown is calculated independently for:
        #
        # patient_id + alert_type
        #
        # Example:
        #
        # P003 + HIGH_TEMPERATURE
        #
        # has its own 30-second cooldown.

        cooldown_query = """
            SELECT timestamp
            FROM alerts
            WHERE patient_id = %s
              AND alert_type = %s
            ORDER BY timestamp DESC
            LIMIT 1
        """


        inserted_alerts = 0

        suppressed_alerts = 0


        # ====================================================
        # Process Abnormal Readings
        # ====================================================

        for row in alerts:

            patient_id = row["patient_id"]

            # IMPORTANT:
            # Use event_time instead of the original timestamp.
            timestamp = row["event_time"]

            alert_type = row["alert_type"]

            severity = row["severity"]

            message = row["alert_message"]


            # ------------------------------------------------
            # Find most recent alert for this patient/type
            # ------------------------------------------------

            cursor.execute(
                cooldown_query,
                (
                    patient_id,
                    alert_type
                )
            )


            previous_alert = cursor.fetchone()


            should_insert = True


            # ------------------------------------------------
            # Check 30-second cooldown
            # ------------------------------------------------

            if previous_alert:

                previous_timestamp = previous_alert[0]


                time_difference = (
                    timestamp - previous_timestamp
                ).total_seconds()


                if (
                    time_difference
                    < ALERT_COOLDOWN_SECONDS
                ):

                    should_insert = False


            # ------------------------------------------------
            # Insert New Alert
            # ------------------------------------------------

            if should_insert:

                cursor.execute(
                    alert_insert_query,
                    (
                        patient_id,
                        timestamp,
                        alert_type,
                        severity,
                        message
                    )
                )

                inserted_alerts += 1


            # ------------------------------------------------
            # Suppress Duplicate Alert
            # ------------------------------------------------

            else:

                suppressed_alerts += 1


        # ====================================================
        # Alert Statistics
        # ====================================================

        print(
            f"Saved {inserted_alerts} alerts."
        )

        print(
            f"Suppressed {suppressed_alerts} duplicate alerts."
        )


        # ====================================================
        # Commit PostgreSQL Transaction
        # ====================================================

        connection.commit()


        print(
            "PostgreSQL transaction committed successfully."
        )


    except Exception as e:

        # ====================================================
        # Rollback on Error
        # ====================================================

        connection.rollback()


        print(
            "ERROR while saving batch:"
        )

        print(e)


        raise


    finally:

        # ====================================================
        # Close PostgreSQL Resources
        # ====================================================

        cursor.close()

        connection.close()


    print("========================================")
    print()


# ============================================================
# Start Streaming Query
# ============================================================

query = (
    analyzed_stream

    .writeStream

    .foreachBatch(
        save_to_postgresql
    )

    .outputMode(
        "append"
    )

    # ========================================================
    # IMPORTANT DOCKER CHECKPOINT PATH
    # ========================================================
    #
    # DO NOT use:
    #
    # D:/medical-iot-anomaly-detection/checkpoints/sensor_stream
    #
    # That is a Windows path and does not exist inside the
    # Linux Spark Docker container.
    #
    # Instead, Spark uses:
    #
    # /opt/spark/checkpoints/sensor_stream
    #
    # This directory should be mapped to the Docker volume:
    #
    # spark_checkpoints:/opt/spark/checkpoints
    #
    # ========================================================

    .option(
        "checkpointLocation",
        "/opt/spark/checkpoints/sensor_stream"
    )

    .start()
)


# ============================================================
# Startup Message
# ============================================================

print("========================================")
print("Medical IoT Spark Streaming Started")
print("========================================")

print(
    "Kafka Topic: medical-sensor-data"
)

print(
    "Kafka Server: kafka:9092"
)

print(
    "PostgreSQL Database: medical_iot"
)

print(
    "PostgreSQL Host: postgres"
)

print(
    f"Alert Cooldown: {ALERT_COOLDOWN_SECONDS} seconds"
)

print(
    "Checkpoint: /opt/spark/checkpoints/sensor_stream"
)

print("========================================")


# ============================================================
# Keep Streaming Application Running
# ============================================================

query.awaitTermination()