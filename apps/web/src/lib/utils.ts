export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function deriveMimeFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    // Video
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    m4v: 'video/mp4',
    avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    // Image
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    // Document
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    js: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    jsx: 'text/javascript',
    html: 'text/html',
    css: 'text/css',
    xml: 'text/xml',
    csv: 'text/csv',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    sh: 'text/x-sh',
    // Archive
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    dmg: 'application/x-apple-diskimage',
    iso: 'application/x-iso9660-image',
  };

  return mimeMap[extension] || 'application/octet-stream';
}
