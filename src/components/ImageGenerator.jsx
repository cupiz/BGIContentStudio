import React, { useState, useEffect, useRef } from 'react';
import { Image, Sparkles, Copy, Trash2, ExternalLink, Upload, Plus, RefreshCw, Download } from 'lucide-react';
import { generateSingleImagePrompt, analyzeImageWithGeminiAPI } from '../services/gemini';
import { generateImageWithOpenRouter, base64ToBlobUrl } from '../services/openrouter';

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
  const [openRouterModel, setOpenRouterModel] = useState('sourceful/riverflow-v2.5-fast');
  const [openRouterResolution, setOpenRouterResolution] = useState('1K');
  const [openRouterAspectRatio, setOpenRouterAspectRatio] = useState('1:1');
  const [generatedImages, setGeneratedImages] = useState({}); // { promptId: { loading, url, error } }
  const fileInputRef = useRef(null);

  // Auto-fill hook text from Hook Studio on mount
  useEffect(() => {
    const savedHooks = localStorage.getItem('bgi_hooks_result');
    if (savedHooks) {
      setHookText(savedHooks);
    }

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

    if (savedHooks || savedScript || savedCaption) {
      setShowContext(true);
    }

    // Restore saved ImageGenerator state (prompts, generated images, reference, settings)
    const savedPrompts = localStorage.getItem('bgi_image_prompts');
    if (savedPrompts) {
      try { setPrompts(JSON.parse(savedPrompts)); } catch (e) {}
    }

    const savedRef = localStorage.getItem('bgi_image_reference');
    if (savedRef) {
      try {
        const ref = JSON.parse(savedRef);
        if (ref.data) {
          setReferenceImage(ref.data);
          setReferenceImagePreview(ref.data);
        }
      } catch (e) {}
    }

    const savedState = localStorage.getItem('bgi_image_state');
    if (savedState) {
      try {
        const st = JSON.parse(savedState);
        if (st.slideCount) setSlideCount(st.slideCount);
        if (st.openRouterModel) setOpenRouterModel(st.openRouterModel);
        if (st.openRouterResolution) setOpenRouterResolution(st.openRouterResolution);
        if (st.openRouterAspectRatio) setOpenRouterAspectRatio(st.openRouterAspectRatio);
        if (typeof st.showContext === 'boolean') setShowContext(st.showContext);
      } catch (e) {}
    }

    // Restore generated images from raw data (recreate blob URLs from b64_json)
    const savedRawData = localStorage.getItem('bgi_image_raw_data');
    if (savedRawData) {
      try {
        const rawData = JSON.parse(savedRawData);
        const restored = {};
        Object.entries(rawData).forEach(([promptId, entry]) => {
          if (entry.type === 'url') {
            restored[promptId] = { loading: false, url: entry.data, error: null };
          } else if (entry.type === 'b64') {
            const url = base64ToBlobUrl(entry.data);
            restored[promptId] = { loading: false, url, error: null };
          } else if (entry.type === 'error') {
            restored[promptId] = { loading: false, url: null, error: entry.data };
          }
        });
        if (Object.keys(restored).length > 0) {
          setGeneratedImages(restored);
        }
      } catch (e) {}
    }
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
          setPrompts(prev => {
            const updated = [...prev, newPrompt];
            saveStateToLocalStorage(updated);
            return updated;
          });
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
    const updated = [...prompts, item];
    setPrompts(updated);
    saveStateToLocalStorage(updated);
    setNewPrompt('');
  };

  // Remove a prompt
  const handleRemovePrompt = (id) => {
    // Revoke blob URL if exists
    const img = generatedImages[id];
    if (img?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(img.url);
    }
    const updated = prompts.filter(p => p.id !== id);
    setPrompts(updated);
    saveStateToLocalStorage(updated);
    setGeneratedImages(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    removeRawImageData(id);
  };

  // Edit a prompt
  const handleEditPrompt = (id, newText) => {
    const updated = prompts.map(p => p.id === id ? { ...p, text: newText } : p);
    setPrompts(updated);
    saveStateToLocalStorage(updated);
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
      const dataUrl = ev.target.result;
      setReferenceImage(dataUrl);
      setReferenceImagePreview(dataUrl);
      saveReferenceToLocalStorage(dataUrl);
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
    saveReferenceToLocalStorage(null);
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
        const updatedWithAnalysis = [...prompts, newPrompt];
        setPrompts(updatedWithAnalysis);
        saveStateToLocalStorage(updatedWithAnalysis);

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

  // Helper: save current state to localStorage synchronously
  const saveStateToLocalStorage = (currentPrompts) => {
    localStorage.setItem('bgi_image_prompts', JSON.stringify(currentPrompts));
    localStorage.setItem('bgi_image_state', JSON.stringify({
      slideCount,
      openRouterModel,
      openRouterResolution,
      openRouterAspectRatio,
      showContext,
    }));
  };

  // Helper: save reference image to localStorage
  const saveReferenceToLocalStorage = (refData) => {
    if (refData) {
      localStorage.setItem('bgi_image_reference', JSON.stringify({ data: refData }));
    } else {
      localStorage.removeItem('bgi_image_reference');
    }
  };

  // Helper to save raw image data for persistence
  const saveRawImageData = (promptId, rawEntry) => {
    try {
      const existing = localStorage.getItem('bgi_image_raw_data');
      const data = existing ? JSON.parse(existing) : {};
      data[promptId] = rawEntry;
      localStorage.setItem('bgi_image_raw_data', JSON.stringify(data));
    } catch (e) {
      // localStorage may be full, silently fail
    }
  };

  const removeRawImageData = (promptId) => {
    try {
      const existing = localStorage.getItem('bgi_image_raw_data');
      if (!existing) return;
      const data = JSON.parse(existing);
      delete data[promptId];
      if (Object.keys(data).length === 0) {
        localStorage.removeItem('bgi_image_raw_data');
      } else {
        localStorage.setItem('bgi_image_raw_data', JSON.stringify(data));
      }
    } catch (e) {}
  };

  const clearAllRawImageData = () => {
    localStorage.removeItem('bgi_image_raw_data');
  };

  // Generate image with OpenRouter for a specific prompt
  const handleGenerateWithOpenRouter = async (promptText, promptId) => {
    if (!openRouterModel) {
      setError('Silakan pilih model OpenRouter terlebih dahulu.');
      return;
    }

    // Revoke old blob URL if exists
    const oldImg = generatedImages[promptId];
    if (oldImg?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(oldImg.url);
    }

    // Mark this prompt as generating
    setGeneratedImages(prev => ({ ...prev, [promptId]: { loading: true, url: null, error: null } }));
    setError('');
    setStatus(`Mengirim prompt ke OpenRouter (${openRouterModel})...`);

    try {
      const result = await generateImageWithOpenRouter({
        prompt: promptText,
        model: openRouterModel,
        resolution: openRouterResolution,
        aspectRatio: openRouterModel === 'x-ai/grok-imagine-image-quality' ? openRouterAspectRatio : undefined,
        referenceImage: referenceImage, // Pass reference image for img2img if uploaded
      });

      if (result.success && result.data.length > 0) {
        const imageData = result.data[0];
        let imageUrl = null;

        if (imageData.url) {
          imageUrl = imageData.url;
        } else if (imageData.b64_json) {
          imageUrl = base64ToBlobUrl(imageData.b64_json);
        }

        if (imageUrl) {
          setGeneratedImages(prev => ({ ...prev, [promptId]: { loading: false, url: imageUrl, error: null } }));
          // Save raw data for persistence
          if (imageData.b64_json) {
            saveRawImageData(promptId, { type: 'b64', data: imageData.b64_json });
          } else if (imageData.url) {
            saveRawImageData(promptId, { type: 'url', data: imageData.url });
          }
          setStatus(`✅ Gambar berhasil digenerate dengan ${openRouterModel}!`);
        } else {
          throw new Error('Tidak ada URL gambar yang diterima dari OpenRouter.');
        }
      } else {
        throw new Error('Gagal mendapatkan gambar dari OpenRouter.');
      }
    } catch (err) {
      setGeneratedImages(prev => ({ ...prev, [promptId]: { loading: false, url: null, error: err.message } }));
      saveRawImageData(promptId, { type: 'error', data: err.message });
      setError(`Gagal generate gambar: ${err.message}`);
    }

    setTimeout(() => setStatus(''), 5000);
  };

  // Clear all
  const handleClearAll = () => {
    // Revoke all blob URLs
    Object.values(generatedImages).forEach(img => {
      if (img?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
    setPrompts([]);
    setNewPrompt('');
    handleRemoveImage();
    setError('');
    setStatus('');
    setGeneratedImages({});
    clearAllRawImageData();
    localStorage.removeItem('bgi_image_prompts');
    localStorage.removeItem('bgi_image_reference');
    localStorage.removeItem('bgi_image_state');
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

          {/* ===== ALUR UTAMA: GAMBAR REFERENSI ===== */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(99, 102, 241, 0.08))',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            padding: '1rem',
            marginBottom: '1.25rem',
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#a78bfa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Upload size={16} /> 1. Upload Gambar Referensi
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
              Mulai dengan mengunggah gambar referensi sebagai panduan gaya visual. 
              Gambar ini akan digunakan sebagai acuan untuk image-to-image generation di OpenRouter.
              Setelah upload, klik <strong>"Analisis dengan Gemini"</strong> untuk mendapatkan prompt rekomendasi.
            </p>

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
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }}
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
                      <Trash2 size={12} /> Hapus Gambar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                  <Upload size={32} style={{ color: '#a78bfa' }} />
                  <span style={{ fontSize: '0.85rem' }}>Klik atau seret gambar ke sini</span>
                  <span style={{ fontSize: '0.7rem' }}>JPG, PNG, WebP — Maks 5MB</span>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Result Display */}
          {analysisResult && (
            <div className="form-group" style={{
              background: 'rgba(20, 184, 166, 0.05)',
              border: '1px solid rgba(20, 184, 166, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.25rem',
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
                  <div className="generation-result-box" style={{ fontSize: '0.8rem', maxHeight: '150px', whiteSpace: 'pre-wrap' }}>
                    {analysisResult.analysis.substring(0, 800)}
                    {analysisResult.analysis.length > 800 && '...'}
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
                  <div className="generation-result-box" style={{ fontSize: '0.85rem', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
                    {analysisResult.megaPrompt}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== ALUR KEDUA: PROMPT DARI HOOK ===== */}
          <div style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
            marginBottom: '0.5rem',
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#c7d2fe', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} /> 2. Generate Prompt dari Hook
            </h3>

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
              marginBottom: '0.75rem',
              overflow: 'hidden'
            }}>
              <div 
                onClick={() => setShowContext(!showContext)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.85rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#c7d2fe'
                }}
              >
                <span>📋 Konteks Konten (Script, Caption, Ide)</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {showContext ? 'Sembunyikan ▴' : 'Tampilkan ▾'}
                </span>
              </div>

              {showContext && (
                <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Idea Title */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Judul Ide Konten</label>
                    <input
                      type="text"
                      className="input-text"
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      placeholder="Judul ide konten..."
                      style={{ height: '32px', fontSize: '0.8rem', padding: '0 0.75rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Platform</label>
                      <select
                        className="select-input"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.8rem' }}
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
                        style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.8rem' }}
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
                      style={{ minHeight: '120px', fontSize: '0.85rem', fontFamily: 'monospace' }}
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
                      style={{ minHeight: '120px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
                    💡 Semakin lengkap konteks yang diisi, semakin detail dan relevan prompt gambar yang dihasilkan AI.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* OpenRouter Image Generation Settings */}
          <div style={{
            background: 'rgba(20, 184, 166, 0.05)',
            borderRadius: '10px',
            border: '1px solid rgba(20, 184, 166, 0.15)',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#2dd4bf', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Image size={16} /> 3. Generate Gambar dengan OpenRouter
            </h3>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Pilih Model</label>
              <select
                className="select-input"
                value={openRouterModel}
                onChange={(e) => setOpenRouterModel(e.target.value)}
                style={{ height: '34px', padding: '0 0.5rem', fontSize: '0.8rem' }}
              >
                <option value="sourceful/riverflow-v2.5-fast">Sourceful Riverflow v2.5 Fast (Cepat)</option>
                <option value="x-ai/grok-imagine-image-quality">xAI Grok Imagine Image Quality (Kualitas Tinggi)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Resolusi</label>
                <select
                  className="select-input"
                  value={openRouterResolution}
                  onChange={(e) => setOpenRouterResolution(e.target.value)}
                  style={{ height: '34px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="1K">1K (Cepat)</option>
                  <option value="2K">2K (Kualitas Tinggi)</option>
                </select>
              </div>
              {openRouterModel === 'x-ai/grok-imagine-image-quality' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Aspect Ratio</label>
                  <select
                    className="select-input"
                    value={openRouterAspectRatio}
                    onChange={(e) => setOpenRouterAspectRatio(e.target.value)}
                    style={{ height: '34px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value="1:1">1:1 (Kotak)</option>
                    <option value="3:4">3:4 (Portrait)</option>
                    <option value="4:3">4:3 (Landscape)</option>
                    <option value="9:16">9:16 (Story/Reels)</option>
                    <option value="16:9">16:9 (Wide)</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
              💡 Setelah prompt siap, klik tombol <strong>OpenRouter</strong> di setiap kartu prompt pada panel kanan untuk langsung generate gambar.
            </div>
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
                style={{ minHeight: '140px', flex: 1, fontSize: '0.85rem' }}
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
                    <button
                      onClick={() => handleGenerateWithOpenRouter(item.text, item.id)}
                      className="btn btn-outline"
                      disabled={generatedImages[item.id]?.loading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        padding: '0.5rem 0.75rem',
                        borderColor: 'rgba(20, 184, 166, 0.3)',
                        color: '#2dd4bf',
                        opacity: generatedImages[item.id]?.loading ? 0.6 : 1,
                      }}
                      title={`Generate dengan ${openRouterModel}`}
                    >
                      {generatedImages[item.id]?.loading ? (
                        <><div className="loading-spinner" style={{ borderTopColor: '#2dd4bf' }}></div></>
                      ) : (
                        <><Download size={14} /> OpenRouter</>
                      )}
                    </button>
                  </div>

                  {/* Generated Image Preview */}
                  {generatedImages[item.id]?.url && (
                    <div style={{ marginTop: '0.75rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <img
                        src={generatedImages[item.id].url}
                        alt={`Generated for slide ${item.slide || idx + 1}`}
                        style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }}
                      />
                      <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                        <span style={{ fontSize: '0.72rem', color: '#2dd4bf' }}>✅ Generated with {openRouterModel}</span>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = generatedImages[item.id].url;
                            link.download = `slide-${item.slide || idx + 1}.png`;
                            link.click();
                          }}
                          className="btn btn-outline"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Generated Image Error */}
                  {generatedImages[item.id]?.error && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: '0.75rem',
                      color: '#f87171',
                    }}>
                      ⚠️ {generatedImages[item.id].error}
                    </div>
                  )}
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
