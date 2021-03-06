/**
 * Helper functions for communicating with the server's API.
 */

export interface Dict {
  [key: string]: any;
}
export type ProgressFn = (e: ProgressEvent) => void;
export interface FutureAPI {
  abort?: () => void;
}
export class AbortError extends Error {}

function toFormData(data: Dict): FormData {
  const form = new FormData();
  for (let k of Object.keys(data)) {
    const v = data[k];
    if (Array.isArray(v)) {
      k += "[]";
      v.forEach((item) => form.append(k, item));
    } else if (typeof v === "boolean") {
      if (v) {
        form.append(k, "on");
      }
    } else {
      form.append(k, v);
    }
  }
  return form;
}

function xhrToFetchHeaders(xhr: XMLHttpRequest): Headers {
  const headers = new Headers();
  const hStr = xhr.getAllResponseHeaders();
  for (const h of hStr.trim().split(/\r\n/)) {
    const [k, v] = h.split(/: (.+)/);
    headers.append(k, v);
  }
  return headers;
}

// Avoids stale fetches from the browser cache.
export function uncachedGET(url: string): Promise<Response> {
  return fetch(url, {
    credentials: "same-origin",
    headers: { "Cache-Control": "no-cache" },
    method: "GET",
  });
}

// Fetch JSON data.
export function fetchJSON<T>(url: string): Promise<T> {
  return fetch(url).then((res) => {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(text);
      });
    }
    return res.json();
  });
}

// Send a JSON request to the server.
export function sendJSON(
  url: string,
  data: Dict,
  method = "POST"
): Promise<Response> {
  return fetch(url, {
    body: JSON.stringify(data),
    credentials: "same-origin",
    method,
  });
}

// Send a multipart/form-data request to the server.
export function sendForm(
  url: string,
  data: Dict,
  method = "POST"
): Promise<Response> {
  return fetch(url, {
    body: toFormData(data),
    credentials: "same-origin",
    method,
  });
}

// Send a multipart/form-data request to the server, accepting optional
// progress callback and storage for XHR API methods like `abort`.
// Implemented using XHR underneath because Fetch API currently lacks
// this functionality, but provides roughly same API as fetch version.
export function sendFormProgress(
  url: string,
  data: Dict,
  method = "POST",
  onProgress?: ProgressFn,
  api?: FutureAPI
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = () => {
      const { status, statusText } = xhr;
      const headers = xhrToFetchHeaders(xhr);
      const init = { status, statusText, headers };
      resolve(new Response(xhr.responseText, init));
    };
    xhr.onerror = reject;
    if (onProgress) {
      xhr.upload.onprogress = onProgress;
    }
    if (api) {
      // A bit kludgy but there is no other way..
      api.abort = () => {
        xhr.abort();
        reject(new AbortError());
      };
    }
    xhr.send(toFormData(data));
  });
}
