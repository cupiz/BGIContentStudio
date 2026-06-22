import React, { useState, useEffect, useRef } from 'react';
import { Image, Sparkles, Copy, Trash2, ExternalLink, Upload, Plus, RefreshCw } from 'lucide-react';
import { generateImagePrompts } from '../services/gemini';

export default function ImageGenerator() {
  const [prompts, setPrompts] = useState([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);
  const [slideCount, setSlideCount] = useState(5);
  const [hookText, setHookText] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [contentFormat, setContentFormat] = useState('Carousel');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [openingPromptId, setOpeningPromptId] = useState(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showContext, setShowContext] = useState(false);
  const [geminiLoginStatus, setGeminiLoginStatus] = useState(null); // null | 'checking' | 'logged_in' | 'not_logged_in'
  const [geminiLoginMsg, setGeminiLoginMsg] = useState('');
  const [openingGeminiLogin, setOpeningGeminiLogin] = useState(false);
  const fileInputRef = useRef(null);
  const isLoginCheckingRef = useRef(false);

  // Load saved context on mount
  useEffect(() => {
    // Load hook result
    const savedHooks = localStorage.getItem('bgi_hooks_result');
    if (savedHooks) setHookText(savedHooks);

    // Load script from Script Builder
    const savedScript = localStorage.getItem('bgi_active_script');
    if (savedScript) setScriptText(savedScript);

    // Load caption from Caption Craft
    const savedCaption = localStorage.getItem('bgi_caption_result');
    if (savedCaption) setCaptionText(savedCaption);

    // Load active idea
    const savedIdeas = localStorage.getItem('bgi_generated_ideas');
    const savedActiveIdx = localStorage.getItem('bgi_active_idea_idx');
    if (savedIdeas && savedActiveIdx !== null) {
      try {
        const ideas = JSON.parse(savedIdeas);
        const idx = parseInt(savedActiveIdx);
        if (ideas[idx]) {
          setIdeaTitle(ideas[idx].title || '');
          setPlatform(ideas[idx].platform || 'Instagram');
          setContentFormat(ideas[idx].format || 'Carousel');
        }
      } catch (e) {}
    }

    // Also load platform/format from active settings
    const savedPlatform = localStorage.getItem('bgi_active_platform');
    if (savedPlatform) setPlatform(savedPlatform);
    const savedFormat = localStorage.getItem('bgi_active_format');
    if (savedFormat) setContentFormat(savedFormat);

    // Show context panel if there's data
    if (savedScript || savedCaption || savedHooks) {
      setShowContext(true);
    }

    // Auto-check Gemini login status on mount
    const autoCheckLogin = async () => {
      if (isLoginCheckingRef.current) return;
      isLoginCheckingRef.current = true;
      try {
        const res = await fetch('/api/check-gemini-login');
        const data = await res.json();
        if (data.success && data.loggedIn) {
          setGeminiLoginStatus('logged_in');
          setGeminiLoginMsg('✓ Sudah login ke Gemini');
        } else {
          setGeminiLoginStatus('not_logged_in');
          setGeminiLoginMsg(data.detail || 'Belum login ke Gemini');
        }
      } catch (_) {
        setGeminiLoginStatus('not_logged_in');
        setGeminiLoginMsg('Gagal mengecek login. Pastikan server backend berjalan (node server/scraper.mjs).');
      } finally {
        isLoginCheckingRef.current = false;
      }
    };
    autoCheckLogin();
  }, []);

  // Get brand profile from localStorage
  const getBrandProfile = () => ({
    niche: localStorage.getItem('bgi_brand_niche') || '',
    specificNiche: localStorage.getItem('bgi_brand_spec_niche') || '',
    superSpecificNiche: localStorage.getItem('bgi_brand_super_spec_niche') || '',
    positioning: localStorage.getItem('bgi_brand_positioning') || '',
    toneOfVoice: localStorage.getItem('bgi_brand_tone') || '',
    targetAudience: localStorage.getItem('bgi_brand_target') || '',
    segmentations: localStorage.getItem('bgi_brand_segments') || '',
  });

  // Parse hooks into image prompts using Gemini API (with full context)
  const handleParseFromHooks = async () => {
    if (!hookText.trim()) {
      setError('Tidak ada teks hook yang tersedia. Silakan generate hook terlebih dahulu di Hook Studio.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Menganalisis seluruh konteks (hook, script, caption) dan membuat prompt gambar detail...');

    try {
      const brandProfile = getBrandProfile();
      const result = await generateImagePrompts({
        hookText: hookText.trim(),
        scriptText: scriptText.trim(),
        captionText: captionText.trim(),
        ideaTitle: ideaTitle.trim(),
        platform,
        format: contentFormat,
        slideCount,
        brandProfile,
      });

      if (Array.isArray(result) && result.length > 0) {
        const newPrompts = result.map((item, idx) => ({
          id: Date.now() + idx,
          text: item.prompt || item.text || '',
          slide: item.slide || idx + 1,
          hook: item.hook || '',
          visualStyle: item.visualStyle || '',
          status: 'ready',
        }));
        setPrompts(prev => [...prev, ...newPrompts]);
        
        const contextUsed = [
          scriptText.trim() && 'Script',
          captionText.trim() && 'Caption',
          ideaTitle.trim() && 'Ide Konten',
        ].filter(Boolean);
        
        const contextMsg = contextUsed.length > 0 
          ? ` (menggunakan konteks: ${contextUsed.join(', ')})` 
          : '';
        
        setStatus(`${newPrompts.length} prompt gambar detail berhasil dibuat${contextMsg}!`);
      } else {
        setError('AI tidak menghasilkan prompt gambar. Coba lagi atau input manual.');
      }
    } catch (err) {
      setError(err.message || 'Gagal membuat prompt gambar dari hook.');
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(''), 4000);
    }
  };

  // Add manual prompt
  const handleAddPrompt = () => {
    if (!newPrompt.trim()) return;
    const item = {
      id: Date.now(),
      text: newPrompt.trim(),
      slide: prompts.length + 1,
      status: 'ready',
    };
    setPrompts(prev => [...prev, item]);
    setNewPrompt('');
  };

  // Remove a prompt
  const handleRemovePrompt = (id) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  // Edit a prompt
  const handleEditPrompt = (id, newText) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, text: newText } : p));
  };

  // Handle reference image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setReferenceImage(ev.target.result);
      setReferenceImagePreview(ev.target.result);
      // Reset analysis when new image is uploaded
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Remove reference image
  const handleRemoveImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Check Gemini login status
  const handleCheckGeminiLogin = async () => {
    if (isLoginCheckingRef.current) return;
    isLoginCheckingRef.current = true;

    setGeminiLoginStatus('checking');
    setGeminiLoginMsg('Memeriksa status login Gemini...');
    setError('');

    try {
      const response = await fetch('/api/check-gemini-login');
      const data = await response.json();

      if (data.success && data.loggedIn) {
        setGeminiLoginStatus('logged_in');
        setGeminiLoginMsg('✓ Anda sudah login ke Gemini!');
      } else {
        setGeminiLoginStatus('not_logged_in');
        setGeminiLoginMsg(data.detail || data.error || 'Anda belum login ke Gemini.');
      }
    } catch (err) {
      setGeminiLoginStatus('not_logged_in');
      setGeminiLoginMsg('Gagal terhubung ke server backend. Pastikan server scraper berjalan: node server/scraper.mjs');
      setError('Pastikan server scraper berjalan: node server/scraper.mjs');
    } finally {
      isLoginCheckingRef.current = false;
    }
  };

  // Open Gemini browser for login
  const handleOpenGeminiForLogin = async () => {
    setOpeningGeminiLogin(true);
    setError('');
    setStatus('Membuka browser Gemini untuk login...');

    try {
      const response = await fetch('/api/open-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hi',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('Browser Gemini terbuka! Silakan login dengan akun Google Anda, lalu klik "Saya sudah login" setelah selesai.');
      } else {
        setError(data.error || 'Gagal membuka Gemini.');
      }
    } catch (err) {
      setError('Gagal membuka browser. Pastikan server scraper berjalan.');
    } finally {
      setOpeningGeminiLogin(false);
    }
  };

  // Analyze reference image with Gemini Web (Playwright)
  const handleAnalyzeWithGemini = async () => {
    if (!referenceImage) {
      setError('Tidak ada gambar referensi yang diupload.');
      return;
    }

    // Cek login dulu jika belum pernah dicek
    if (geminiLoginStatus !== 'logged_in') {
      try {
        setStatus('Memeriksa status login Gemini...');
        const checkRes = await fetch('/api/check-gemini-login');
        const checkData = await checkRes.json();

        if (!checkData.success || !checkData.loggedIn) {
          setGeminiLoginStatus('not_logged_in');
          setGeminiLoginMsg('Anda harus login ke Gemini dulu sebelum menggunakan fitur ini.');
          setError('Anda belum login ke Gemini. Klik tombol "Buka Gemini untuk Login" di bawah.');
          return;
        }
        setGeminiLoginStatus('logged_in');
      } catch (err) {
        setError('Gagal memeriksa login. Pastikan server backend berjalan.');
        return;
      }
    }

    setAnalyzingImage(true);
    setError('');
    setStatus('Membuka Gemini Web dan mengupload gambar referensi untuk analisis... Ini membutuhkan waktu sekitar 30-60 detik.');

    try {
      const response = await fetch('/api/analyze-image-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage,
          contextInfo: [
            hookText.trim() ? `Hook: ${hookText.trim().substring(0, 200)}` : '',
            ideaTitle.trim() ? `Idea Title: ${ideaTitle.trim()}` : '',
          ].filter(Boolean).join('\n'),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const megaPrompt = data.megaPrompt || data.response;
        const analysis = data.analysis || '';

        const newPrompt = {
          id: Date.now(),
          text: megaPrompt,
          slide: prompts.length + 1,
          hook: 'Dari analisis gambar referensi',
          visualStyle: 'Based on reference image',
          status: 'ready',
        };
        setPrompts(prev => [...prev, newPrompt]);

        setAnalysisResult({
          analysis,
          megaPrompt,
          promptId: newPrompt.id,
        });

        setStatus('Analisis selesai! Prompt rekomendasi dari Gemini telah ditambahkan ke daftar.');
      } else if (data.isLoginRequired) {
        // Login terdeteksi expired di tengah proses
        setGeminiLoginStatus('not_logged_in');
        setGeminiLoginMsg('Sesi login Anda telah berakhir. Silakan login ulang.');
        setError(data.error || 'Sesi login berakhir. Klik "Buka Gemini untuk Login" untuk login ulang.');
      } else {
        setError(data.error || 'Gagal menganalisis gambar. Pastikan server backend berjalan (node server/scraper.mjs).');
      }
    } catch (err) {
      setError('Gagal terhubung ke server backend. Pastikan server scraper berjalan: node server/scraper.mjs');
    } finally {
      setAnalyzingImage(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  // Open Gemini with a specific prompt
  const handleOpenGemini = async (promptText, promptId) => {
    setOpeningPromptId(promptId);
    setStatus('Membuka browser Gemini... Mohon tunggu.');
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/open-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          referenceImage: referenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('Browser Gemini terbuka! Silakan klik Generate di browser.');
      } else {
        setError(data.error || 'Gagal membuka Gemini.');
      }
    } catch (err) {
      setError('Server scraper belum berjalankan. Silakan jalankan di terminal: node server/scraper.mjs');
    } finally {
      setOpeningPromptId(null);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = (text) => {
    navigator.clipboard.writeText(text);
    setStatus('Prompt disalin ke clipboard!');
    setTimeout(() => setStatus(''), 2000);
  };

  // Clear all
  const handleClearAll = () => {
    setPrompts([]);
    setNewPrompt('');
    handleRemoveImage();
    setError('');
    setStatus('');
  };

  return (
    <div className="image-generator-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Image Studio</h1>
          <p>Buat prompt gambar dari hook atau input manual, lalu buka Gemini untuk generate image satu per satu.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>

        {/* Left Panel: Configuration */}
        <div className="glass-card">
          <h2 className="card-title"><Image size={18} /> Konfigurasi Image</h2>

          {/* Hook Parser Section */}
          <div className="form-group">
            <label className="form-label">Teks Hook ( dari Hook Studio )</label>
            <textarea
              className="textarea-input"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="Tempel teks hook dari Hook Studio di sini, atau biarkan otomatis terisi..."
              style={{ minHeight: '160px', fontSize: '0.85rem' }}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Jumlah Slide</label>
              <select
                className="select-input"
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value))}
              >
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} gambar</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={handleParseFromHooks}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                disabled={loading || !hookText.trim()}
              >
                {loading ? (
                  <><div className="loading-spinner"></div> Menganalisis...</>
                ) : (
                  <><Sparkles size={16} /> Parse dari Hook</>
                )}
              </button>
            </div>
          </div>

          {/* Content Context Accordion */}
          <div style={{ 
            background: 'rgba(99, 102, 241, 0.05)', 
            borderRadius: '10px', 
            border: '1px solid rgba(99, 102, 241, 0.15)',
            marginBottom: '1rem',
            overflow: 'hidden'
          }}>
            <div 
              onClick={() => setShowContext(!showContext)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                userSelect: 'none',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#c7d2fe'
              }}
            >
              <span>📋 Konteks Konten (Script, Caption, Ide)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {showContext ? 'Sembunyikan ▴' : 'Tampilkan ▾'}
              </span>
            </div>

            {showContext && (
              <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Idea Title */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Judul Ide Konten</label>
                  <input
                    type="text"
                    className="input-text"
                    value={ideaTitle}
                    onChange={(e) => setIdeaTitle(e.target.value)}
                    placeholder="Judul ide konten..."
                    style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.75rem' }}
                  />
                </div>

                {/* Platform & Format */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Platform</label>
                    <select
                      className="select-input"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      style={{ height: '34px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                    >
                      {['Instagram', 'TikTok', 'Threads/X', 'YouTube', 'LinkedIn'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Format</label>
                    <select
                      className="select-input"
                      value={contentFormat}
                      onChange={(e) => setContentFormat(e.target.value)}
                      style={{ height: '34px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                    >
                      {['Carousel', 'Reels', 'Single Image', 'Carousel QnA', 'Carousel Step by Step', 'Carousel Study Case', 'Carousel Reaction'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Script Text */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                    Script / Naskah Konten
                    {scriptText && <span style={{ color: '#34d399', fontWeight: '400', marginLeft: '0.5rem' }}>✓ Terisi dari Script Builder</span>}
                  </label>
                  <textarea
                    className="textarea-input"
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Draf naskah konten akan otomatis terisi dari Script Builder..."
                    style={{ minHeight: '140px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                </div>

                {/* Caption Text */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                    Caption Postingan
                    {captionText && <span style={{ color: '#34d399', fontWeight: '400', marginLeft: '0.5rem' }}>✓ Terisi dari Caption Craft</span>}
                  </label>
                  <textarea
                    className="textarea-input"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Caption akan otomatis terisi dari Caption Craft..."
                    style={{ minHeight: '120px', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
                  💡 Semakin lengkap konteks yang diisi, semakin detail dan relevan prompt gambar yang dihasilkan AI.
                  Data otomatis terisi dari Script Builder, Hook Studio, dan Caption Craft.
                </div>
              </div>
            )}
          </div>

          {/* Manual Input Section */}
          <div className="form-group">
            <label className="form-label">Tambah Prompt Manual</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <textarea
                className="textarea-input"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Ketik prompt gambar manual, contoh: 'Flat illustration of a student reading a book at a cafe, warm tones, minimal style'"
                style={{ minHeight: '60px', flex: 1, fontSize: '0.85rem' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddPrompt();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddPrompt}
                className="btn btn-outline"
                style={{ alignSelf: 'flex-end', padding: '0.5rem 0.75rem' }}
                disabled={!newPrompt.trim()}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Reference Image Upload */}
          <div className="form-group">
            <label className="form-label">Gambar Referensi (Opsional)</label>
            <div
              className={`image-upload-zone ${referenceImagePreview ? 'has-image' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('dragover'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  const syntheticEvent = { target: { files: [file] } };
                  handleImageUpload(syntheticEvent);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              {referenceImagePreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src={referenceImagePreview}
                    alt="Referensi"
                    style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'contain' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleAnalyzeWithGemini(); }}
                      className="btn btn-secondary"
                      disabled={analyzingImage}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      {analyzingImage ? (
                        <><div className="loading-spinner"></div> Menganalisis...</>
                      ) : (
                        <><Sparkles size={14} /> Analisis dengan Gemini Web</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCheckGeminiLogin(); }}
                      className="btn btn-outline"
                      disabled={geminiLoginStatus === 'checking'}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                    >
                      {geminiLoginStatus === 'checking' ? 'Memeriksa...' : '🔑 Cek Login Gemini'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                      <Trash2 size={12} /> Hapus
                    </button>
                  </div>
                  {/* Login Status Indicator */}
                  {geminiLoginStatus && (
                    <div style={{
                      fontSize: '0.72rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '8px',
                      width: '100%',
                      textAlign: 'center',
                      background: geminiLoginStatus === 'logged_in'
                        ? 'rgba(52, 211, 153, 0.1)'
                        : geminiLoginStatus === 'checking'
                          ? 'rgba(251, 191, 36, 0.1)'
                          : 'rgba(239, 68, 68, 0.08)',
                      border: geminiLoginStatus === 'logged_in'
                        ? '1px solid rgba(52, 211, 153, 0.2)'
                        : geminiLoginStatus === 'checking'
                          ? '1px solid rgba(251, 191, 36, 0.2)'
                          : '1px solid rgba(239, 68, 68, 0.15)',
                      color: geminiLoginStatus === 'logged_in'
                        ? '#34d399'
                        : geminiLoginStatus === 'checking'
                          ? '#fbbf24'
                          : '#f87171',
                    }}>
                      {geminiLoginStatus === 'logged_in' ? (
                        '✓ Sudah login ke Gemini'
                      ) : geminiLoginStatus === 'checking' ? (
                        'Memeriksa status login...'
                      ) : (
                        <span>{geminiLoginMsg || 'Belum login ke Gemini'}</span>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={28} />
                  <span style={{ fontSize: '0.85rem' }}>Klik atau seret gambar ke sini</span>
                  <span style={{ fontSize: '0.7rem' }}>JPG, PNG, WebP — Maks 5MB</span>
                </div>
              )}
            </div>
            {referenceImagePreview && !analyzingImage && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', lineHeight: '1.4' }}>
                💡 Klik "Analisis dengan Gemini Web" untuk membuka Gemini AI, upload gambar, 
                dan mendapatkan rekomendasi prompt gambar mega-detail secara otomatis.
              </div>
            )}

            {/* Login Guide (tampil kapanpun jika belum login) */}
            {geminiLoginStatus === 'not_logged_in' && (
              <div style={{
                fontSize: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                width: '100%',
                marginTop: '0.5rem',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'center',
              }}>
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>
                  ⚠️ Login ke Gemini Diperlukan
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textAlign: 'center', lineHeight: '1.4' }}>
                  Fitur analisis gambar membutuhkan akses ke Gemini Web.
                  Klik tombol di bawah untuk membuka browser, lalu login dengan akun Google Anda.
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenGeminiForLogin(); }}
                    className="btn btn-primary"
                    disabled={openingGeminiLogin}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    {openingGeminiLogin ? (
                      <><div className="loading-spinner"></div> Membuka...</>
                    ) : (
                      <><ExternalLink size={14} /> Buka Gemini untuk Login</>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCheckGeminiLogin(); }}
                    className="btn btn-outline"
                    disabled={geminiLoginStatus === 'checking'}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                  >
                    {geminiLoginStatus === 'checking' ? 'Memeriksa...' : '✓ Saya sudah login'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Result Display */}
          {analysisResult && (
            <div className="form-group" style={{
              background: 'rgba(20, 184, 166, 0.05)',
              border: '1px solid rgba(20, 184, 166, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0, color: '#2dd4bf' }}>
                  ✨ Hasil Analisis dari Gemini
                </label>
                <button
                  onClick={() => {
                    const promptIdToRemove = analysisResult?.promptId;
                    setAnalysisResult(null);
                    if (promptIdToRemove) {
                      setPrompts(prev => prev.filter(p => p.id !== promptIdToRemove));
                    }
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                >
                  Tutup
                </button>
              </div>

              {analysisResult.analysis && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Visual Analysis</label>
                  <div className="generation-result-box" style={{ fontSize: '0.8rem', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
                    {analysisResult.analysis.substring(0, 1000)}
                    {analysisResult.analysis.length > 1000 && '...'}
                  </div>
                </div>
              )}

              {analysisResult.megaPrompt && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ fontSize: '0.7rem', color: '#2dd4bf' }}>Mega Prompt Recommendation</label>
                    <button
                      onClick={() => handleCopyPrompt(analysisResult.megaPrompt)}
                      className="btn btn-outline"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      <Copy size={12} /> Salin
                    </button>
                  </div>
                  <div className="generation-result-box" style={{ fontSize: '0.85rem', maxHeight: '250px', whiteSpace: 'pre-wrap' }}>
                    {analysisResult.megaPrompt}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status & Error */}
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem', background: 'rgba(239,68,68,0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
              {error}
            </p>
          )}
          {status && (
            <p style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '0.75rem', background: 'rgba(99,102,241,0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
              {status}
            </p>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleClearAll}
              className="btn btn-outline"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
            >
              <Trash2 size={16} /> Hapus Semua
            </button>
          </div>
        </div>

        {/* Right Panel: Prompt List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>Daftar Prompt ({prompts.length})</span>
            {prompts.length > 0 && (
              <button
                onClick={() => {
                  const allPrompts = prompts.map(p => `[Slide ${p.slide}] ${p.text}`).join('\n\n');
                  navigator.clipboard.writeText(allPrompts);
                  setStatus('Semua prompt disalin!');
                  setTimeout(() => setStatus(''), 2000);
                }}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
              >
                <Copy size={12} /> Salin Semua
              </button>
            )}
          </h2>

          {prompts.length > 0 ? (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
              {prompts.map((item, idx) => (
                <div key={item.id} className="prompt-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--primary)',
                        background: 'rgba(99,102,241,0.12)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                      }}>
                        Slide {item.slide || idx + 1}
                      </span>
                      {item.visualStyle && (
                        <span style={{
                          fontSize: '0.65rem',
                          color: '#2dd4bf',
                          background: 'rgba(20,184,166,0.1)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '999px',
                          border: '1px solid rgba(20,184,166,0.2)',
                        }}>
                          {item.visualStyle}
                        </span>
                      )}
                      {item.hook && (
                        <span className="hook-label">
                          {item.hook}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => handleCopyPrompt(item.text)}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        title="Salin prompt"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleRemovePrompt(item.id)}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                        title="Hapus prompt"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="textarea-input"
                    value={item.text}
                    onChange={(e) => handleEditPrompt(item.id, e.target.value)}
                    style={{
                      minHeight: '60px',
                      fontSize: '0.85rem',
                      background: 'transparent',
                      border: '1px solid transparent',
                      padding: '0.5rem',
                      resize: 'vertical',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />

                  <button
                    onClick={() => handleOpenGemini(item.text, item.id)}
                    className="btn btn-primary"
                    disabled={openingPromptId === item.id}
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      fontSize: '0.85rem',
                      padding: '0.5rem 1rem',
                      opacity: openingPromptId === item.id ? 0.6 : 1,
                    }}
                  >
                    {openingPromptId === item.id ? (
                      <><div className="loading-spinner"></div> Membuka...</>
                    ) : (
                      <><ExternalLink size={14} /> Buka di Gemini & Generate</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <Image size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>Belum Ada Prompt</h3>
              <p>Parse dari Hook atau tambahkan prompt manual di panel kiri.</p>
            </div>
          )}

          {/* Tip */}
          {prompts.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.02)',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '0.75rem',
            }}>
              <RefreshCw size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Klik "Buka di Gemini" pada setiap prompt untuk membuka browser Gemini. Upload gambar referensi akan otomatis terkirim jika sudah diunggah. Setelah prompt masuk, klik tombol <strong>Generate</strong> di browser Gemini secara manual.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
