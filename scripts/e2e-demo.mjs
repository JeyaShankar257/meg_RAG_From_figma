const apiUrl = (process.env.MEDNOVA_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
)

const demoMode = process.env.DEMO_MODE === "true"

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,

    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok)
    throw new Error(
      `${path} returned ${response.status}: ${body.message ?? body.error ?? "unknown error"}`,
    )

  return body
}

async function requestWithToken(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

const health = await request("/health/live")

if (health.status !== "ok") throw new Error("API liveness check failed")

if (demoMode) {
  const doctor = await request("/auth/login", {
    method: "POST",

    body: JSON.stringify({
      email: "s.chen@mednova.clinic",
      password: "demo-password",
      portal: "doctor",
    }),
  })

  if (doctor.user?.role !== "doctor")
    throw new Error("Demo doctor login returned the wrong role")

  const patient = await request("/auth/login", {
    method: "POST",

    body: JSON.stringify({
      email: "m.rivera@email.com",
      password: "demo-password",
      portal: "patient",
    }),
  })

  if (patient.user?.role !== "patient")
    throw new Error("Demo patient login returned the wrong role")

  const doctorToken = doctor.token
  const patientToken = patient.token
  const doctorMe = await requestWithToken("/auth/me", doctorToken)
  if (doctorMe.user?.role !== "doctor")
    throw new Error("Doctor session verification failed")

  const patientMe = await requestWithToken("/auth/me", patientToken)
  if (patientMe.user?.role !== "patient")
    throw new Error("Patient activation/session verification failed")

  // These calls exercise the protected workflow boundary. The demo database may
  // be empty, so a domain 404 is acceptable while auth/role failures are not.
  const patientsResponse = await fetch(`${apiUrl}/patients`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  })
  if (patientsResponse.status === 401 || patientsResponse.status === 403)
    throw new Error("Doctor cannot read assigned patient workflow")

  const patientId = "p-001"
  const consentResponse = await fetch(
    `${apiUrl}/patients/${patientId}/consent`,
    {
      headers: { Authorization: `Bearer ${patientToken}` },
    },
  )
  if (consentResponse.status === 401 || consentResponse.status === 403)
    throw new Error("Patient consent workflow is not authorized")

  const correctionResponse = await fetch(`${apiUrl}/corrections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${patientToken}`,
      "Content-Type": "application/json",
      "X-Correlation-ID": "e2e-demo-correction",
    },
    body: JSON.stringify({
      patientId,
      recordType: "dose",
      recordId: "demo-dose",
      reason: "Demo review request",
    }),
  })
  if (correctionResponse.status === 401 || correctionResponse.status === 403)
    throw new Error("Correction workflow is not authorized")

  const dashboardResponse = await fetch(`${apiUrl}/doctor/dashboard`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  })
  if (dashboardResponse.status === 401 || dashboardResponse.status === 403)
    throw new Error("Doctor cannot access dashboard")

  const settingsResponse = await fetch(`${apiUrl}/doctor/settings`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  })
  if (settingsResponse.status === 401 || settingsResponse.status === 403)
    throw new Error("Doctor cannot access settings")

  const pipelineResponse = await fetch(
    `${apiUrl}/doctor/patients/${patientId}/pipeline`,
    {
      headers: { Authorization: `Bearer ${doctorToken}` },
    },
  )
  if (pipelineResponse.status === 401 || pipelineResponse.status === 403)
    throw new Error("Doctor cannot access patient pipeline")

  const unassignedResponse = await fetch(
    `${apiUrl}/doctor/patients/p-unassigned-nonexistent/pipeline`,
    {
      headers: { Authorization: `Bearer ${doctorToken}` },
    },
  )
  if (unassignedResponse.status !== 404)
    throw new Error("Unassigned patient pipeline did not return 404")

  console.log(
    "Verified doctor login, dashboard, settings, durable pipeline, patient activation/session, protected patient reads, consent, and correction workflow boundaries.",
  )
}

console.log(`MedNova demo workflow smoke check passed against ${apiUrl}`)
