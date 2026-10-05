/**
 * Client-Side Instant Thumbnail Generator
 * Generates 256x256 WebP thumbnails (<15 KB) for images and videos via offscreen Canvas
 */

export async function generateThumbnail(file: File): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;

  const mime = file.type?.toLowerCase() || '';
  const name = file.name.toLowerCase();

  const isImage =
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp');

  const isVideo =
    mime.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.mov') ||
    name.endsWith('.webm') ||
    name.endsWith('.m4v');

  if (!isImage && !isVideo) return null;

  if (isImage) {
    return new Promise<Blob | null>((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const maxDim = 256;
          let width = img.naturalWidth || maxDim;
          let height = img.naturalHeight || maxDim;

          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82);
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      img.src = objectUrl;
    });
  }

  if (isVideo) {
    return new Promise<Blob | null>((resolve) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      let cleanedUp = false;
      const cleanup = () => {
        if (!cleanedUp) {
          cleanedUp = true;
          URL.revokeObjectURL(objectUrl);
          video.removeAttribute('src');
          video.load();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 4000);

      video.onloadeddata = () => {
        const seekTime = Math.min(1.0, video.duration ? video.duration / 4 : 0.5);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const maxDim = 256;
          let width = video.videoWidth || maxDim;
          let height = video.videoHeight || 144;

          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              resolve(blob);
            },
            'image/webp',
            0.82
          );
        } catch {
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      };

      video.src = objectUrl;
    });
  }

  return null;
}
