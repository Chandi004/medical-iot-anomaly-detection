from pyspark.sql.functions import col, when, lit


def detect_anomalies(df):

    # --------------------------------------------------
    # Detect individual abnormal conditions
    # --------------------------------------------------

    analyzed = (
        df
        .withColumn(
            "high_heart_rate",
            col("heart_rate") > 120
        )
        .withColumn(
            "low_spo2",
            col("spo2") < 92
        )
        .withColumn(
            "high_temperature",
            col("temperature") > 38.5
        )
        .withColumn(
            "high_blood_pressure",
            (col("systolic_bp") > 140) |
            (col("diastolic_bp") > 90)
        )
    )

    # --------------------------------------------------
    # Determine the type of alert
    # --------------------------------------------------

    analyzed = analyzed.withColumn(
        "alert_type",
        when(
            col("high_heart_rate"),
            lit("HIGH_HEART_RATE")
        )
        .when(
            col("low_spo2"),
            lit("LOW_SPO2")
        )
        .when(
            col("high_temperature"),
            lit("HIGH_TEMPERATURE")
        )
        .when(
            col("high_blood_pressure"),
            lit("HIGH_BLOOD_PRESSURE")
        )
        .otherwise(
            lit("NONE")
        )
    )

    # --------------------------------------------------
    # Determine overall status
    # --------------------------------------------------

    analyzed = analyzed.withColumn(
        "status",
        when(
            col("alert_type") != "NONE",
            lit("CRITICAL")
        )
        .otherwise(
            lit("NORMAL")
        )
    )

    # --------------------------------------------------
    # Determine severity
    # --------------------------------------------------

    analyzed = analyzed.withColumn(
        "severity",
        when(
            col("alert_type") == "LOW_SPO2",
            lit("HIGH")
        )
        .when(
            col("alert_type") == "HIGH_HEART_RATE",
            lit("HIGH")
        )
        .when(
            col("alert_type") == "HIGH_TEMPERATURE",
            lit("MEDIUM")
        )
        .when(
            col("alert_type") == "HIGH_BLOOD_PRESSURE",
            lit("MEDIUM")
        )
        .otherwise(
            lit("NONE")
        )
    )

    return analyzed