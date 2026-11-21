const configuredBackendUrl = (process.env.REACT_APP_API_URL || "").trim();
const backendUrl = (
  configuredBackendUrl ||
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")
)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export const config = {
  backendUrl,
  development: process.env.NODE_ENV === "development",
  debug: process.env.NODE_ENV !== "production",
  appKey: "crash-0.1.0",
  api: backendUrl ? `${backendUrl}/api` : "",
  wss: backendUrl,
};
