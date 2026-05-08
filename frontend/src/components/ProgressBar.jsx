import React from 'react';

function ProgressBar({ progress }) {
  return (
    <div className="progress-bg">
      <div 
        className="progress-fill" 
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      ></div>
    </div>
  );
}

export default ProgressBar;
