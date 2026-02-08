const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILENAME = 'reflekt-sync.enc';

export class DriveApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

async function driveRequest(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new DriveApiError(
      `Drive API error: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return response;
}

export async function findSyncFile(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name='${SYNC_FILENAME}'`,
    spaces: 'appDataFolder',
    fields: 'files(id,name)',
  });

  const response = await driveRequest(
    `${DRIVE_API}/files?${params}`,
    token,
  );

  const data: { files?: Array<{ id: string; name: string }> } = await response.json();

  return data.files?.[0]?.id ?? null;
}

export async function uploadSyncFile(
  content: string,
  token: string,
  fileId?: string,
): Promise<string> {
  if (fileId) {
    // Update existing file
    const response = await driveRequest(
      `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`,
      token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: content,
      },
    );
    const data = await response.json();
    return data.id;
  }

  // Create new file with multipart upload
  const metadata = {
    name: SYNC_FILENAME,
    parents: ['appDataFolder'],
  };

  const boundary = '---sync-boundary-' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/octet-stream\r\n\r\n' +
    content +
    `\r\n--${boundary}--`;

  const response = await driveRequest(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );

  const data = await response.json();
  return data.id;
}

export async function downloadSyncFile(
  fileId: string,
  token: string,
): Promise<string> {
  const response = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    token,
  );

  return response.text();
}
