import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ContentBatching from './components/ContentBatching';
import PillarMapping from './components/PillarMapping';
import ScriptGenerator from './components/ScriptGenerator';
import HookGenerator from './components/HookGenerator';
import CaptionGenerator from './components/CaptionGenerator';
import ImageGenerator from './components/ImageGenerator';
import Settings from './components/Settings';
import TeamWorkflow from './components/TeamWorkflow';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    // Check if API key exists, otherwise redirect to settings
    const apiKey = localStorage.getItem('bgi_gemini_api_key');
    if (!apiKey) {
      setActiveTab('settings');
    } else {
      setHasApiKey(true);
    }

    // Listener for settings change
    const handleStorageChange = () => {
      const updatedKey = localStorage.getItem('bgi_gemini_api_key');
      setHasApiKey(!!updatedKey);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ContentBatching />;
      case 'pillars':
        return <PillarMapping onNavigateToScripts={() => setActiveTab('scripts')} />;
      case 'scripts':
        return <ScriptGenerator 
          onNavigateToHooks={() => setActiveTab('hooks')} 
          onNavigateToCaptions={() => setActiveTab('captions')} 
        />;
      case 'hooks':
        return <HookGenerator />;
      case 'captions':
        return <CaptionGenerator />;
      case 'images':
        return <ImageGenerator />;
      case 'team-workflow':
        return <TeamWorkflow />;
      case 'settings':
        return <Settings />;
      default:
        return <ContentBatching />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        {!hasApiKey && activeTab !== 'settings' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <span>
              <strong>Perhatian:</strong> API Key Gemini belum dikonfigurasi. Anda tidak dapat menggunakan fitur AI sebelum mengisinya.
            </span>
            <button onClick={() => setActiveTab('settings')} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#f87171', color: '#f87171' }}>
              Buka Pengaturan
            </button>
          </div>
        )}
        
        {renderContent()}
      </main>
    </div>
  );
}
