import { useEffect, useState, useRef } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "./App.css";

import {
  getStats,
  getPatients,
  getReadings,
  getAlerts,
} from "./api";

import { connectWebSocket } from "./websocket";


function App() {

  // ==================================================
  // STATE
  // ==================================================

  const [patients, setPatients] = useState([]);

  const [selectedPatient, setSelectedPatient] =
    useState("P001");

  const [sensorData, setSensorData] =
    useState([]);

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [alerts, setAlerts] =
    useState([]);


  // ==================================================
  // STEP 8 - NOTIFICATION STATE
  // ==================================================

  const [notification, setNotification] =
    useState(null);

  const [unreadAlertIds, setUnreadAlertIds] =
    useState([]);

  const notificationTimerRef =
    useRef(null);


  // ==================================================
  // ALERT FILTER STATE
  // ==================================================

  const [alertSeverityFilter, setAlertSeverityFilter] =
    useState("ALL");

  const [alertPatientFilter, setAlertPatientFilter] =
    useState("ALL");


  // ==================================================
  // DASHBOARD STATISTICS
  // ==================================================

  const [stats, setStats] = useState({
    total_patients: 0,
    total_readings: 0,
    total_alerts: 0,
    high_severity_alerts: 0,
  });


  // ==================================================
  // LOADING / ERROR STATE
  // ==================================================

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);


  // ==================================================
  // SELECTED PATIENT REF
  // ==================================================

  const selectedPatientRef =
    useRef(selectedPatient);


  useEffect(() => {

    selectedPatientRef.current =
      selectedPatient;

  }, [selectedPatient]);


  // ==================================================
  // STEP 8 - SHOW REAL-TIME NOTIFICATION
  // ==================================================

  const showNotification = (alert) => {

    setNotification({
      id: alert.id || Date.now(),
      severity: alert.severity,
      alert_type: alert.alert_type,
      patient_id: alert.patient_id,
      message: alert.message,
      timestamp: alert.timestamp,
    });


    if (notificationTimerRef.current) {

      clearTimeout(
        notificationTimerRef.current
      );

    }


    notificationTimerRef.current =
      setTimeout(() => {

        setNotification(null);

      }, 7000);

  };


  // ==================================================
  // STEP 8 - DISMISS NOTIFICATION
  // ==================================================

  const dismissNotification = () => {

    setNotification(null);

    if (notificationTimerRef.current) {

      clearTimeout(
        notificationTimerRef.current
      );

      notificationTimerRef.current = null;

    }

  };


  // ==================================================
  // STEP 8 - MARK ALERT AS READ
  // ==================================================

  const markAlertAsRead = (alertId) => {

    setUnreadAlertIds(
      (previous) =>
        previous.filter(
          (id) => id !== alertId
        )
    );

  };


  // ==================================================
  // STEP 8 - MARK ALL ALERTS AS READ
  // ==================================================

  const markAllAlertsAsRead = () => {

    setUnreadAlertIds([]);

  };


  // ==================================================
  // STEP 8 - CLEANUP NOTIFICATION TIMER
  // ==================================================

  useEffect(() => {

    return () => {

      if (notificationTimerRef.current) {

        clearTimeout(
          notificationTimerRef.current
        );

      }

    };

  }, []);


  // ==================================================
  // LOAD DASHBOARD DATA
  // ==================================================

  const loadDashboardData = async () => {

    try {

      const [
        statsData,
        patientsData,
        alertsData,
      ] = await Promise.all([

        getStats(),

        getPatients(),

        getAlerts(
          null,
          null,
          20
        ),

      ]);


      setStats(statsData);

      setPatients(patientsData);

      setAlerts(alertsData);

      // Existing alerts loaded from PostgreSQL
      // are considered already viewed.
      setUnreadAlertIds([]);

      setError(null);

    } catch (err) {

      console.error(
        "Failed to load dashboard data:",
        err
      );

      setError(
        "Unable to connect to the monitoring API."
      );

    } finally {

      setLoading(false);

    }

  };


  // ==================================================
  // LOAD SELECTED PATIENT READINGS
  // ==================================================

  const loadPatientReadings = async () => {

    try {

      const readings =
        await getReadings(
          selectedPatient,
          20
        );


      const formattedReadings =
        [...readings]
          .reverse()
          .map((reading) => ({

            time:
              new Date(
                reading.timestamp
              ).toLocaleTimeString(),

            heartRate:
              reading.heart_rate,

            spo2:
              reading.spo2,

            temperature:
              reading.temperature,

          }));


      setSensorData(
        formattedReadings
      );

      setError(null);

    } catch (err) {

      console.error(
        "Failed to load patient readings:",
        err
      );

      setError(
        "Unable to load patient sensor readings."
      );

    }

  };


  // ==================================================
  // INITIAL DASHBOARD LOAD
  // ==================================================

  useEffect(() => {

    loadDashboardData();

  }, []);


  // ==================================================
  // LOAD HISTORICAL READINGS
  // ==================================================

  useEffect(() => {

    loadPatientReadings();

  }, [selectedPatient]);


  // ==================================================
  // SINGLE WEBSOCKET CONNECTION
  // ==================================================

  useEffect(() => {

    console.log(
      "Starting WebSocket connection..."
    );


    const socket =
      connectWebSocket(

        // ============================================
        // HANDLE WEBSOCKET MESSAGE
        // ============================================

        (message) => {

          console.log(
            "WebSocket message:",
            message
          );


          // ==========================================
          // NEW SENSOR READING
          // ==========================================

          if (
            message.type === "reading"
          ) {

            const reading =
              message.data;


            console.log(
              "New sensor reading:",
              reading
            );


            // ----------------------------------------
            // UPDATE SELECTED PATIENT CHART
            // ----------------------------------------

            if (
              reading.patient_id ===
              selectedPatientRef.current
            ) {

              const newPoint = {

                time:
                  new Date(
                    reading.timestamp
                  ).toLocaleTimeString(),

                heartRate:
                  reading.heart_rate,

                spo2:
                  reading.spo2,

                temperature:
                  reading.temperature,

              };


              setSensorData(
                (previous) => [

                  ...previous,

                  newPoint,

                ].slice(-20)
              );

            }


            // ----------------------------------------
            // UPDATE PATIENT LIST
            // ----------------------------------------

            setPatients(
              (previous) =>

                previous.map(
                  (patient) => {

                    if (
                      patient.patient_id !==
                      reading.patient_id
                    ) {

                      return patient;

                    }


                    return {

                      ...patient,

                      timestamp:
                        reading.timestamp,

                      heart_rate:
                        reading.heart_rate,

                      spo2:
                        reading.spo2,

                      temperature:
                        reading.temperature,

                      systolic_bp:
                        reading.systolic_bp,

                      diastolic_bp:
                        reading.diastolic_bp,

                      status:
                        reading.status,

                    };

                  }
                )
            );


            // ----------------------------------------
            // UPDATE TOTAL READING COUNT
            // ----------------------------------------

            setStats(
              (previous) => ({

                ...previous,

                total_readings:
                  previous.total_readings + 1,

              })
            );

          }


          // ==========================================
          // NEW ALERT
          // ==========================================

          if (
            message.type === "alert"
          ) {

            const alert =
              message.data;


            console.log(
              "New alert:",
              alert
            );


            // ----------------------------------------
            // ADD ALERT TO TOP OF LIST
            // ----------------------------------------

            setAlerts(
              (previous) => [

                alert,

                ...previous,

              ].slice(0, 20)
            );


            // ----------------------------------------
            // STEP 8 - MARK NEW ALERT UNREAD
            // ----------------------------------------

            const alertId =
              alert.id || Date.now();


            setUnreadAlertIds(
              (previous) => {

                if (
                  previous.includes(
                    alertId
                  )
                ) {

                  return previous;

                }

                return [
                  alertId,
                  ...previous,
                ];

              }
            );


            // ----------------------------------------
            // STEP 8 - SHOW REAL-TIME NOTIFICATION
            // ----------------------------------------

            showNotification(alert);


            // ----------------------------------------
            // UPDATE ALERT STATISTICS
            // ----------------------------------------

            setStats(
              (previous) => ({

                ...previous,

                total_alerts:
                  previous.total_alerts + 1,

                high_severity_alerts:

                  alert.severity === "HIGH"

                    ? previous.high_severity_alerts + 1

                    : previous.high_severity_alerts,

              })
            );

          }

        },


        // ============================================
        // WEBSOCKET CONNECTION STATUS
        // ============================================

        (connected) => {

          console.log(
            "WebSocket connection status:",
            connected
          );


          setSocketConnected(
            connected
          );

        }

      );


    // ==============================================
    // CLEANUP
    // ==============================================

    return () => {

      console.log(
        "Closing WebSocket connection..."
      );


      socket.close();

    };

  }, []);


  // ==================================================
  // CURRENT PATIENT
  // ==================================================

  const currentPatient =
    patients.find(
      (patient) =>
        patient.patient_id ===
        selectedPatient
    );


  // ==================================================
  // LATEST SENSOR READING
  // ==================================================

  const latest =
    sensorData.length > 0

      ? sensorData[
          sensorData.length - 1
        ]

      : {

          heartRate: "--",

          spo2: "--",

          temperature: "--",

        };


  // ==================================================
  // NORMAL PATIENT COUNT
  // ==================================================

  const normalPatients =
    patients.filter(
      (patient) =>
        patient.status ===
        "NORMAL"
    ).length;


  // ==================================================
  // UNREAD ALERT COUNT
  // ==================================================

  const unreadAlertCount =
    unreadAlertIds.length;


  // ==================================================
  // FILTERED ALERTS
  // ==================================================

  const filteredAlerts =
    alerts.filter((alert) => {

      const severityMatches =
        alertSeverityFilter === "ALL" ||
        alert.severity ===
          alertSeverityFilter;


      const patientMatches =
        alertPatientFilter === "ALL" ||
        alert.patient_id ===
          alertPatientFilter;


      return (
        severityMatches &&
        patientMatches
      );

    });


  // ==================================================
  // CURRENT PATIENT ANOMALY
  // ==================================================

  const selectedPatientHasAnomaly =
    currentPatient &&
    currentPatient.status !==
      "NORMAL";


  // ==================================================
  // SENSOR STATUS HELPERS
  // ==================================================

  const getSensorStatus = (type, value) => {

    if (
      value === "--" ||
      value === null ||
      value === undefined
    ) {

      return {

        label: "NO DATA",

        color: "#64748b",

        background: "#f1f5f9",

      };

    }


    if (type === "heartRate") {

      return value > 120

        ? {

            label: "HIGH",

            color: "#dc2626",

            background: "#fee2e2",

          }

        : {

            label: "NORMAL",

            color: "#059669",

            background: "#ecfdf5",

          };

    }


    if (type === "spo2") {

      return value < 92

        ? {

            label: "LOW",

            color: "#dc2626",

            background: "#fee2e2",

          }

        : {

            label: "NORMAL",

            color: "#059669",

            background: "#ecfdf5",

          };

    }


    if (type === "temperature") {

      return value > 38.5

        ? {

            label: "HIGH",

            color: "#dc2626",

            background: "#fee2e2",

          }

        : {

            label: "NORMAL",

            color: "#059669",

            background: "#ecfdf5",

          };

    }


    if (type === "bloodPressure") {

      if (
        !value ||
        value.systolic_bp === null ||
        value.systolic_bp === undefined ||
        value.diastolic_bp === null ||
        value.diastolic_bp === undefined
      ) {

        return {

          label: "NO DATA",

          color: "#64748b",

          background: "#f1f5f9",

        };

      }


      return (

        value.systolic_bp > 140 ||
        value.diastolic_bp > 90

      )

        ? {

            label: "HIGH",

            color: "#dc2626",

            background: "#fee2e2",

          }

        : {

            label: "NORMAL",

            color: "#059669",

            background: "#ecfdf5",

          };

    }


    return {

      label: "NO DATA",

      color: "#64748b",

      background: "#f1f5f9",

    };

  };


  const heartRateStatus =
    getSensorStatus(
      "heartRate",
      latest.heartRate
    );


  const spo2Status =
    getSensorStatus(
      "spo2",
      latest.spo2
    );


  const temperatureStatus =
    getSensorStatus(
      "temperature",
      latest.temperature
    );


  const bloodPressureStatus =
    getSensorStatus(
      "bloodPressure",
      currentPatient
    );


  // ==================================================
  // ABNORMAL SENSOR LIST
  // ==================================================

  const abnormalSensors = [];


  if (
    heartRateStatus.label ===
    "HIGH"
  ) {

    abnormalSensors.push(
      `High heart rate (${latest.heartRate} BPM)`
    );

  }


  if (
    spo2Status.label ===
    "LOW"
  ) {

    abnormalSensors.push(
      `Low SpO₂ (${latest.spo2}%)`
    );

  }


  if (
    temperatureStatus.label ===
    "HIGH"
  ) {

    abnormalSensors.push(
      `High temperature (${latest.temperature} °C)`
    );

  }


  if (
    bloodPressureStatus.label ===
    "HIGH"
  ) {

    abnormalSensors.push(

      `High blood pressure (${currentPatient?.systolic_bp}/${currentPatient?.diastolic_bp} mmHg)`

    );

  }


  // ==================================================
  // MONITORING STATUS
  // ==================================================

  const monitoringStatus =
    abnormalSensors.length > 0

      ? "ATTENTION REQUIRED"

      : "NORMAL";


  const monitoringStatusColor =
    abnormalSensors.length > 0

      ? "#dc2626"

      : "#059669";


  const monitoringStatusBackground =
    abnormalSensors.length > 0

      ? "#fef2f2"

      : "#ecfdf5";


  // ==================================================
  // STEP 7
  // DASHBOARD ANALYTICS
  // ==================================================

  const numericSensorData =
    sensorData.filter(
      (reading) =>
        typeof reading.heartRate === "number" &&
        typeof reading.spo2 === "number" &&
        typeof reading.temperature === "number"
    );


  // --------------------------------------------------
  // HEART RATE ANALYTICS
  // --------------------------------------------------

  const averageHeartRate =
    numericSensorData.length > 0

      ? numericSensorData.reduce(
          (sum, reading) =>
            sum + reading.heartRate,
          0
        ) / numericSensorData.length

      : null;


  const minimumHeartRate =
    numericSensorData.length > 0

      ? Math.min(
          ...numericSensorData.map(
            (reading) =>
              reading.heartRate
          )
        )

      : null;


  const maximumHeartRate =
    numericSensorData.length > 0

      ? Math.max(
          ...numericSensorData.map(
            (reading) =>
              reading.heartRate
          )
        )

      : null;


  // --------------------------------------------------
  // SPO2 ANALYTICS
  // --------------------------------------------------

  const averageSpo2 =
    numericSensorData.length > 0

      ? numericSensorData.reduce(
          (sum, reading) =>
            sum + reading.spo2,
          0
        ) / numericSensorData.length

      : null;


  const minimumSpo2 =
    numericSensorData.length > 0

      ? Math.min(
          ...numericSensorData.map(
            (reading) =>
              reading.spo2
          )
        )

      : null;


  const maximumSpo2 =
    numericSensorData.length > 0

      ? Math.max(
          ...numericSensorData.map(
            (reading) =>
              reading.spo2
          )
        )

      : null;


  // --------------------------------------------------
  // TEMPERATURE ANALYTICS
  // --------------------------------------------------

  const averageTemperature =
    numericSensorData.length > 0

      ? numericSensorData.reduce(
          (sum, reading) =>
            sum + reading.temperature,
          0
        ) / numericSensorData.length

      : null;


  const minimumTemperature =
    numericSensorData.length > 0

      ? Math.min(
          ...numericSensorData.map(
            (reading) =>
              reading.temperature
          )
        )

      : null;


  const maximumTemperature =
    numericSensorData.length > 0

      ? Math.max(
          ...numericSensorData.map(
            (reading) =>
              reading.temperature
          )
        )

      : null;


  // --------------------------------------------------
  // SELECTED PATIENT ALERTS
  // --------------------------------------------------

  const selectedPatientAlerts =
    alerts.filter(
      (alert) =>
        alert.patient_id ===
        selectedPatient
    );


  const selectedPatientHighAlerts =
    selectedPatientAlerts.filter(
      (alert) =>
        alert.severity === "HIGH"
    ).length;


  const selectedPatientMediumAlerts =
    selectedPatientAlerts.filter(
      (alert) =>
        alert.severity === "MEDIUM"
    ).length;


  // --------------------------------------------------
  // CURRENT VS AVERAGE
  // --------------------------------------------------

  const heartRateDifference =
    averageHeartRate !== null &&
    typeof latest.heartRate === "number"

      ? latest.heartRate -
        averageHeartRate

      : null;


  const spo2Difference =
    averageSpo2 !== null &&
    typeof latest.spo2 === "number"

      ? latest.spo2 -
        averageSpo2

      : null;


  const temperatureDifference =
    averageTemperature !== null &&
    typeof latest.temperature === "number"

      ? latest.temperature -
        averageTemperature

      : null;


  const analyticsAvailable =
    numericSensorData.length > 0;


  // ==================================================
  // NOTIFICATION DISPLAY HELPERS
  // ==================================================

  const notificationIsHigh =
    notification?.severity === "HIGH";


  const notificationTitle =
    notification?.alert_type

      ? notification.alert_type
          .replaceAll("_", " ")
          .replace(
            /\b\w/g,
            (char) =>
              char.toUpperCase()
          )

      : "New Alert";


  // ==================================================
  // RENDER
  // ==================================================

  return (

    <div className="dashboard">


      {/* ============================================
          STEP 8 - REAL-TIME ALERT TOAST
      ============================================ */}

      {notification && (

        <div
          style={{
            position: "fixed",
            top: "22px",
            right: "22px",
            width: "360px",
            maxWidth: "calc(100vw - 44px)",
            zIndex: 9999,
            background: "#ffffff",
            borderRadius: "14px",
            border:
              notificationIsHigh
                ? "1px solid #fecaca"
                : "1px solid #fed7aa",
            boxShadow:
              "0 18px 45px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
          }}
        >

          {/* NOTIFICATION TOP BORDER */}

          <div
            style={{
              height: "4px",
              background:
                notificationIsHigh
                  ? "#dc2626"
                  : "#d97706",
            }}
          />


          <div
            style={{
              padding: "16px",
            }}
          >

            {/* HEADER */}

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >

                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      notificationIsHigh
                        ? "#fee2e2"
                        : "#ffedd5",
                    color:
                      notificationIsHigh
                        ? "#dc2626"
                        : "#d97706",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  !
                </div>


                <div>

                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color:
                        notificationIsHigh
                          ? "#dc2626"
                          : "#d97706",
                      letterSpacing: "0.5px",
                    }}
                  >
                    REAL-TIME ALERT
                  </div>


                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#0f172a",
                    }}
                  >
                    {notificationTitle}
                  </div>

                </div>

              </div>


              {/* CLOSE */}

              <button
                onClick={dismissNotification}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: "20px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>

            </div>


            {/* PATIENT */}

            <div
              style={{
                marginTop: "13px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#475569",
              }}
            >
              Patient {notification.patient_id}
            </div>


            {/* MESSAGE */}

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                lineHeight: "1.5",
                color: "#64748b",
              }}
            >
              {notification.message}
            </div>


            {/* FOOTER */}

            <div
              style={{
                marginTop: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >

              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background:
                    notificationIsHigh
                      ? "#fee2e2"
                      : "#ffedd5",
                  color:
                    notificationIsHigh
                      ? "#dc2626"
                      : "#c2410c",
                  fontSize: "10px",
                  fontWeight: "700",
                }}
              >
                {notification.severity}
              </span>


              <span
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                }}
              >
                {notification.timestamp
                  ? new Date(
                      notification.timestamp
                    ).toLocaleTimeString()
                  : "Just now"}
              </span>

            </div>

          </div>

        </div>

      )}


      {/* ============================================
          HEADER
      ============================================ */}

      <header className="header">

        <div>

          <h1>
            Medical IoT Monitoring
          </h1>

          <p>
            Real-Time Sensor Anomaly Detection System
          </p>

        </div>


        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >

          {/* STEP 8 - UNREAD ALERT BADGE */}

          <div
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              background:
                unreadAlertCount > 0
                  ? "#fef2f2"
                  : "#f8fafc",
              color:
                unreadAlertCount > 0
                  ? "#dc2626"
                  : "#64748b",
              border:
                unreadAlertCount > 0
                  ? "1px solid #fecaca"
                  : "1px solid #e2e8f0",
              fontSize: "12px",
              fontWeight: "700",
            }}
          >

            🔔 {unreadAlertCount} unread

          </div>


          {/* WEBSOCKET STATUS */}

          <div
            className="status"
            style={{
              backgroundColor:
                socketConnected
                  ? "#ecfdf5"
                  : "#fef2f2",

              color:
                socketConnected
                  ? "#059669"
                  : "#dc2626",
            }}
          >

            <span
              className="status-dot"
              style={{
                backgroundColor:
                  socketConnected
                    ? "#22c55e"
                    : "#ef4444",
              }}
            >
            </span>


            {socketConnected
              ? "System Online"
              : "Connecting..."}

          </div>

        </div>

      </header>


      {/* ============================================
          ERROR
      ============================================ */}

      {error && (

        <div
          style={{
            margin: "15px 0",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#fff1f2",
            color: "#dc2626",
            border:
              "1px solid #fecdd3",
          }}
        >

          {error}

        </div>

      )}


      {/* ============================================
          STATS
      ============================================ */}

      <section className="stats-grid">


        {/* TOTAL PATIENTS */}

        <div className="stat-card">

          <div className="stat-title">
            Total Patients
          </div>

          <div className="stat-value">

            {loading
              ? "..."
              : stats.total_patients}

          </div>

          <div className="stat-description">
            Active monitoring
          </div>

        </div>


        {/* NORMAL PATIENTS */}

        <div className="stat-card">

          <div className="stat-title">
            Normal
          </div>

          <div className="stat-value normal">

            {loading
              ? "..."
              : normalPatients}

          </div>

          <div className="stat-description">
            Currently stable
          </div>

        </div>


        {/* HIGH SEVERITY ALERTS */}

        <div className="stat-card">

          <div className="stat-title">
            Critical Alerts
          </div>

          <div className="stat-value critical">

            {loading
              ? "..."
              : stats.high_severity_alerts}

          </div>

          <div className="stat-description">
            High-severity events
          </div>

        </div>


        {/* DATA STREAM */}

        <div className="stat-card">

          <div className="stat-title">
            Data Stream
          </div>

          <div className="stat-value online">
            LIVE
          </div>

          <div className="stat-description">

            {socketConnected
              ? "WebSocket streaming"
              : "Connecting to stream..."}

          </div>

        </div>

      </section>


      {/* ============================================
          MAIN CONTENT
      ============================================ */}

      <div className="main-grid">


        {/* ==========================================
            PATIENT LIST
        ========================================== */}

        <section className="panel">

          <div className="panel-header">

            <h2>
              Patient {selectedPatient}
            </h2>


            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >

              {currentPatient && (

                <span
                  style={{
                    padding:
                      "6px 12px",

                    borderRadius:
                      "20px",

                    fontSize:
                      "12px",

                    fontWeight:
                      "600",

                    background:
                      currentPatient.status ===
                      "NORMAL"

                        ? "#ecfdf5"
                        : "#fef2f2",

                    color:
                      currentPatient.status ===
                      "NORMAL"

                        ? "#059669"
                        : "#dc2626",
                  }}
                >

                  {selectedPatientHasAnomaly
                    ? "ATTENTION"
                    : "NORMAL"}

                </span>

              )}


              <span
                className="live-label"
                style={{
                  background:
                    socketConnected
                      ? "#ecfdf5"
                      : "#fef2f2",

                  color:
                    socketConnected
                      ? "#059669"
                      : "#dc2626",
                }}
              >

                {socketConnected
                  ? "● LIVE"
                  : "● CONNECTING"}

              </span>

            </div>

          </div>


          {/* PATIENT LIST */}

          <div className="patient-list">

            {patients.map(
              (patient) => {

                const patientId =
                  patient.patient_id;


                const hasAnomaly =
                  patient.status !==
                  "NORMAL";


                return (

                  <button
                    key={patientId}

                    className={`patient-card ${
                      selectedPatient ===
                      patientId
                        ? "selected"
                        : ""
                    }`}

                    onClick={() =>
                      setSelectedPatient(
                        patientId
                      )
                    }
                  >

                    <div className="patient-info">

                      <div className="patient-avatar">

                        {patientId.replace(
                          "P",
                          ""
                        )}

                      </div>


                      <div>

                        <strong>
                          Patient {patientId}
                        </strong>

                        <span>
                          IoT Sensor Connected
                        </span>

                      </div>

                    </div>


                    <div
                      className={
                        hasAnomaly
                          ? "patient-status danger"
                          : "patient-status"
                      }
                    >

                      {hasAnomaly
                        ? "Attention"
                        : "Normal"}

                    </div>

                  </button>

                );

              }
            )}

          </div>

        </section>


        {/* ==========================================
            CURRENT READING
        ========================================== */}

        <section className="panel">

          <div className="panel-header">

            <h2>
              Patient {selectedPatient}
            </h2>


            <span
              className="live-label"
              style={{
                background:
                  socketConnected
                    ? "#ecfdf5"
                    : "#fef2f2",

                color:
                  socketConnected
                    ? "#059669"
                    : "#dc2626",
              }}
            >

              {socketConnected
                ? "LIVE DATA"
                : "CONNECTING"}

            </span>

          </div>


          {/* SENSOR CARDS */}

          <div className="sensor-grid">


            {/* HEART RATE */}

            <div className="sensor-card">

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: "8px",
                }}
              >

                <span>
                  Heart Rate
                </span>

                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color:
                      heartRateStatus.color,
                    background:
                      heartRateStatus.background,
                  }}
                >

                  {heartRateStatus.label}

                </span>

              </div>


              <strong>

                {latest.heartRate}

                <small>
                  {" "}BPM
                </small>

              </strong>

            </div>


            {/* SPO2 */}

            <div className="sensor-card">

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: "8px",
                }}
              >

                <span>
                  SpO₂
                </span>

                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color:
                      spo2Status.color,
                    background:
                      spo2Status.background,
                  }}
                >

                  {spo2Status.label}

                </span>

              </div>


              <strong>

                {latest.spo2}

                <small>
                  %
                </small>

              </strong>

            </div>


            {/* TEMPERATURE */}

            <div className="sensor-card">

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: "8px",
                }}
              >

                <span>
                  Temperature
                </span>

                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color:
                      temperatureStatus.color,
                    background:
                      temperatureStatus.background,
                  }}
                >

                  {temperatureStatus.label}

                </span>

              </div>


              <strong>

                {latest.temperature}

                <small>
                  {" "}°C
                </small>

              </strong>

            </div>


            {/* BLOOD PRESSURE */}

            <div className="sensor-card">

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: "8px",
                }}
              >

                <span>
                  Blood Pressure
                </span>

                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color:
                      bloodPressureStatus.color,
                    background:
                      bloodPressureStatus.background,
                  }}
                >

                  {bloodPressureStatus.label}

                </span>

              </div>


              <strong>

                {currentPatient
                  ? `${currentPatient.systolic_bp}/${currentPatient.diastolic_bp}`
                  : "--"}

                <small>
                  {" "}mmHg
                </small>

              </strong>

            </div>

          </div>


          {/* ========================================
              MONITORING STATUS
          ======================================== */}

          <div
            style={{
              marginTop: "20px",
              padding: "18px 20px",
              borderRadius: "12px",
              border: `1px solid ${
                abnormalSensors.length > 0
                  ? "#fecaca"
                  : "#bbf7d0"
              }`,
              background:
                monitoringStatusBackground,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: "600",
                    marginBottom: "5px",
                  }}
                >
                  MONITORING STATUS
                </div>


                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color:
                      monitoringStatusColor,
                    fontSize: "16px",
                    fontWeight: "700",
                  }}
                >

                  <span>
                    ●
                  </span>

                  {monitoringStatus}

                </div>

              </div>


              <div
                style={{
                  textAlign: "right",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >

                <div>
                  Patient {selectedPatient}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >

                  Last updated: {

                    currentPatient?.timestamp

                      ? new Date(
                          currentPatient.timestamp
                        ).toLocaleTimeString()

                      : "--"

                  }

                </div>

              </div>

            </div>


            {abnormalSensors.length > 0 ? (

              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "14px",
                  borderTop:
                    "1px solid #fecaca",
                }}
              >

                <div
                  style={{
                    fontSize: "12px",
                    color: "#991b1b",
                    fontWeight: "600",
                    marginBottom: "6px",
                  }}
                >
                  Detected conditions
                </div>


                {abnormalSensors.map(
                  (
                    condition,
                    index
                  ) => (

                    <div
                      key={index}
                      style={{
                        fontSize: "12px",
                        color: "#7f1d1d",
                        marginTop:
                          index === 0
                            ? "0"
                            : "4px",
                      }}
                    >

                      • {condition}

                    </div>

                  )
                )}

              </div>

            ) : (

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#047857",
                }}
              >

                All monitored sensors are currently
                within the configured demo thresholds.

              </div>

            )}

          </div>


          {/* ========================================
              STEP 7 - ANALYTICS
          ======================================== */}

          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "14px",
              border:
                "1px solid #e2e8f0",
              background: "#ffffff",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "15px",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >

              <div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    color: "#0f172a",
                  }}
                >
                  Sensor Analytics
                </h3>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Statistics from the latest 20
                  readings for Patient {selectedPatient}
                </p>

              </div>


              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "#f1f5f9",
                  color: "#475569",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >

                {numericSensorData.length}
                {" "}readings analyzed

              </div>

            </div>


            {/* ANALYTICS CARDS */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "12px",
              }}
            >


              {/* AVG HEART RATE */}

              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  AVG HEART RATE
                </div>


                <div
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >

                  {analyticsAvailable
                    ? averageHeartRate.toFixed(1)
                    : "--"}

                  <span
                    style={{
                      marginLeft: "4px",
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                    }}
                  >
                    BPM
                  </span>

                </div>


                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >

                  Range:{" "}

                  {analyticsAvailable
                    ? `${minimumHeartRate} - ${maximumHeartRate}`
                    : "--"}

                </div>

              </div>


              {/* MINIMUM SPO2 */}

              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  MINIMUM SpO₂
                </div>


                <div
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: "700",
                    color:
                      minimumSpo2 !== null &&
                      minimumSpo2 < 92
                        ? "#dc2626"
                        : "#0f172a",
                  }}
                >

                  {analyticsAvailable
                    ? minimumSpo2
                    : "--"}

                  <span
                    style={{
                      marginLeft: "4px",
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                    }}
                  >
                    %
                  </span>

                </div>


                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >

                  Range:{" "}

                  {analyticsAvailable
                    ? `${minimumSpo2} - ${maximumSpo2}`
                    : "--"}

                </div>

              </div>


              {/* AVG TEMPERATURE */}

              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  AVG TEMPERATURE
                </div>


                <div
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: "700",
                    color:
                      averageTemperature !== null &&
                      averageTemperature > 38.5
                        ? "#dc2626"
                        : "#0f172a",
                  }}
                >

                  {analyticsAvailable
                    ? averageTemperature.toFixed(1)
                    : "--"}

                  <span
                    style={{
                      marginLeft: "4px",
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                    }}
                  >
                    °C
                  </span>

                </div>


                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >

                  Range:{" "}

                  {analyticsAvailable
                    ? `${minimumTemperature.toFixed(1)} - ${maximumTemperature.toFixed(1)}`
                    : "--"}

                </div>

              </div>


              {/* RECENT ALERTS */}

              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  RECENT ALERTS
                </div>


                <div
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: "700",
                    color:
                      selectedPatientAlerts.length > 0
                        ? "#dc2626"
                        : "#059669",
                  }}
                >

                  {selectedPatientAlerts.length}

                </div>


                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    gap: "8px",
                    fontSize: "10px",
                    color: "#64748b",
                  }}
                >

                  <span>
                    High: {selectedPatientHighAlerts}
                  </span>

                  <span>
                    Medium: {selectedPatientMediumAlerts}
                  </span>

                </div>

              </div>

            </div>


            {/* CURRENT VS AVERAGE */}

            <div
              style={{
                marginTop: "18px",
                paddingTop: "18px",
                borderTop:
                  "1px solid #e2e8f0",
              }}
            >

              <div
                style={{
                  fontSize: "12px",
                  color: "#475569",
                  fontWeight: "700",
                  marginBottom: "12px",
                }}
              >
                Current Reading vs Average
              </div>


              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >


                {/* HEART RATE */}

                <div
                  style={{
                    padding: "13px",
                    borderRadius: "9px",
                    background: "#f8fafc",
                  }}
                >

                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                    }}
                  >
                    Heart Rate
                  </div>


                  <div
                    style={{
                      marginTop: "5px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                    }}
                  >

                    Current:{" "}

                    {typeof latest.heartRate === "number"
                      ? `${latest.heartRate} BPM`
                      : "--"}

                  </div>


                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      color:
                        heartRateDifference !== null &&
                        heartRateDifference > 0
                          ? "#dc2626"
                          : "#059669",
                    }}
                  >

                    {heartRateDifference !== null

                      ? `${heartRateDifference >= 0 ? "+" : ""}${heartRateDifference.toFixed(1)} vs average`

                      : "No comparison available"}

                  </div>

                </div>


                {/* SPO2 */}

                <div
                  style={{
                    padding: "13px",
                    borderRadius: "9px",
                    background: "#f8fafc",
                  }}
                >

                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                    }}
                  >
                    SpO₂
                  </div>


                  <div
                    style={{
                      marginTop: "5px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                    }}
                  >

                    Current:{" "}

                    {typeof latest.spo2 === "number"
                      ? `${latest.spo2}%`
                      : "--"}

                  </div>


                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      color:
                        spo2Difference !== null &&
                        spo2Difference < 0
                          ? "#dc2626"
                          : "#059669",
                    }}
                  >

                    {spo2Difference !== null

                      ? `${spo2Difference >= 0 ? "+" : ""}${spo2Difference.toFixed(1)}% vs average`

                      : "No comparison available"}

                  </div>

                </div>


                {/* TEMPERATURE */}

                <div
                  style={{
                    padding: "13px",
                    borderRadius: "9px",
                    background: "#f8fafc",
                  }}
                >

                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                    }}
                  >
                    Temperature
                  </div>


                  <div
                    style={{
                      marginTop: "5px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                    }}
                  >

                    Current:{" "}

                    {typeof latest.temperature === "number"
                      ? `${latest.temperature.toFixed(1)} °C`
                      : "--"}

                  </div>


                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      color:
                        temperatureDifference !== null &&
                        temperatureDifference > 0
                          ? "#dc2626"
                          : "#059669",
                    }}
                  >

                    {temperatureDifference !== null

                      ? `${temperatureDifference >= 0 ? "+" : ""}${temperatureDifference.toFixed(1)} °C vs average`

                      : "No comparison available"}

                  </div>

                </div>

              </div>

            </div>


            {/* DEMO THRESHOLD NOTE */}

            <div
              style={{
                marginTop: "16px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#f8fafc",
                color: "#64748b",
                fontSize: "10px",
                lineHeight: "1.5",
              }}
            >

              Analytics and anomaly indicators use the
              configured demo thresholds for this project
              and are intended for system demonstration,
              not clinical diagnosis.

            </div>

          </div>


          {/* ========================================
              HEART RATE CHART
          ======================================== */}

          <div className="chart-container">

            <h3>
              Heart Rate — Real Time
            </h3>

            <ResponsiveContainer
              width="100%"
              height={280}
            >

              <LineChart
                data={sensorData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 11,
                  }}
                />

                <YAxis />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="heartRate"
                  strokeWidth={3}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>


          {/* ========================================
              SPO2 CHART
          ======================================== */}

          <div className="chart-container">

            <h3>
              SpO₂ — Real Time
            </h3>

            <ResponsiveContainer
              width="100%"
              height={280}
            >

              <LineChart
                data={sensorData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 11,
                  }}
                />

                <YAxis
                  domain={[80, 100]}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="spo2"
                  strokeWidth={3}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>


          {/* ========================================
              TEMPERATURE CHART
          ======================================== */}

          <div className="chart-container">

            <h3>
              Temperature — Real Time
            </h3>

            <ResponsiveContainer
              width="100%"
              height={280}
            >

              <LineChart
                data={sensorData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 11,
                  }}
                />

                <YAxis
                  domain={[
                    "auto",
                    "auto"
                  ]}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="temperature"
                  strokeWidth={3}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </section>

      </div>


      {/* ============================================
          RECENT ALERTS
      ============================================ */}

      <section className="panel alerts-panel">


        {/* ALERT HEADER */}

        <div className="panel-header">

          <div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >

              <h2>
                Recent Alerts
              </h2>


              {/* STEP 8 - UNREAD BADGE */}

              {unreadAlertCount > 0 && (

                <span
                  style={{
                    padding:
                      "4px 8px",
                    borderRadius:
                      "999px",
                    background:
                      "#dc2626",
                    color:
                      "#ffffff",
                    fontSize:
                      "10px",
                    fontWeight:
                      "700",
                  }}
                >

                  {unreadAlertCount} NEW

                </span>

              )}

            </div>


            <span
              style={{
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Real-time anomaly events
            </span>

          </div>


          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >

            {/* MARK ALL READ */}

            {unreadAlertCount > 0 && (

              <button
                onClick={
                  markAllAlertsAsRead
                }
                style={{
                  padding:
                    "7px 10px",
                  borderRadius:
                    "8px",
                  border:
                    "1px solid #dbeafe",
                  background:
                    "#eff6ff",
                  color:
                    "#2563eb",
                  fontSize:
                    "11px",
                  fontWeight:
                    "600",
                  cursor:
                    "pointer",
                }}
              >

                ✓ Mark all read

              </button>

            )}


            <span
              style={{
                padding:
                  "6px 12px",
                borderRadius:
                  "20px",
                background:
                  "#f1f5f9",
                color:
                  "#475569",
                fontSize:
                  "12px",
                fontWeight:
                  "600",
              }}
            >

              {filteredAlerts.length} events

            </span>

          </div>

        </div>


        {/* ALERT FILTERS */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >


          {/* ALL */}

          <button
            onClick={() =>
              setAlertSeverityFilter("ALL")
            }
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border:
                "1px solid #e2e8f0",

              background:
                alertSeverityFilter === "ALL"
                  ? "#0f172a"
                  : "#ffffff",

              color:
                alertSeverityFilter === "ALL"
                  ? "#ffffff"
                  : "#475569",

              fontWeight: "600",
              cursor: "pointer",
            }}
          >

            All

          </button>


          {/* HIGH */}

          <button
            onClick={() =>
              setAlertSeverityFilter("HIGH")
            }
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border:
                "1px solid #fecaca",

              background:
                alertSeverityFilter === "HIGH"
                  ? "#dc2626"
                  : "#fff5f5",

              color:
                alertSeverityFilter === "HIGH"
                  ? "#ffffff"
                  : "#dc2626",

              fontWeight: "600",
              cursor: "pointer",
            }}
          >

            High

          </button>


          {/* MEDIUM */}

          <button
            onClick={() =>
              setAlertSeverityFilter("MEDIUM")
            }
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border:
                "1px solid #fed7aa",

              background:
                alertSeverityFilter === "MEDIUM"
                  ? "#d97706"
                  : "#fff7ed",

              color:
                alertSeverityFilter === "MEDIUM"
                  ? "#ffffff"
                  : "#d97706",

              fontWeight: "600",
              cursor: "pointer",
            }}
          >

            Medium

          </button>


          {/* PATIENT FILTER */}

          <select
            value={alertPatientFilter}
            onChange={(event) =>
              setAlertPatientFilter(
                event.target.value
              )
            }
            style={{
              marginLeft: "auto",
              padding:
                "8px 12px",
              borderRadius: "8px",
              border:
                "1px solid #e2e8f0",
              background:
                "#ffffff",
              color:
                "#475569",
              fontWeight:
                "500",
              cursor:
                "pointer",
            }}
          >

            <option value="ALL">
              All Patients
            </option>

            {patients.map(
              (patient) => (

                <option
                  key={
                    patient.patient_id
                  }
                  value={
                    patient.patient_id
                  }
                >

                  Patient{" "}
                  {patient.patient_id}

                </option>

              )
            )}

          </select>

        </div>


        {/* ==========================================
            FILTERED ALERT LIST
        ========================================== */}

        {filteredAlerts.length === 0 ? (

          <div
            className="no-alerts"
            style={{
              padding:
                "40px 20px",
              textAlign:
                "center",
            }}
          >

            <div
              style={{
                fontSize:
                  "32px",
                marginBottom:
                  "10px",
              }}
            >
              ✓
            </div>


            <strong>
              No alerts found
            </strong>


            <p
              style={{
                marginTop:
                  "6px",
                color:
                  "#64748b",
                fontSize:
                  "13px",
              }}
            >

              No alerts match the selected
              filters.

            </p>

          </div>

        ) : (

          <div className="alert-list">

            {filteredAlerts.map(
              (alert) => {

                const isHigh =
                  alert.severity ===
                  "HIGH";


                const alertId =
                  alert.id;


                const isUnread =
                  unreadAlertIds.includes(
                    alertId
                  );


                return (

                  <div
                    className={`alert ${
                      isHigh
                        ? "critical-alert"
                        : "warning-alert"
                    }`}

                    key={
                      alert.id ||
                      `${alert.patient_id}-${alert.timestamp}`
                    }

                    onClick={() =>
                      markAlertAsRead(
                        alertId
                      )
                    }

                    style={{
                      position:
                        "relative",

                      cursor:
                        isUnread
                          ? "pointer"
                          : "default",

                      border:
                        isUnread
                          ? "1px solid #fca5a5"
                          : undefined,

                      boxShadow:
                        isUnread
                          ? "0 4px 12px rgba(220, 38, 38, 0.08)"
                          : undefined,
                    }}
                  >


                    {/* NEW INDICATOR */}

                    {isUnread && (

                      <div
                        style={{
                          position:
                            "absolute",
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width:
                            "4px",
                          background:
                            "#dc2626",
                          borderRadius:
                            "8px 0 0 8px",
                        }}
                      />

                    )}


                    {/* ALERT ICON */}

                    <div
                      style={{
                        width:
                          "38px",
                        height:
                          "38px",
                        borderRadius:
                          "10px",

                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",

                        background:
                          isHigh
                            ? "#fee2e2"
                            : "#ffedd5",

                        color:
                          isHigh
                            ? "#dc2626"
                            : "#d97706",

                        fontSize:
                          "18px",

                        flexShrink:
                          0,
                      }}
                    >

                      !

                    </div>


                    {/* ALERT INFORMATION */}

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "8px",
                          flexWrap:
                            "wrap",
                        }}
                      >


                        {/* SEVERITY */}

                        <span
                          style={{
                            padding:
                              "4px 8px",

                            borderRadius:
                              "6px",

                            fontSize:
                              "10px",

                            fontWeight:
                              "700",

                            letterSpacing:
                              "0.4px",

                            background:
                              isHigh
                                ? "#fee2e2"
                                : "#ffedd5",

                            color:
                              isHigh
                                ? "#dc2626"
                                : "#c2410c",
                          }}
                        >

                          {alert.severity}

                        </span>


                        {/* NEW BADGE */}

                        {isUnread && (

                          <span
                            style={{
                              padding:
                                "4px 8px",
                              borderRadius:
                                "6px",
                              background:
                                "#dc2626",
                              color:
                                "#ffffff",
                              fontSize:
                                "9px",
                              fontWeight:
                                "700",
                            }}
                          >

                            NEW

                          </span>

                        )}


                        {/* ALERT TYPE */}

                        <strong
                          style={{
                            fontSize:
                              "13px",
                          }}
                        >

                          {alert.alert_type
                            .replaceAll(
                              "_",
                              " "
                            )
                            .replace(
                              /\b\w/g,
                              (char) =>
                                char.toUpperCase()
                            )}

                        </strong>

                      </div>


                      {/* PATIENT */}

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "5px",
                          fontSize:
                            "12px",
                          fontWeight:
                            "600",
                          color:
                            "#475569",
                        }}
                      >

                        Patient{" "}
                        {alert.patient_id}

                      </span>


                      {/* MESSAGE */}

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "12px",
                          color:
                            "#64748b",
                        }}
                      >

                        {alert.message}

                      </span>

                    </div>


                    {/* ALERT TIME */}

                    <div
                      style={{
                        fontSize:
                          "11px",
                        color:
                          "#64748b",
                        whiteSpace:
                          "nowrap",
                      }}
                    >

                      {new Date(
                        alert.timestamp
                      ).toLocaleTimeString()}

                    </div>

                  </div>

                );

              }
            )}

          </div>

        )}

      </section>


    </div>

  );

}


export default App;