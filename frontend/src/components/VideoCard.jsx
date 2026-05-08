import React, { useState } from 'react';
import FormatSelector from './FormatSelector';
import ProgressBar from './ProgressBar';
import { downloadVideo } from '../services/api';

function VideoCard({ data, onDownloadStart }) {
  const [selectedFormat, setSelectedFormat] = useState(data.formats[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    if (!selectedFormat) return;
    
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    
    try {
      // Determine final extension
      const isAudio = selectedFormat.type.includes('audio') || selectedFormat.type === 'mp3' || selectedFormat.type === 'aac';
      const ext = isAudio ? 'mp3' : 'mp4';
      
      await downloadVideo(
        selectedFormat.url,
        selectedFormat.type,
        ext,
        data.title,
        selectedFormat.referer,
        (p) => setProgress(p)
      );
      
      setTimeout(() => setIsDownloading(false), 2000);
    } catch (err) {
      setError(err.message || 'Download failed');
      setIsDownloading(false);
    }
  };

  return (
    <div className="glass-panel video-card">
      <div className="thumbnail-container">
        {data.thumbnail ? (
          <img src={data.thumbnail} alt={data.title} className="thumbnail" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            No Thumbnail
          </div>
        )}
        {data.duration && (
          <span className="duration-badge">
            {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
      
      <div className="video-info">
        <h2>{data.title || 'Unknown Video'}</h2>
        
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '1rem' }}>Available Formats</h3>
        
        <FormatSelector 
          formats={data.formats} 
          selected={selectedFormat} 
          onSelect={setSelectedFormat} 
        />
        
        <div style={{ marginTop: '2rem' }}>
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
          
          {isDownloading ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Downloading & Processing...</span>
                <span>{progress}%</span>
              </div>
              <ProgressBar progress={progress} />
            </div>
          ) : (
            <button className="btn" onClick={handleDownload} style={{ width: '100%' }}>
              Download Selected Format
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoCard;
