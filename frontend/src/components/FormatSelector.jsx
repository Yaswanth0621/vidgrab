import React from 'react';

function FormatSelector({ formats, selected, onSelect }) {
  if (!formats || formats.length === 0) return <div>No formats available</div>;

  return (
    <div className="format-grid">
      {formats.map((fmt) => (
        <button
          key={fmt.id}
          className={`format-btn ${selected?.id === fmt.id ? 'active' : ''}`}
          onClick={() => onSelect(fmt)}
        >
          <span className="format-quality">{fmt.quality || 'Auto'}</span>
          <span className="format-ext">{fmt.type === 'hls' || fmt.type === 'dash' ? 'MP4 (Merged)' : fmt.type}</span>
          {fmt.bandwidth ? (
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {Math.round(fmt.bandwidth / 1000)} kbps
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default FormatSelector;
