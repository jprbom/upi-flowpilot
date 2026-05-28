function apiBaseUrl() {
  const meta = import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } };
  const configured = meta.env?.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const previewPort = String(window.location.port || '');
    if (previewPort === '5101') return 'http://127.0.0.1:4101';
    if (previewPort.startsWith('51')) return 'http://127.0.0.1:' + previewPort.replace(/^51/, '41');
  }
  return '';
}

export async function apiRequest<T>(path: string, role: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBaseUrl() + '/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Request failed with status ' + response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
