import React, { useState } from 'react';
import './CollapsibleSection.css';

const CollapsibleSection = ({ title, children, defaultCollapsed = true }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="collapsible-section">
      <div 
        className="section-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="section-title">{title}</h3>
        <span className={`chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}>
          ▼
        </span>
      </div>
      {!isCollapsed && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
