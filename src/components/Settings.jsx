import React, { useState, useEffect } from 'react';
import { Key, User, Cpu, Sparkles, Check, AlertCircle, Trash2 } from 'lucide-react';
import { generateWithGemini } from '../services/gemini';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [model, setModel] = useState('gemma-4-31b-it');
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, msg: string }
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem('bgi_gemini_api_key') || '');
    setCreatorName(localStorage.getItem('bgi_creator_name') || 'Creator');
    setModel(localStorage.getItem('bgi_gemini_model') || 'gemma-4-31b-it');
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('bgi_gemini_api_key', apiKey.trim());
    localStorage.setItem('bgi_creator_name', creatorName.trim() || 'Creator');
    localStorage.setItem('bgi_gemini_model', model);
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    // Reload sidebar creator badge if name changed by raising simple custom event or reload page
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
      </div>
    </div>
  );
}
