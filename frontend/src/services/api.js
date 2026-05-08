import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

export const analyzeVideo = async (url) => {
  try {
    const response = await axios.post(`${API_BASE}/analyze`, { url });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to analyze URL');
  }
};

export const downloadVideo = async (streamUrl, formatType, formatExt, filename, referer, onProgress) => {
  try {
    const response = await axios.post(
      `${API_BASE}/download`,
      { streamUrl, formatType, formatExt, filename, referer },
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (onProgress) onProgress(percentCompleted);
          }
        },
      }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.${formatExt}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    let errorMsg = 'Download failed';
    if (error.response && error.response.data && error.response.data instanceof Blob) {
      // Parse blob error message
      const text = await error.response.data.text();
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || errorMsg;
      } catch (e) {
        errorMsg = text;
      }
    }
    throw new Error(errorMsg);
  }
};
