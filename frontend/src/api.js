const API_BASE_URL = "http://localhost:8000";

export async function getStats() {
  const response = await fetch(`${API_BASE_URL}/stats`);

  if (!response.ok) {
    throw new Error("Failed to fetch statistics");
  }

  return response.json();
}

export async function getPatients() {
  const response = await fetch(`${API_BASE_URL}/patients`);

  if (!response.ok) {
    throw new Error("Failed to fetch patients");
  }

  return response.json();
}

export async function getReadings(patientId = null, limit = 50) {
  let url = `${API_BASE_URL}/readings?limit=${limit}`;

  if (patientId) {
    url += `&patient_id=${patientId}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch readings");
  }

  return response.json();
}

export async function getAlerts(
  patientId = null,
  severity = null,
  limit = 50
) {
  let url = `${API_BASE_URL}/alerts?limit=${limit}`;

  if (patientId) {
    url += `&patient_id=${patientId}`;
  }

  if (severity) {
    url += `&severity=${severity}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch alerts");
  }

  return response.json();
}

export async function getPatient(patientId) {
  const response = await fetch(
    `${API_BASE_URL}/patients/${patientId}`
  );

  if (!response.ok) {
    throw new Error("Patient not found");
  }

  return response.json();
}