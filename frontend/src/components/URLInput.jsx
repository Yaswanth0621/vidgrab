import React, { useState } from 'react';
import { Search } from 'lucide-react';

function URLInput({ onAnalyze, isLoading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-group">
      <input
        type="url"
        className="url-input"
        placeholder="Paste video URL here (MP4, M3U8, or Webpage)..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        disabled={isLoading}
      />
      <button type="submit" className="btn" disabled={isLoading || !url.trim()}>
        {isLoading ? (
          <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
        ) : (
          <><Search size={20} /> Scan</>
        )}
      </button>
    </form>
  );
}

export default URLInput;
