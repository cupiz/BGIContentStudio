import React, { useState, useEffect, useRef } from 'react';
import { Image, Sparkles, Copy, Trash2, ExternalLink, Upload, Plus, RefreshCw } from 'lucide-react';
import { generateSingleImagePrompt, analyzeImageWithGeminiAPI } from '../services/gemini';

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
  const fileInputRef = useRef(null);

  // Clear any auto-loading on mount to guarantee clean state
  useEffect(() => {
    // Start completely clean as requested
  }, []);

  // Manual import from other studios when requested
  const handleImportFromStudios = () => {
    const savedHooks = localStorage.getItem('bgi_hooks_result');
    if (savedHooks) setHookText(savedHooks);

    const savedScript = localStorage.getItem('bgi_active_script');
    if (savedScript) setScriptText(savedScript);

    const savedCaption = localStorage.getItem('bgi_caption_result');
    if (savedCaption) setCaptionText(savedCaption);

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

    const savedPlatform = localStorage.getItem('bgi_active_platform');
    if (savedPlatform) setPlatform(savedPlatform);
    const savedFormat = localStorage.getItem('bgi_active_format');
    if (savedFormat) setContentFormat(savedFormat);

    if (savedScript || savedCaption || savedHooks) {
      setShowContext(true);
    }

    setStatus('Data berhasil di-import dari studio lain!');
    setTimeout(() => setStatus(''), 3000);
  };

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

  // Parse hooks into image prompts using Gemini API sequentially (slide-by-slide for consistency)
  const handleParseFromHooks = async () => {
    if (!hookText.trim()) {
      setError('Tidak ada teks hook yang tersedia. Silakan generate hook terlebih dahulu di Hook Studio.');
      return;
    }

    setLoading(true);
    setError('');
    setPrompts([]); // Clear old prompts so they load step by step!

    const brandProfile = getBrandProfile();
    const generated = [];

    try {
      for (let i = 1; i <= slideCount; i++) {
        setStatus(`Sedang membuat prompt gambar untuk Slide ${i} dari ${slideCount}...`);
        
        const result = await generateSingleImagePrompt({
          slideNumber: i,
          totalSlides: slideCount,
          hookText: hookText.trim(),
          scriptText: scriptText.trim(),
          captionText: captionText.trim(),
          ideaTitle: ideaTitle.trim(),
          platform,
          format: contentFormat,
          brandProfile,
          previousPrompts: generated, // Pass the already generated prompts
          referenceImage: referenceImage || null, // Pass reference image style guidelines if uploaded
        });

        if (result && result.prompt) {
          const newPrompt = {
            id: Date.now() + i,
            text: result.prompt,
            slide: result.slide || i,
            hook: result.hook || '',
            visualStyle: result.visualStyle || '',
            status: 'ready',
          };
          generated.push(result);
          setPrompts(prev => [...prev, newPrompt]);
        } else {
          throw new Error(`Gagal menghasilkan prompt untuk Slide ${i}.`);
        }
      }
      
      const contextUsed = [
        scriptText.trim() && 'Script',
        captionText.trim() && 'Caption',
        ideaTitle.trim() && 'Ide Konten',
      ].filter(Boolean);
      
      const contextMsg = contextUsed.length > 0 
        ? ` (menggunakan konteks: ${contextUsed.join(', ')})` 
        : '';
        
      setStatus(`Semua ${slideCount} prompt gambar detail berhasil dibuat secara konsisten${contextMsg}!`);
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


  // Analyze reference image using Gemini API directly
  const handleAnalyzeWithGemini = async () => {
    if (!referenceImage) {
      setError('Tidak ada gambar referensi yang diupload.');
      return;
    }

    if (!hookText.trim() && !ideaTitle.trim() && !scriptText.trim()) {
      setError('Teks Hook, Judul Ide Konten, atau Script tidak boleh kosong. Silakan isi terlebih dahulu agar AI dapat menghubungkan gaya gambar dengan topik konten Anda.');
      return;
    }

    setAnalyzingImage(true);
    setError('');
    setStatus('Menganalisis gambar menggunakan Gemini API langsung... Mohon tunggu.');

    try {
      const brandProfile = getBrandProfile();
      const data = await analyzeImageWithGeminiAPI({
        referenceImage,
        hookText: hookText.trim(),
        scriptText: scriptText.trim(),
        captionText: captionText.trim(),
        ideaTitle: ideaTitle.trim(),
        brandProfile,
        format: contentFormat,
      });

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
      } else {
        setError('Gagal menganalisis gambar. Silakan periksa kembali API Key Anda.');
      }
    } catch (err) {
      setError(`Gagal menganalisis gambar: ${err.message}`);
    } finally {
      setAnalyzingImage(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  // Open Gemini in standard browser securely and copy prompt
  const handleOpenGemini = async (promptText, promptId) => {
    setOpeningPromptId(promptId);
    setStatus('Menyalin prompt dan membuka Gemini...');
    setError('');

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(promptText);
      
      // Open in new tab securely
      window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
      
      setStatus('Prompt berhasil disalin ke clipboard! Tab Gemini telah terbuka. Silakan tempel (Paste/Ctrl+V) prompt di sana.');
    } catch (err) {
      setError(`Gagal memproses: ${err.message}`);
    } finally {
      setOpeningPromptId(null);
      setTimeout(() => setStatus(''), 6000);
    }
  };

  // Open ChatGPT in standard browser and prefill query parameter + copy to clipboard
  const handleOpenChatGPT = async (promptText, promptId) => {
    setOpeningPromptId(promptId);
    setStatus('Menyalin prompt dan membuka ChatGPT...');
    setError('');

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(promptText);
      
      // Open in new tab securely with query param
      const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`;
      window.open(chatgptUrl, '_blank', 'noopener,noreferrer');
      
      setStatus('Prompt berhasil disalin ke clipboard dan dimuat di ChatGPT!');
    } catch (err) {
      setError(`Gagal memproses: ${err.message}`);
    } finally {
      setOpeningPromptId(null);
      setTimeout(() => setStatus(''), 6000);
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
        <button
          type="button"
          onClick={handleImportFromStudios}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <span>📋 Import Data dari Studio</span>
        </button>
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
              style={{ minHeight: '220px', fontSize: '0.85rem' }}
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
                    style={{ minHeight: '200px', fontSize: '0.85rem', fontFamily: 'monospace' }}
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
                    style={{ minHeight: '180px', fontSize: '0.85rem' }}
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
                style={{ minHeight: '180px', flex: 1, fontSize: '0.85rem' }}
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
                        <><Sparkles size={14} /> Analisis dengan Gemini</>
                      )}
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
                💡 Klik "Analisis dengan Gemini" untuk mendeteksi gaya visual, subjek, setting, 
                dan menyusun rekomendasi prompt gambar mega-detail secara instan menggunakan API Key Anda.
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
                      minHeight: '280px',
                      fontSize: '0.85rem',
                      background: 'transparent',
                      border: '1px solid transparent',
                      padding: '0.5rem',
                      resize: 'vertical',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenGemini(item.text, item.id)}
                      className="btn btn-primary"
                      disabled={openingPromptId === item.id}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        padding: '0.5rem 0.75rem',
                        opacity: openingPromptId === item.id ? 0.6 : 1,
                      }}
                      title="Buka di Gemini (Paste manual)"
                    >
                      {openingPromptId === item.id ? (
                        <><div className="loading-spinner"></div></>
                      ) : (
                        <><ExternalLink size={14} /> Gemini</>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenChatGPT(item.text, item.id)}
                      className="btn btn-secondary"
                      disabled={openingPromptId === item.id}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        padding: '0.5rem 0.75rem',
                        opacity: openingPromptId === item.id ? 0.6 : 1,
                      }}
                      title="Buka di ChatGPT (Terisi otomatis)"
                    >
                      {openingPromptId === item.id ? (
                        <><div className="loading-spinner"></div></>
                      ) : (
                        <><ExternalLink size={14} /> ChatGPT</>
                      )}
                    </button>
                  </div>
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
              <span>Klik <strong>Gemini</strong> atau <strong>ChatGPT</strong> untuk meluncurkan AI. Prompt akan otomatis disalin ke clipboard Anda. Di ChatGPT, prompt akan langsung terisi secara otomatis di kolom input. Di Gemini, Anda cukup melakukan penempelan manual (Paste / Ctrl+V).</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
