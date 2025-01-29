/**
 * Utility functions to make API requests.
 * By importing this file, you can use the provided get, post, put, and delete functions.
 * You shouldn't need to modify this file, but if you want to learn more
 * about how these functions work, google search "Fetch API"
 *
 * These functions return Promises, which means you should use ".then" on them.
 * e.g. get('/api/foo', { bar: 0 }).then(res => console.log(res))
 */

// Helper to make API requests with credentials
async function fetchWithCredentials(endpoint, options = {}) {
  // Remove any double slashes from the endpoint
  const cleanEndpoint = endpoint.replace(/\/+/g, '/');
  
  // Always use the backend server URL for auth routes
  const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';
  
  // Handle query parameters
  let url = `${baseUrl}${cleanEndpoint}`;
  if (options.params) {
    const queryString = new URLSearchParams(options.params).toString();
    url = `${url}?${queryString}`;
    delete options.params; // Remove params from options to avoid confusion
  }
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `${options.method || "GET"} request to ${endpoint} failed with error:\n${error}`
      );
    }

    return response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

export function get(endpoint, options = {}) {
  return fetchWithCredentials(endpoint, { method: "GET", credentials: 'include', ...options });
}

export function post(endpoint, body, options = {}) {
  return fetchWithCredentials(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export function put(endpoint, body, options = {}) {
  return fetchWithCredentials(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
    ...options,
  });
}

export function del(endpoint, options = {}) {
  return fetchWithCredentials(endpoint, {
    method: "DELETE",
    ...options,
  });
}
