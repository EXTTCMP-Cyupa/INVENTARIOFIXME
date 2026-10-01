/**
 * Fixme Tiendas - Cliente HTTP centralizado y tipado
 * Maneja tokens de autenticación, errores estandarizados (401, 403, 500) y query strings limpias.
 */

export interface ApiClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiError extends Error {
  public status: number;
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function buildQueryString(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  });

  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export async function apiClient<T = any>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
  const { params, headers: customHeaders, ...fetchOpts } = options;
  const queryString = buildQueryString(params);
  const fullUrl = `${endpoint}${queryString}`;

  const token = localStorage.getItem('token') || '';
  const headers = new Headers(customHeaders || {});

  if (!headers.has('Content-Type') && !(fetchOpts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(fullUrl, {
    ...fetchOpts,
    headers
  });

  if (response.status === 401) {
    // Si la sesión expiró y no es endpoint público, limpiar token
    if (!endpoint.includes('/api/auth') && !endpoint.includes('/api/public')) {
      console.warn('[apiClient] Sesión expirada (401).');
    }
    throw new ApiError('Sesión expirada o no autorizada.', 401);
  }

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    let errData: any = null;
    try {
      errData = await response.json();
      if (errData && typeof errData === 'object') {
        errorMsg = errData.message || errData.error || errorMsg;
      }
    } catch {
      // response might be raw text
      try {
        const text = await response.text();
        if (text) errorMsg = text;
      } catch {}
    }
    throw new ApiError(errorMsg, response.status, errData);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  return (await response.text()) as unknown as T;
}

