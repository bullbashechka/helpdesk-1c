const DEFAULT_API_BASE_URL = '/api';

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.details = options.details ?? null;
  }
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function buildUrl(path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${getApiBaseUrl()}${normalizedPath}`, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

function getErrorMessage(status, payload) {
  const serverMessage =
    payload?.message ||
    payload?.error ||
    payload?.detail ||
    (Array.isArray(payload?.errors) ? payload.errors.join(', ') : '');

  if (status === 404 && (!serverMessage || serverMessage.toLowerCase() === 'not found')) {
    return 'Раздел API пока недоступен.';
  }

  if (serverMessage) {
    const lowered = serverMessage.toLowerCase();

    if (status === 409) {
      return serverMessage;
    }

    if (
      lowered.includes('foreign key') ||
      lowered.includes('constraint') ||
      lowered.includes('linked') ||
      lowered.includes('related') ||
      lowered.includes('связ')
    ) {
      return 'Нельзя удалить запись: она используется в связанных данных.';
    }

    return serverMessage;
  }

  if (status === 404) {
    return 'Раздел API пока недоступен.';
  }

  if (status >= 500) {
    return 'Сервер не смог обработать запрос. Попробуйте позже.';
  }

  return `API вернул ошибку ${status}.`;
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      ...options,
      headers,
      body,
    });
  } catch (error) {
    throw new ApiError('API недоступен. Проверьте, что backend запущен и доступен.', {
      details: error,
    });
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(response.status, payload), {
      status: response.status,
      details: payload,
    });
  }

  return payload;
}

export const apiClient = {
  get(path, options = {}) {
    return request(path, { ...options, method: 'GET' });
  },
  post(path, body, options = {}) {
    return request(path, { ...options, method: 'POST', body });
  },
  put(path, body, options = {}) {
    return request(path, { ...options, method: 'PUT', body });
  },
  delete(path, options = {}) {
    return request(path, { ...options, method: 'DELETE' });
  },
};
