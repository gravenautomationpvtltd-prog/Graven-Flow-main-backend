/**
 * Download utility — tries direct link first (fast, no memory overhead),
 * falls back to blob fetch for cross-origin or restricted files.
 */

export const downloadFile = async (url: string, fileName: string): Promise<void> => {
  try {
    // Try direct <a download> first — fastest, streams to disk
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    try {
      // Fallback: fetch as blob (handles cross-origin)
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      window.open(url, '_blank');
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
