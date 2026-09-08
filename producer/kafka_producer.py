import json
import time
from kafka import KafkaProducer

from sensor_generator import generate_sensor_reading


KAFKA_SERVER = "kafka:9092"
TOPIC = "medical-sensor-data"


producer = KafkaProducer(
    bootstrap_servers=KAFKA_SERVER,
    value_serializer=lambda value:
        json.dumps(value).encode("utf-8")
)


patients = [
    "P001",
    "P002",
    "P003",
    "P004",
    "P005",
    "P006",
    "P007",
    "P008",
    "P009",
    "P010"
]


print("Medical IoT Kafka Producer started...")

while True:

    for patient_id in patients:

        sensor_data = generate_sensor_reading(patient_id)

        producer.send(
            TOPIC,
            value=sensor_data
        )

        print(sensor_data)

    producer.flush()

    time.sleep(1)