import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import URLInput from '../components/URLInput';
import VideoCard from '../components/VideoCard';
import { analyzeVideo } from '../services/api';
import { Download } from 'lucide-react';

function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const navigate = useNavigate();

  const handleAnalyze = async (url) => {
    setLoading(true);
    setError(null);
    setVideoData(null);
    
    try {
      const data = await analyzeVideo(url);
      setVideoData(data);
    } catch (err) {
      setError(err.message || 'Failed to detect video streams');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>VidGrab</h1>
        <p>Universal Video Downloader Engine</p>
      </header>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <URLInput onAnalyze={handleAnalyze} isLoading={loading} />
        {error && (
          <div style={{ color: '#ef4444', marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="spinner-large"></div>
      )}

      {videoData && !loading && (
        <VideoCard data={videoData} onDownloadStart={() => navigate('/queue')} />
      )}
      
      {videoData && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/queue')}>
            <Download size={20} /> View Download Queue
          </button>
        </div>
      )}
    </div>
  );
}

export default Home;
