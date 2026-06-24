import React, { useState, useEffect } from 'react';
import { Key, User, Cpu, Sparkles, Check, AlertCircle, Trash2, Image } from 'lucide-react';
import { generateWithGemini } from '../services/gemini';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [model, setModel] = useState('gemma-4-31b-it');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, msg: string }
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Google Drive Settings states
  const [gdriveMode, setGdriveMode] = useState('apps-script');
  const [gdriveFolderUrl, setGdriveFolderUrl] = useState('');
  const [gdriveAppsScriptUrl, setGdriveAppsScriptUrl] = useState('');
  const [gdriveAccessToken, setGdriveAccessToken] = useState('');
  const [saveGDriveSuccess, setSaveGDriveSuccess] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('bgi_gdrive_folder_url')) {
      localStorage.setItem('bgi_gdrive_folder_url', 'https://drive.google.com/drive/folders/1wrxFmI6qarsiBPvuqzuzzU433srw8WUT?usp=sharing');
    }
    setApiKey(localStorage.getItem('bgi_gemini_api_key') || '');
    setCreatorName(localStorage.getItem('bgi_creator_name') || 'Creator');
    setModel(localStorage.getItem('bgi_gemini_model') || 'gemma-4-31b-it');
    setOpenRouterApiKey(localStorage.getItem('bgi_openrouter_api_key') || '');
    setGdriveMode(localStorage.getItem('bgi_gdrive_mode') || 'apps-script');
    setGdriveFolderUrl(localStorage.getItem('bgi_gdrive_folder_url') || '');
    setGdriveAppsScriptUrl(localStorage.getItem('bgi_gdrive_apps_script_url') || '');
    setGdriveAccessToken(localStorage.getItem('bgi_gdrive_access_token') || '');
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('bgi_gemini_api_key', apiKey.trim());
    localStorage.setItem('bgi_creator_name', creatorName.trim() || 'Creator');
    localStorage.setItem('bgi_gemini_model', model);
    localStorage.setItem('bgi_openrouter_api_key', openRouterApiKey.trim());
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    // Reload sidebar creator badge if name changed by raising simple custom event or reload page
    window.dispatchEvent(new Event('storage'));
  };

  const handleSaveGDriveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('bgi_gdrive_mode', gdriveMode);
    localStorage.setItem('bgi_gdrive_folder_url', gdriveFolderUrl.trim());
    localStorage.setItem('bgi_gdrive_apps_script_url', gdriveAppsScriptUrl.trim());
    localStorage.setItem('bgi_gdrive_access_token', gdriveAccessToken.trim());
    
    setSaveGDriveSuccess(true);
    setTimeout(() => setSaveGDriveSuccess(false), 3000);
    window.dispatchEvent(new Event('storage'));
  };

  const handleTestAPI = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, msg: 'Silakan masukkan API Key terlebih dahulu.' });
      return;
    }
    
    setLoading(true);
    setTestResult(null);
    
    // Temporarily save to local storage to test
    const oldKey = localStorage.getItem('bgi_gemini_api_key');
    localStorage.setItem('bgi_gemini_api_key', apiKey.trim());
    
    try {
      const result = await generateWithGemini("Say the word 'OK' only.");
      setTestResult({ success: true, msg: `Sukses! API Key valid. (Respon: "${result.trim()}")` });
    } catch (err) {
      setTestResult({ success: false, msg: `Gagal terhubung ke Gemini: ${err.message}` });
    } finally {
      // Restore old key
      if (oldKey !== null) {
        localStorage.setItem('bgi_gemini_api_key', oldKey);
      } else {
        localStorage.removeItem('bgi_gemini_api_key');
      }
      setLoading(false);
    }
  };

  const handleClearData = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh data pilar, ide, skrip, dan pengaturan Anda dari browser ini? Tindakan ini tidak dapat dibatalkan.")) {
      localStorage.clear();
      setApiKey('');
      setCreatorName('Creator');
      setModel('gemma-4-31b-it');
      setTestResult(null);
      alert("Seluruh data berhasil dihapus.");
      window.location.reload();
    }
  };

  return (
    <div className="settings-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Pengaturan Studio</h1>
          <p>Konfigurasi kredensial Google AI Studio Anda dan identitas profil pembuat konten.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h2 className="card-title"><User size={18} /> Profil & Kredensial</h2>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Nama Kreator</label>
              <input 
                type="text" 
                className="input-text" 
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Nama Anda atau Brand Anda"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gemini API Key Studio</label>
              <input 
                type="password" 
                className="input-text" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Dapatkan API Key gratis di <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Google AI Studio</a>.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label"><Image size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> OpenRouter API Key (untuk Image Generation)</label>
              <input 
                type="password" 
                className="input-text" 
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Dapatkan API Key di <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>OpenRouter</a>. Diperlukan untuk generate gambar langsung dari Image Studio.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Model Gemini</label>
              <select 
                className="select-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Sangat Cepat & Efisien - Default)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Lebih Cerdas & Kompleks)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Terbaru & Tercanggih)</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                <option value="gemma-4-31b-it">Gemma 4 31B IT</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {saveSuccess ? <><Check size={16} /> Disimpan</> : 'Simpan Pengaturan'}
              </button>
              <button type="button" onClick={handleTestAPI} className="btn btn-outline" disabled={loading}>
                {loading ? <div className="loading-spinner"></div> : 'Uji Koneksi API'}
              </button>
            </div>
          </form>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 className="card-title"><Sparkles size={18} /> Uji Kredensial</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Gunakan pengujian ini untuk memastikan API Key yang Anda masukkan valid dan dapat mengakses layanan Gemini AI Studio tanpa kendala.
            </p>
            
            {testResult && (
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                background: testResult.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                color: testResult.success ? '#34d399' : '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                wordBreak: 'break-word'
              }}>
                {testResult.success ? <Check size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--danger)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Trash2 size={16} /> Zona Bahaya
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Menghapus semua data yang tersimpan di browser ini termasuk pilar, skrip, caption, dan daftar tracker Anda.
            </p>
            <button onClick={handleClearData} className="btn btn-outline" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              Hapus Semua Data
            </button>
          </div>
        </div>

        <div className="glass-card" style={{ marginTop: '1.5rem', gridColumn: 'span 2' }}>
          <h2 className="card-title"><Image size={18} style={{ marginRight: '0.25rem' }} /> Sinkronisasi Google Drive</h2>
          <form onSubmit={handleSaveGDriveSettings}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Metode Sinkronisasi</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => setGdriveMode('apps-script')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: gdriveMode === 'apps-script' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                      background: gdriveMode === 'apps-script' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: gdriveMode === 'apps-script' ? 'var(--primary)' : 'var(--text-main)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem'
                    }}
                  >
                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Google Apps Script Web App</span>
                    <span style={{ fontSize: '0.72rem', color: gdriveMode === 'apps-script' ? 'var(--primary)' : 'var(--text-muted)' }}>
                      Rekomendasi - Menggunakan skrip perantara tanpa repot memperbarui token tiap jam.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGdriveMode('drive-api')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: gdriveMode === 'drive-api' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                      background: gdriveMode === 'drive-api' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: gdriveMode === 'drive-api' ? 'var(--primary)' : 'var(--text-main)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem'
                    }}
                  >
                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Direct Google Drive API</span>
                    <span style={{ fontSize: '0.72rem', color: gdriveMode === 'drive-api' ? 'var(--primary)' : 'var(--text-muted)' }}>
                      Menggunakan OAuth Access Token langsung dengan API Google Drive resmi.
                    </span>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">URL Folder Share Google Drive</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={gdriveFolderUrl}
                  onChange={(e) => setGdriveFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ height: '38px' }}
                />
              </div>
            </div>

            {gdriveMode === 'apps-script' ? (
              <div className="form-group">
                <label className="form-label">URL Web App Google Apps Script</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={gdriveAppsScriptUrl}
                  onChange={(e) => setGdriveAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  style={{ height: '38px' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block', lineHeight: '1.4' }}>
                  Deploy Apps Script Anda sebagai <strong>Web App</strong> dengan akses <strong>"Anyone"</strong> dan salin URL-nya ke sini.
                </span>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Google Drive Access Token</label>
                <input 
                  type="password" 
                  className="input-text" 
                  value={gdriveAccessToken}
                  onChange={(e) => setGdriveAccessToken(e.target.value)}
                  placeholder="ya29.a0AcV..."
                  style={{ height: '38px' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block', lineHeight: '1.4' }}>
                  Masukkan Access Token OAuth2 aktif. Token ini memiliki masa kedaluwarsa 1 jam setelah dibuat.
                </span>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                {saveGDriveSuccess ? <><Check size={16} /> Disimpan</> : 'Simpan Pengaturan GDrive'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
