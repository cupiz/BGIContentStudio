import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Plus, Calendar, Download, Eye, CalendarCheck2, ArrowRight, Trash2 } from 'lucide-react';
import { generateContentIdeas, generateScript } from '../services/gemini';

export default function ScriptGenerator({ onNavigateToHooks, onNavigateToCaptions }) {
  // Load pillars and settings
  const [pillars, setPillars] = useState([]);
  const [selectedPillarIndex, setSelectedPillarIndex] = useState(0);
  const [ideaCount, setIdeaCount] = useState(10);
  
  // List of generated ideas
  const [ideas, setIdeas] = useState([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  
  // Active script state
  const [activeIdeaIndex, setActiveIdeaIndex] = useState(-1);
  const [loadingScript, setLoadingScript] = useState(false);

  // Split Script Generator states (similar to SCRIPT GENERATOR columns in Excel)
  const [draftScript, setDraftScript] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [visualSuggestions, setVisualSuggestions] = useState('');
  const [fullCaption, setFullCaption] = useState('');
  const [activeTab, setActiveTab] = useState('script'); // 'script', 'visual', 'cta', 'caption'

  // Dropdown states for platform, format, valueAdd, storytelling
  const [selectedPlatform, setSelectedPlatform] = useState('Instagram');
  const [selectedFormat, setSelectedFormat] = useState('Reels');
  const [selectedValueAdd, setSelectedValueAdd] = useState('Edukasi/Wawasan');
  const [selectedStorytelling, setSelectedStorytelling] = useState('Problem-Solution');

  // Error state
  const [error, setError] = useState('');

  // Brand profile fallback
  const getBrandProfile = () => {
    return {
      niche: localStorage.getItem('bgi_brand_niche') || '',
      specificNiche: localStorage.getItem('bgi_brand_spec_niche') || '',
      superSpecificNiche: localStorage.getItem('bgi_brand_super_spec_niche') || '',
      positioning: localStorage.getItem('bgi_brand_positioning') || '',
      archetype: localStorage.getItem('bgi_brand_archetype') || '',
      toneOfVoice: localStorage.getItem('bgi_brand_tone') || '',
      communicationDesc: localStorage.getItem('bgi_brand_comm_desc') || '',
      targetAudience: localStorage.getItem('bgi_brand_target') || '',
      segmentations: localStorage.getItem('bgi_brand_segments') || '',
    };
  };

  useEffect(() => {
    const savedPillars = localStorage.getItem('bgi_pillars_list');
    if (savedPillars) {
      try {
        setPillars(JSON.parse(savedPillars));
      } catch (e) {
        console.error(e);
      }
    }

    let parsedIdeas = [];
    const savedIdeas = localStorage.getItem('bgi_generated_ideas');
    if (savedIdeas) {
      try {
        parsedIdeas = JSON.parse(savedIdeas);
        setIdeas(parsedIdeas);
      } catch (e) {}
    }

    const savedActiveIndex = localStorage.getItem('bgi_active_idea_idx');
    if (savedActiveIndex !== null && savedActiveIndex !== undefined && savedActiveIndex !== '') {
      const idx = parseInt(savedActiveIndex);
      setActiveIdeaIndex(idx);
      
      const idea = parsedIdeas[idx];
      if (idea) {
        setSelectedPlatform(localStorage.getItem('bgi_active_platform') || idea.platform || 'Instagram');
        setSelectedFormat(localStorage.getItem('bgi_active_format') || idea.format || 'Reels');
        setSelectedValueAdd(localStorage.getItem('bgi_active_valueAdd') || idea.valueAdd || 'Edukasi/Wawasan');
        setSelectedStorytelling(localStorage.getItem('bgi_active_storytelling') || idea.storytelling || 'Problem-Solution');
      }
    }

    const savedScript = localStorage.getItem('bgi_active_script');
    if (savedScript) {
      setDraftScript(savedScript);
    }
    const savedCta = localStorage.getItem('bgi_active_cta');
    if (savedCta) {
      setCtaText(savedCta);
    }
    const savedVisual = localStorage.getItem('bgi_active_visual');
    if (savedVisual) {
      setVisualSuggestions(savedVisual);
    }
    const savedCaption = localStorage.getItem('bgi_active_caption');
    if (savedCaption) {
      setFullCaption(savedCaption);
    }
  }, []);

  const handleGenerateIdeas = async () => {
    if (pillars.length === 0) {
      setError('Harap buat pilar konten terlebih dahulu di tab Pillar Strategy.');
      return;
    }
    
    setLoadingIdeas(true);
    setError('');
    
    const activePillar = pillars[selectedPillarIndex];
    const brandProfile = getBrandProfile();
    
    try {
      const generated = await generateContentIdeas({
        pillarName: activePillar.name,
        pillarDesc: activePillar.description,
        brandProfile,
        count: ideaCount
      });
      
      setIdeas(generated);
      localStorage.setItem('bgi_generated_ideas', JSON.stringify(generated));
      
      // Clear current active script since ideas list changed
      setActiveIdeaIndex(-1);
      setDraftScript('');
      setCtaText('');
      setVisualSuggestions('');
      setFullCaption('');
      localStorage.removeItem('bgi_active_idea_idx');
      localStorage.removeItem('bgi_active_script');
      localStorage.removeItem('bgi_active_cta');
      localStorage.removeItem('bgi_active_visual');
      localStorage.removeItem('bgi_active_caption');
      localStorage.removeItem('bgi_active_platform');
      localStorage.removeItem('bgi_active_format');
      localStorage.removeItem('bgi_active_valueAdd');
      localStorage.removeItem('bgi_active_storytelling');
    } catch (err) {
      setError(err.message || 'Gagal generate ide konten.');
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleSelectIdea = (idx) => {
    setActiveIdeaIndex(idx);
    localStorage.setItem('bgi_active_idea_idx', idx.toString());

    const idea = ideas[idx];
    if (idea) {
      setSelectedPlatform(idea.platform || 'Instagram');
      setSelectedFormat(idea.format || 'Reels');
      setSelectedValueAdd(idea.valueAdd || 'Edukasi/Wawasan');
      setSelectedStorytelling(idea.storytelling || 'Problem-Solution');
      localStorage.setItem('bgi_active_platform', idea.platform || 'Instagram');
      localStorage.setItem('bgi_active_format', idea.format || 'Reels');
      localStorage.setItem('bgi_active_valueAdd', idea.valueAdd || 'Edukasi/Wawasan');
      localStorage.setItem('bgi_active_storytelling', idea.storytelling || 'Problem-Solution');
    }

    setDraftScript('');
    setCtaText('');
    setVisualSuggestions('');
    setFullCaption('');
    localStorage.removeItem('bgi_active_script');
    localStorage.removeItem('bgi_active_cta');
    localStorage.removeItem('bgi_active_visual');
    localStorage.removeItem('bgi_active_caption');
    setError('');
    setActiveTab('script');
  };

  const handlePlatformChange = (val) => {
    setSelectedPlatform(val);
    localStorage.setItem('bgi_active_platform', val);
  };

  const handleFormatChange = (val) => {
    setSelectedFormat(val);
    localStorage.setItem('bgi_active_format', val);
  };

  const handleValueAddChange = (val) => {
    setSelectedValueAdd(val);
    localStorage.setItem('bgi_active_valueAdd', val);
  };

  const handleStorytellingChange = (val) => {
    setSelectedStorytelling(val);
    localStorage.setItem('bgi_active_storytelling', val);
  };

  const handleGenerateScript = async () => {
    if (activeIdeaIndex === -1) return;

    setLoadingScript(true);
    setError('');
    setDraftScript('');
    setCtaText('');
    setVisualSuggestions('');
    setFullCaption('');

    const idea = ideas[activeIdeaIndex];
    const brandProfile = getBrandProfile();

    try {
      const parsed = await generateScript({
        title: idea.title,
        pillar: idea.pillar || pillars[selectedPillarIndex]?.name || 'Pilar Strategis',
        platform: selectedPlatform,
        format: selectedFormat,
        valueAdd: selectedValueAdd,
        storytelling: selectedStorytelling,
        brief: idea.brief,
        brandProfile
      });

      const scriptVal = parsed.draftScript || '';
      const ctaVal = parsed.cta || '';
      const visualVal = parsed.visualSuggestions || '';
      const captionVal = parsed.fullCaption || '';

      setDraftScript(scriptVal);
      setCtaText(ctaVal);
      setVisualSuggestions(visualVal);
      setFullCaption(captionVal);

      localStorage.setItem('bgi_active_script', scriptVal);
      localStorage.setItem('bgi_active_cta', ctaVal);
      localStorage.setItem('bgi_active_visual', visualVal);
      localStorage.setItem('bgi_active_caption', captionVal);
    } catch (err) {
      setError(err.message || 'Gagal generate naskah konten.');
    } finally {
      setLoadingScript(false);
    }
  };

  const handleAddToBatching = (idea, useActiveDropdowns = false) => {
    const savedBatch = localStorage.getItem('bgi_batching_list');
    let batchList = [];
    if (savedBatch) {
      try {
        batchList = JSON.parse(savedBatch);
      } catch (e) {}
    }

    const platform = useActiveDropdowns ? selectedPlatform : (idea.platform || 'Instagram');
    const format = useActiveDropdowns ? selectedFormat : (idea.format || 'Reels');
    const valueAdd = useActiveDropdowns ? selectedValueAdd : (idea.valueAdd || 'Edukasi/Wawasan');
    const storytelling = useActiveDropdowns ? selectedStorytelling : (idea.storytelling || 'Problem-Solution');

    // Check if already in batching
    const existingIndex = batchList.findIndex(item => item.title === idea.title);
    if (existingIndex !== -1) {
      // Update existing item
      batchList[existingIndex] = {
        ...batchList[existingIndex],
        platform,
        format,
        valueAdd,
        storytelling,
        script: draftScript || batchList[existingIndex].script || '',
        visual: visualSuggestions || batchList[existingIndex].visual || '',
        caption: fullCaption || batchList[existingIndex].caption || '',
        cta: ctaText || batchList[existingIndex].cta || '',
        status: draftScript ? 'Siap Posting' : batchList[existingIndex].status,
      };
      localStorage.setItem('bgi_batching_list', JSON.stringify(batchList));
      alert("Berhasil memperbarui Tracker!");
      return;
    }

    // Add new item
    const newBatchItem = {
      id: Date.now().toString(),
      title: idea.title,
      pillar: idea.pillar || pillars[selectedPillarIndex]?.name || 'General',
      platform,
      format,
      valueAdd,
      storytelling,
      brief: idea.brief,
      script: draftScript || '',
      visual: visualSuggestions || '',
      caption: fullCaption || '',
      cta: ctaText || '',
      status: draftScript ? 'Siap Posting' : 'Dalam Proses',
      scheduledDate: new Date().toISOString().split('T')[0],
    };

    const updated = [newBatchItem, ...batchList];
    localStorage.setItem('bgi_batching_list', JSON.stringify(updated));
    alert("Berhasil ditambahkan ke Dashboard Tracker!");
  };

  const handleScriptChange = (e) => {
    const text = e.target.value;
    setDraftScript(text);
    localStorage.setItem('bgi_active_script', text);
  };

  const handleCopyToClipboard = () => {
    let copyText = '';
    if (activeTab === 'script') copyText = draftScript;
    else if (activeTab === 'visual') copyText = visualSuggestions;
    else if (activeTab === 'cta') copyText = ctaText;
    else if (activeTab === 'caption') copyText = fullCaption;

    navigator.clipboard.writeText(copyText || draftScript);
    alert('Teks berhasil disalin ke papan klip!');
  };

  const handleClearWorkspace = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh isi di Workspace Script ini?")) {
      setDraftScript('');
      setCtaText('');
      setVisualSuggestions('');
      setFullCaption('');
      localStorage.removeItem('bgi_active_script');
      localStorage.removeItem('bgi_active_cta');
      localStorage.removeItem('bgi_active_visual');
      localStorage.removeItem('bgi_active_caption');
    }
  };

  return (
    <div className="script-generator-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Script & Idea Builder</h1>
          <p>Hasilkan ide topik konten viral dari pilar strategi Anda dan susun naskah siap pakai dalam hitungan detik.</p>
        </div>
      </div>

      {pillars.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <FileText size={48} />
            <h3>Strategi Pilar Konten Belum Ada</h3>
            <p style={{ marginBottom: '1rem' }}>Anda harus mendefinisikan pilar konten Anda terlebih dahulu di menu <strong>Pillar Strategy</strong>.</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Setup Pilar Sekarang</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Generation Options Panel */}
          <div className="glass-card">
            <h2 className="card-title"><Sparkles size={18} /> Konfigurasi Ideasi</h2>
            <div className="grid-3" style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pilih Pilar Utama</label>
                <select 
                  className="select-input"
                  value={selectedPillarIndex}
                  onChange={(e) => setSelectedPillarIndex(parseInt(e.target.value))}
                >
                  {pillars.map((pillar, idx) => (
                    <option key={idx} value={idx}>{pillar.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Jumlah Ide Konten</label>
                <input 
                  type="number" 
                  className="input-text" 
                  value={ideaCount}
                  onChange={(e) => setIdeaCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="25"
                />
              </div>

              <button 
                onClick={handleGenerateIdeas} 
                className="btn btn-primary" 
                style={{ height: '43px' }} 
                disabled={loadingIdeas}
              >
                {loadingIdeas ? (
                  <><div className="loading-spinner"></div> Menggali Ide Konten...</>
                ) : (
                  <><Sparkles size={16} /> Generate Ide Konten</>
                )}
              </button>
            </div>
            
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>}
          </div>

          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'stretch' }}>
            
            {/* Left Column: Bank Ide Konten (Excel Bank Ide equivalent) */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 className="card-title">Bank Ide Konten</h2>
              
              {ideas.length === 0 ? (
                <div className="empty-state" style={{ flex: 1 }}>
                  <FileText size={40} />
                  <h3>Bank Ide Kosong</h3>
                  <p>Pilih pilar di atas dan generate ide konten baru untuk mengisi daftar ini.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {ideas.map((idea, idx) => (
                    <div 
                      key={idx} 
                      className={`glass-card ${activeIdeaIndex === idx ? 'active' : ''}`} 
                      style={{ 
                        padding: '1rem', 
                        cursor: 'pointer',
                        borderColor: activeIdeaIndex === idx ? 'var(--primary)' : 'var(--border-color)',
                        background: activeIdeaIndex === idx ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)'
                      }}
                      onClick={() => handleSelectIdea(idx)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', color: activeIdeaIndex === idx ? '#c7d2fe' : 'var(--text-primary)', fontWeight: '600' }}>
                          {idea.title}
                        </h3>
                      </div>
                      
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{idea.brief}</p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                        <span className="badge badge-primary">{idea.platform}</span>
                        <span className="badge badge-secondary">{idea.format}</span>
                        <span className="badge badge-info">{idea.valueAdd}</span>
                        <span className="badge badge-warning">{idea.storytelling}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToBatching(idea);
                          }} 
                          className="btn btn-outline" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Plus size={12} /> Tambah ke Tracker
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Detailed Scripting (Workspace Naskah) */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
                <span>Workspace Script Konten</span>
                {activeIdeaIndex !== -1 && (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button 
                      onClick={handleClearWorkspace} 
                      className="btn btn-outline" 
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                    >
                      Hapus
                    </button>
                    <button onClick={handleCopyToClipboard} className="btn btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} disabled={!draftScript}>
                      Salin Teks
                    </button>
                    <button 
                      onClick={() => handleAddToBatching(ideas[activeIdeaIndex], true)} 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      {draftScript ? 'Update Tracker' : 'Tambah ke Tracker'}
                    </button>
                  </div>
                )}
              </h2>

              {activeIdeaIndex === -1 ? (
                <div className="empty-state" style={{ flex: 1 }}>
                  <Eye size={40} />
                  <h3>Tidak Ada Script Aktif</h3>
                  <p>Klik salah satu ide konten di sebelah kiri untuk men-generate dan menyusun script.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Configuration Form above script text */}
                  <div style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#c7d2fe', fontWeight: '600' }}>{ideas[activeIdeaIndex]?.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{ideas[activeIdeaIndex]?.brief}</p>
                    </div>

                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '0.75rem',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      paddingTop: '0.75rem'
                    }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Platform</label>
                        <select 
                          className="select-input" 
                          value={selectedPlatform} 
                          onChange={(e) => handlePlatformChange(e.target.value)}
                          style={{ height: '35px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                        >
                          {['Instagram', 'TikTok', 'Threads/X', 'YouTube', 'LinkedIn'].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Format</label>
                        <select 
                          className="select-input" 
                          value={selectedFormat} 
                          onChange={(e) => handleFormatChange(e.target.value)}
                          style={{ height: '35px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                        >
                          {['Reels', 'Carousel', 'Single Image', 'Text Threads/X', 'Video Panjang', 'Video Pendek', 'Video Voice Over', 'Video Reaction', 'Video Multitasking', 'Faceless', 'Video Talking Head', 'Carousel QnA', 'Carousel Reaction', 'Carousel Step by Step', 'Carousel Study Case', 'Visual Proof/Demo'].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Nilai Tambah</label>
                        <select 
                          className="select-input" 
                          value={selectedValueAdd} 
                          onChange={(e) => handleValueAddChange(e.target.value)}
                          style={{ height: '35px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                        >
                          {['Edukasi/Wawasan', 'Solusi', 'Inspirasi/Motivasi', 'Hiburan', 'Validasi/Bukti', 'Perspektif Baru', 'Informasi', 'Komunitas', 'Conversion/Jualan'].map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Storytelling</label>
                        <select 
                          className="select-input" 
                          value={selectedStorytelling} 
                          onChange={(e) => handleStorytellingChange(e.target.value)}
                          style={{ height: '35px', padding: '0 0.5rem', fontSize: '0.8rem' }}
                        >
                          {['Karakter + Tujuan + Halangan', 'Karakter + Tujuan + Halangan + Brand as A Hero', 'Karakter + Tujuan + Halangan + Produk as A Hero', 'Karakter + Tujuan + Halangan + Kamu as A Hero', 'Karakter (audienceku) + Tujuan + Halangan', 'Karakter (Orang lain) + Tujuan + Halangan + Produk as A Hero', 'Zero to Hero', "The Hero's Journey", 'Problem-Solution', 'Before-After', 'Case Study/Testimonial', 'The Why Story', 'In Media Res', 'False Star', "The 'Aha' Moment", 'The Underdog'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerateScript} 
                      className="btn btn-primary" 
                      style={{ marginTop: '0.25rem', width: '100%', height: '38px' }}
                      disabled={loadingScript}
                    >
                      {loadingScript ? (
                        <><div className="loading-spinner"></div> Merumuskan Script...</>
                      ) : (
                        <><Sparkles size={14} /> Generate Script dengan AI</>
                      )}
                    </button>
                  </div>

                  {draftScript && (
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', position: 'relative' }}>
                      
                      {/* Tabs Navigation */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.35rem', 
                        marginBottom: '0.75rem', 
                        borderBottom: '1px solid rgba(255,255,255,0.08)', 
                        paddingBottom: '0.5rem',
                        overflowX: 'auto'
                      }}>
                        {[
                          { id: 'script', label: 'Draft Script' },
                          { id: 'visual', label: 'Saran Visual' },
                          { id: 'cta', label: 'Pilihan CTA' },
                          { id: 'caption', label: 'Full Caption' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                            style={{ 
                              padding: '0.35rem 0.65rem', 
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              border: activeTab === tab.id ? 'none' : '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {activeTab === 'script' && 'Draf Naskah Script (Bisa Diedit)'}
                        {activeTab === 'visual' && 'Saran Visual & Panel (Bisa Diedit)'}
                        {activeTab === 'cta' && 'Alternatif Call-to-Action (Bisa Diedit)'}
                        {activeTab === 'caption' && 'Caption Copywriting & Hashtags (Bisa Diedit)'}
                      </label>

                      {activeTab === 'script' && (
                        <textarea 
                          className="textarea-input"
                          value={draftScript}
                          onChange={handleScriptChange}
                          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', minHeight: '280px' }}
                          placeholder="Teks draf naskah..."
                        />
                      )}

                      {activeTab === 'visual' && (
                        <textarea 
                          className="textarea-input"
                          value={visualSuggestions}
                          onChange={(e) => {
                            setVisualSuggestions(e.target.value);
                            localStorage.setItem('bgi_active_visual', e.target.value);
                          }}
                          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', minHeight: '280px' }}
                          placeholder="Saran scene visual / slide panel..."
                        />
                      )}

                      {activeTab === 'cta' && (
                        <textarea 
                          className="textarea-input"
                          value={ctaText}
                          onChange={(e) => {
                            setCtaText(e.target.value);
                            localStorage.setItem('bgi_active_cta', e.target.value);
                          }}
                          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', minHeight: '280px' }}
                          placeholder="Pilihan CTA..."
                        />
                      )}

                      {activeTab === 'caption' && (
                        <textarea 
                          className="textarea-input"
                          value={fullCaption}
                          onChange={(e) => {
                            setFullCaption(e.target.value);
                            localStorage.setItem('bgi_active_caption', e.target.value);
                          }}
                          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', minHeight: '280px' }}
                          placeholder="Full caption postingan..."
                        />
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={onNavigateToHooks} className="btn btn-outline" style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            Buat Hook <ArrowRight size={14} />
                          </button>
                          <button onClick={onNavigateToCaptions} className="btn btn-outline" style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            Buat Caption <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
