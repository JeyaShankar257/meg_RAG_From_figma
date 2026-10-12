const services = [
  [
    "API",
    process.env.MEDNOVA_API_URL ?? "http://localhost:3001",
    "/health/ready",
  ],

  [
    "Agents",
    process.env.MEDNOVA_AGENTS_URL ?? "http://localhost:8001",
    "/health/ready",
  ],
]

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
]

const missing = required.filter(
  (name) => !process.env[name] && process.env.DEMO_MODE !== "true",
)

if (missing.length > 0) {
  throw new Error(`Missing integration configuration: ${missing.join(", ")}`)
}

for (const [name, baseUrl, path] of services) {
  try {
    const response = await fetch(`${baseUrl}${path}`)

    const body = await response.json().catch(() => ({}))

    if (!response.ok || !["ok", "healthy"].includes(body.status)) {
      throw new Error(`${name} readiness returned ${response.status}`)
    }

    console.log(`${name} ready`)
  } catch (error) {
    throw new Error(`${name} is unavailable: ${error.message}`)
  }
}

console.log(
  "Integration configuration is valid and service health is observable.",
)
