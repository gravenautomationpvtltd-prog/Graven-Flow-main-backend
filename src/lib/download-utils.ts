/**
 * Download utility — tries direct link first (fast, no memory overhead),
 * falls back to blob fetch for cross-origin or restricted files.
 */

export const downloadFile = async (url: string, fileName: string): Promise<void> => {
  try {
    // Cross-origin URLs (e.g. Supabase Storage URLs) require blob fetching
    // because browsers strictly ignore the <a download> attribute on cross-origin links.
    const isSameOrigin =
      typeof window !== 'undefined' &&
      (url.startsWith('/') ||
        url.startsWith('blob:') ||
        url.startsWith('data:') ||
        (url.startsWith('http') && new URL(url).origin === window.location.origin));

    if (!isSameOrigin) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL after small delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1500);
      return;
    }

    // Direct link for same-origin or blob
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error, opening in new tab:', error);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
};

/**
 * Download multiple files sequentially
 */
export const downloadMultipleFiles = async (
  files: Array<{ url: string; fileName: string }>
): Promise<void> => {
  for (const file of files) {
    await downloadFile(file.url, file.fileName);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
};
