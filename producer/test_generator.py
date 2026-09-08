from sensor_generator import generate_sensor_reading

for i in range(10):
    reading = generate_sensor_reading("P001")
    print(reading)