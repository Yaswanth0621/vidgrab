import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function Queue() {
  const navigate = useNavigate();
  
  // For a full implementation, this would connect to a global state/context
  // or local storage to show active downloads across the app.
  // We'll show a placeholder here to demonstrate the UI.
  
  return (
    <div className="container">
      <header className="header" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '0.75rem' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Download Queue</h1>
      </header>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div className="queue-header">
          <h2 style={{ fontSize: '1.25rem' }}>Recent Activity</h2>
          <span className="queue-status">Note: Downloads are currently managed by the browser.</span>
        </div>
        
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
          <p>Once a download starts, you can track its progress on the Home page.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            When the server finishes extracting and merging the video, your browser will automatically save the file.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Queue;
