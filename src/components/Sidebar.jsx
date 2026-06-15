import React from 'react';
import { 
  LayoutDashboard, 
  Target, 
  FileText, 
  Zap, 
  MessageSquare, 
  Settings as SettingsIcon 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const creatorName = localStorage.getItem('bgi_creator_name') || 'Creator';
  
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard Tracker', icon: LayoutDashboard },
    { id: 'pillars', name: 'Pillar Strategy', icon: Target },
    { id: 'scripts', name: 'Script Builder', icon: FileText },
    { id: 'hooks', name: 'Hook Studio', icon: Zap },
    { id: 'captions', name: 'Caption Craft', icon: MessageSquare },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="sidebar">
      <div>
        <div className="sidebar-brand">
          <div className="sidebar-logo">B</div>
          <span className="sidebar-title">BGI Studio</span>
        </div>
        
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-item-btn ${activeTab === item.id ? 'active' : ''}`}
                >
                  <IconComponent />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="creator-badge">
          <div className="creator-avatar">
            {creatorName.charAt(0).toUpperCase()}
          </div>
          <span className="creator-name" title={creatorName}>
            {creatorName}
          </span>
        </div>
      </div>
    </div>
  );
}
