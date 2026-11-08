export const state = {
  user: null,
  csrfToken: null,
  meta: { categories: [], locations: [] },
};
export async function api(url, { method = "GET", body } = {}) {
  const headers = {};
  if (method !== "GET") headers["x-csrf-token"] = state.csrfToken || "";
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${url}`, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  if (data.csrfToken) state.csrfToken = data.csrfToken;
  return data;
}
export async function refreshSession() {
  const data = await api("/auth/me");
  state.user = data.user;
  return data;
}
