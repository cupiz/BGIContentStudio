import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  FileText, 
  Zap, 
  MessageSquare, 
  Image, 
  Settings as SettingsIcon,
  Users
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [creatorName, setCreatorName] = useState('Creator');
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    const key = localStorage.getItem('bgi_openrouter_api_key');
    if (!key) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      // 1. Coba ambil saldo akun keseluruhan terlebih dahulu
      const creditsRes = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });
      
      if (creditsRes.ok) {
        const json = await creditsRes.json();
        if (json && json.data) {
          const { total_credits, total_usage } = json.data;
          const remaining = total_credits - total_usage;
          setBalance(`$${parseFloat(remaining).toFixed(4)}`);
          return;
        }
      }

      // 2. Jika gagal atau dibatasi, fallback ke info limit spesifik API Key
      const res = await fetch('https://openrouter.ai/api/v1/key', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const data = json.data;
          if (data.limit_remaining !== undefined && data.limit_remaining !== null) {
            setBalance(`$${parseFloat(data.limit_remaining).toFixed(4)}`);
          } else if (data.limit !== undefined && data.limit === null) {
            setBalance('No Limit');
          } else {
            setBalance('Active');
          }
        } else {
          setBalance('Error');
        }
      } else {
        setBalance('Invalid Key');
      }
    } catch (e) {
      console.error('Error fetching OpenRouter balance:', e);
      setBalance('Offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load initial values
    setCreatorName(localStorage.getItem('bgi_creator_name') || 'Creator');
    fetchBalance();

    const handleStorageChange = () => {
      setCreatorName(localStorage.getItem('bgi_creator_name') || 'Creator');
      fetchBalance();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchBalance]);
  
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard Tracker', icon: LayoutDashboard },
    { id: 'pillars', name: 'Pillar Strategy', icon: Target },
    { id: 'scripts', name: 'Script Builder', icon: FileText },
    { id: 'hooks', name: 'Hook Studio', icon: Zap },
    { id: 'captions', name: 'Caption Craft', icon: MessageSquare },
    { id: 'images', name: 'Image Studio', icon: Image },
    { id: 'team-workflow', name: 'Team Workflow', icon: Users },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="sidebar">
      <div>
        <div className="sidebar-brand">
          <img 
            src="/icon.png" 
            alt="BGI Logo" 
            className="sidebar-logo" 
            style={{ 
              objectFit: 'contain', 
              padding: '4px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }} 
          />
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
        {localStorage.getItem('bgi_openrouter_api_key') && (
          <div 
            className="openrouter-balance" 
            title="Klik untuk menyegarkan saldo OpenRouter Anda"
            onClick={fetchBalance}
            style={{ cursor: 'pointer' }}
          >
            <span className="balance-label">OpenRouter:</span>
            <span className={`balance-value ${loading ? 'loading' : ''}`}>
              {loading ? 'Loading...' : balance || 'Refresh'}
            </span>
          </div>
        )}
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
