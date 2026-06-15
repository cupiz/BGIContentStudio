import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Plus, Trash2, Edit2, Check, ArrowRight, Bot } from 'lucide-react';
import { 
  generateContentPillars, 
  generateBrandProfile, 
  generateContentIdeas, 
  generateScript, 
  generateHooks, 
  generateCaption,
  scrapeInstagramAndDetermineNiche
} from '../services/gemini';

const ARCHETYPES = [
  { name: 'The Creator', desc: 'Fokus pada kreativitas, karya, keorisinalan & makna.' },
  { name: 'The Ruler', desc: 'Pemimpin tegas, profesional, tertata & terpercaya.' },
  { name: 'The Hero', desc: 'Bersemangat tinggi, hadapi tantangan & berdaya.' },
  { name: 'The Caregiver', desc: 'Peduli, melayani, menenangkan & membantu sesama.' },
  { name: 'The Explorer', desc: 'Suka kebebasan, petualangan & bertumbuh mandiri.' },
  { name: 'The Innocent', desc: 'Simple, jujur, optimis, damai & selalu positif.' },
  { name: 'The Rebel', desc: 'Anti-mainstream, berani beda & mendobrak aturan.' },
  { name: 'The Lover', desc: 'Hangat, membangun ikatan emosi & keindahan.' },
  { name: 'The Magician', desc: 'Transformative, inovatif & hadirkan wow-moment.' },
  { name: 'The Everyman', desc: 'Ramah, relatable, down-to-earth & seperti teman.' },
  { name: 'The Sage', desc: 'Pencari kebenaran dan kebijaksanaan. Fokus pada pengetahuan dan kebenaran.' },
  { name: 'The Jester', desc: 'Pembawa keceriaan dan humor. Fokus pada kesenangan dan tawa.' }
];

export default function PillarMapping({ onNavigateToScripts }) {
  // Brand States
  const [niche, setNiche] = useState('');
  const [specificNiche, setSpecificNiche] = useState('');
  const [superSpecificNiche, setSuperSpecificNiche] = useState('');
  const [positioning, setPositioning] = useState('');
  const [archetype, setArchetype] = useState('The Everyman');
  const [toneOfVoice, setToneOfVoice] = useState('');
  const [communicationDesc, setCommunicationDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [segmentations, setSegmentations] = useState('');

  // Pillars List State
  const [pillars, setPillars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Autopilot States
  const [automationStep, setAutomationStep] = useState(0); 
  const [automationLoading, setAutomationLoading] = useState(false);
  
  // Instagram Niche States
  const [igUsername, setIgUsername] = useState('');
  const [scrapedPosts, setScrapedPosts] = useState([]);
  const [scrapingIg, setScrapingIg] = useState(false);
  const [showScrapedPosts, setShowScrapedPosts] = useState(false);
  const [igAccountInfo, setIgAccountInfo] = useState(null);
  const [igHtml, setIgHtml] = useState('');
  const [useHtmlPaste, setUseHtmlPaste] = useState(false);
  const [showIgScraper, setShowIgScraper] = useState(false);
  
  // Custom manual entry states
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarDesc, setNewPillarDesc] = useState('');
  
  // Edit state
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    // Load from localStorage
    setNiche(localStorage.getItem('bgi_brand_niche') || '');
    setSpecificNiche(localStorage.getItem('bgi_brand_spec_niche') || '');
    setSuperSpecificNiche(localStorage.getItem('bgi_brand_super_spec_niche') || '');
    setPositioning(localStorage.getItem('bgi_brand_positioning') || '');
    setArchetype(localStorage.getItem('bgi_brand_archetype') || 'The Everyman');
    const savedTone = localStorage.getItem('bgi_brand_tone');
    const validTones = ['Friendly', 'Professional', 'Confident', 'Playful', 'Calm', 'Fun & Energetic', 'Elegant', 'Warm', 'Bold', 'Empathetic', 'Inspirational', 'Witty', 'Serious'];
    setToneOfVoice(validTones.includes(savedTone) ? savedTone : '');
    setCommunicationDesc(localStorage.getItem('bgi_brand_comm_desc') || '');
    setTargetAudience(localStorage.getItem('bgi_brand_target') || '');
    setSegmentations(localStorage.getItem('bgi_brand_segments') || '');

    const savedPillars = localStorage.getItem('bgi_pillars_list');
    if (savedPillars) {
      try {
        setPillars(JSON.parse(savedPillars));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveBrandProfileToLocalStorage = (currentPillars = pillars) => {
    localStorage.setItem('bgi_brand_niche', niche);
    localStorage.setItem('bgi_brand_spec_niche', specificNiche);
    localStorage.setItem('bgi_brand_super_spec_niche', superSpecificNiche);
    localStorage.setItem('bgi_brand_positioning', positioning);
    localStorage.setItem('bgi_brand_archetype', archetype);
    localStorage.setItem('bgi_brand_tone', toneOfVoice);
    localStorage.setItem('bgi_brand_comm_desc', communicationDesc);
    localStorage.setItem('bgi_brand_target', targetAudience);
    localStorage.setItem('bgi_brand_segments', segmentations);
    localStorage.setItem('bgi_pillars_list', JSON.stringify(currentPillars));
  };

  const handleGeneratePillars = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTestResultNull();

    try {
      const generated = await generateContentPillars({
        niche,
        specificNiche,
        superSpecificNiche,
        positioning,
        archetype,
        toneOfVoice,
        communicationDesc,
        targetAudience,
        segmentations
      });
      setPillars(generated);
      saveBrandProfileToLocalStorage(generated);
    } catch (err) {
      setError(err.message || 'Gagal menghasilkan pilar konten. Silakan cek API Key Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to clear test error
  const setTestResultNull = () => setError('');

  const handleClearBrandProfile = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua isi Profil Strategis Brand?")) {
      setNiche('');
      setSpecificNiche('');
      setSuperSpecificNiche('');
      setPositioning('');
      setArchetype('The Everyman');
      setToneOfVoice('');
      setCommunicationDesc('');
      setTargetAudience('');
      setSegmentations('');
      
      // Remove from localStorage
      localStorage.removeItem('bgi_brand_niche');
      localStorage.removeItem('bgi_brand_spec_niche');
      localStorage.removeItem('bgi_brand_super_spec_niche');
      localStorage.removeItem('bgi_brand_positioning');
      localStorage.removeItem('bgi_brand_archetype');
      localStorage.removeItem('bgi_brand_tone');
      localStorage.removeItem('bgi_brand_comm_desc');
      localStorage.removeItem('bgi_brand_target');
      localStorage.removeItem('bgi_brand_segments');
    }
  };

  const handleClearAllPillars = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh pilar konten yang ada?")) {
      setPillars([]);
      localStorage.removeItem('bgi_pillars_list');
    }
  };

  const handleAnalyzeInstagram = async (e) => {
    e.preventDefault();
    
    const targetUsername = igUsername.trim() || 'leaders_id';
    const targetHtml = useHtmlPaste ? igHtml.trim() : '';

    if (!targetUsername) {
      alert("Harap masukkan username target terlebih dahulu!");
      return;
    }
    if (useHtmlPaste && !targetHtml) {
      alert("Harap tempelkan kode HTML halaman Instagram terlebih dahulu!");
      return;
    }

    setScrapingIg(true);
    setError('');
    setShowScrapedPosts(false);
    setIgAccountInfo(null);
    setScrapedPosts([]);

    try {
      const result = await scrapeInstagramAndDetermineNiche({ 
        username: targetUsername,
        htmlContent: targetHtml
      });
      
      if (result.error) {
        throw new Error(result.error);
      }

      setNiche(result.determinedNiche);
      setScrapedPosts(result.scrapedPosts || []);
      
      const accInfo = result.accountInfo || {};
      if (result.isSimulated) {
        accInfo.isSimulated = true;
        accInfo.isRealData = false;
      } else if (result.isRealData) {
        accInfo.isRealData = true;
        accInfo.isSimulated = false;
      }
      setIgAccountInfo(accInfo);
      
      setShowScrapedPosts(true);

      // Flash success message
      if (result.isSimulated) {
        alert(`Estimasi niche dari @${targetUsername} menggunakan Simulasi AI (server scraper tidak aktif).`);
      } else if (result.isRealData) {
        alert(`✅ Data ASLI berhasil di-scrape dari @${targetUsername}! Niche Utama sudah terisi otomatis.`);
      } else {
        alert(`Berhasil menganalisis profil @${targetUsername}! Niche Utama otomatis diisi.`);
      }
    } catch (err) {
      setError(err.message || 'Gagal menganalisis Instagram. Pastikan API Key Anda benar.');
    } finally {
      setScrapingIg(false);
    }
  };

  const handleAutopilot = async () => {
    if (!niche.trim()) {
      alert("Harap masukkan Niche Utama terlebih dahulu!");
      return;
    }

    setAutomationLoading(true);
    setAutomationStep(1);
    setError('');

    try {
      // Step 1: Generate Brand Profile
      const brand = await generateBrandProfile({ niche: niche.trim() });
      
      // Update form states
      setSpecificNiche(brand.specificNiche);
      setSuperSpecificNiche(brand.superSpecificNiche);
      setPositioning(brand.positioning);
      setArchetype(brand.archetype);
      setToneOfVoice(brand.toneOfVoice);
      setCommunicationDesc(brand.communicationDesc);
      setTargetAudience(brand.targetAudience);
      setSegmentations(brand.segmentations);

      // Save brand details to localStorage
      localStorage.setItem('bgi_brand_niche', niche.trim());
      localStorage.setItem('bgi_brand_spec_niche', brand.specificNiche);
      localStorage.setItem('bgi_brand_super_spec_niche', brand.superSpecificNiche);
      localStorage.setItem('bgi_brand_positioning', brand.positioning);
      localStorage.setItem('bgi_brand_archetype', brand.archetype);
      localStorage.setItem('bgi_brand_tone', brand.toneOfVoice);
      localStorage.setItem('bgi_brand_comm_desc', brand.communicationDesc);
      localStorage.setItem('bgi_brand_target', brand.targetAudience);
      localStorage.setItem('bgi_brand_segments', brand.segmentations);

      // Step 2: Generate Pillars
      setAutomationStep(2);
      const generatedPillars = await generateContentPillars({
        niche: niche.trim(),
        specificNiche: brand.specificNiche,
        superSpecificNiche: brand.superSpecificNiche,
        positioning: brand.positioning,
        archetype: brand.archetype,
        toneOfVoice: brand.toneOfVoice,
        communicationDesc: brand.communicationDesc,
        targetAudience: brand.targetAudience,
        segmentations: brand.segmentations
      });
      setPillars(generatedPillars);
      localStorage.setItem('bgi_pillars_list', JSON.stringify(generatedPillars));

      if (generatedPillars.length === 0) {
        throw new Error("Gagal menghasilkan Content Pillars.");
      }

      // Step 3: Generate Content Ideas for the first pillar
      setAutomationStep(3);
      const activePillar = generatedPillars[0];
      const brandProfileObj = {
        niche: niche.trim(),
        specificNiche: brand.specificNiche,
        superSpecificNiche: brand.superSpecificNiche,
        positioning: brand.positioning,
        archetype: brand.archetype,
        toneOfVoice: brand.toneOfVoice,
        communicationDesc: brand.communicationDesc,
        targetAudience: brand.targetAudience,
        segmentations: brand.segmentations
      };

      const generatedIdeas = await generateContentIdeas({
        pillarName: activePillar.name,
        pillarDesc: activePillar.description,
        brandProfile: brandProfileObj,
        count: 10
      });

      localStorage.setItem('bgi_generated_ideas', JSON.stringify(generatedIdeas));

      if (generatedIdeas.length === 0) {
        throw new Error("Gagal menghasilkan ide konten.");
      }

      // Step 4: Generate Script for the first idea
      setAutomationStep(4);
      const firstIdea = generatedIdeas[0];
      
      // Save active idea choices (defaults)
      localStorage.setItem('bgi_active_idea_idx', '0');
      localStorage.setItem('bgi_active_platform', firstIdea.platform || 'Instagram');
      localStorage.setItem('bgi_active_format', firstIdea.format || 'Reels');
      localStorage.setItem('bgi_active_valueAdd', firstIdea.valueAdd || 'Edukasi/Wawasan');
      localStorage.setItem('bgi_active_storytelling', firstIdea.storytelling || 'Problem-Solution');

      const parsedScript = await generateScript({
        title: firstIdea.title,
        pillar: activePillar.name,
        platform: firstIdea.platform || 'Instagram',
        format: firstIdea.format || 'Reels',
        valueAdd: firstIdea.valueAdd || 'Edukasi/Wawasan',
        storytelling: firstIdea.storytelling || 'Problem-Solution',
        brief: firstIdea.brief,
        brandProfile: brandProfileObj
      });

      localStorage.setItem('bgi_active_script', parsedScript.draftScript || '');
      localStorage.setItem('bgi_active_cta', parsedScript.cta || '');
      localStorage.setItem('bgi_active_visual', parsedScript.visualSuggestions || '');
      localStorage.setItem('bgi_active_caption', parsedScript.fullCaption || '');

      // Step 5: Generate Hooks for the script
      setAutomationStep(5);
      const hooks = await generateHooks({
        topic: firstIdea.title,
        script: parsedScript.draftScript || '',
        hookType: 'Pain Trigger',
        hookDescription: 'Menyentil masalah umum dan membongkar penyebab yang sebenarnya',
        hookFormula: 'Masalah yang dirasakan sekarang + alasan tersembunyi di baliknya',
        emotionWord: 'Surprise (Keterkejutan)',
        brandProfile: brandProfileObj
      });
      localStorage.setItem('bgi_hooks_result', hooks);

      // Step 6: Generate Caption for the script
      setAutomationStep(6);
      const caption = await generateCaption({
        topic: firstIdea.title,
        script: parsedScript.draftScript || '',
        platform: firstIdea.platform || 'Instagram',
        tone: brand.toneOfVoice || 'Friendly',
        ctaType: 'Untuk Engagement',
        captionFormula: 'Hook - Value - CTA',
        format: 'Caption Singkat',
        brandProfile: brandProfileObj
      });
      localStorage.setItem('bgi_caption_result', caption);

      // Done
      setAutomationStep(7);
    } catch (err) {
      setError(err.message || 'Gagal menjalankan Autopilot AI.');
      setAutomationStep(0);
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleAddManualPillar = (e) => {
    e.preventDefault();
    if (!newPillarName.trim() || !newPillarDesc.trim()) return;
    
    const updated = [...pillars, { name: newPillarName.trim(), description: newPillarDesc.trim() }];
    setPillars(updated);
    saveBrandProfileToLocalStorage(updated);
    setNewPillarName('');
    setNewPillarDesc('');
  };

  const handleDeletePillar = (index) => {
    const updated = pillars.filter((_, i) => i !== index);
    setPillars(updated);
    saveBrandProfileToLocalStorage(updated);
  };

  const startEditPillar = (index) => {
    setEditingIndex(index);
    setEditName(pillars[index].name);
    setEditDesc(pillars[index].description);
  };

  const saveEditPillar = (index) => {
    const updated = [...pillars];
    updated[index] = { name: editName.trim(), description: editDesc.trim() };
    setPillars(updated);
    saveBrandProfileToLocalStorage(updated);
    setEditingIndex(-1);
  };

  return (
    <div className="pillar-mapping-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Pillar Strategy Mapping</h1>
          <p>Definisikan DNA brand Anda dan petakan pilar konten utama untuk memandu strategi media sosial.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Left Side: Brand Config Form */}
        <div className="glass-card">
          <h2 className="card-title"><Compass size={18} /> Profil Strategis Brand</h2>
          <form onSubmit={handleGeneratePillars}>
            
            {/* Autopilot AI Action Area */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
              border: '1px solid rgba(165, 180, 252, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                  padding: '8px', 
                  borderRadius: '10px', 
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Bot size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700', margin: 0 }}>Autopilot AI Content Studio</h3>
                  <p style={{ fontSize: '0.78rem', color: '#c7d2fe', margin: '2px 0 0 0', lineHeight: '1.4' }}>
                    Gunakan AI untuk mengisi seluruh studio konten secara otomatis. Anda dapat mengetik Niche Utama sendiri atau menariknya langsung dari profil Instagram di bawah!
                  </p>
                </div>
              </div>

              {/* Instagram Scraper Integration */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.2)', 
                padding: '1.25rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div 
                  onClick={() => setShowIgScraper(!showIgScraper)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    color: '#e1306c', 
                    fontSize: '0.82rem', 
                    fontWeight: '600',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Compass size={15} /> <span>Deteksi Niche dari Akun Instagram (Opsional)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {showIgScraper ? 'Sembunyikan ▴' : 'Tampilkan ▾'}
                  </span>
                </div>
                
                {showIgScraper && (
                  <>
                    {/* Method selector tab buttons */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '6px', marginBottom: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setUseHtmlPaste(false)}
                        style={{
                          flex: 1,
                          background: !useHtmlPaste ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: 'none',
                          color: !useHtmlPaste ? '#fff' : 'var(--text-secondary)',
                          padding: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Otomatis (Estimasi AI)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseHtmlPaste(true)}
                        style={{
                          flex: 1,
                          background: useHtmlPaste ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: 'none',
                          color: useHtmlPaste ? '#fff' : 'var(--text-secondary)',
                          padding: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Tempel HTML (Semua Akun)
                      </button>
                    </div>

                    {!useHtmlPaste ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                          Ketik username target di bawah untuk mendeteksi niche secara otomatis menggunakan estimasi AI.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="input-text" 
                            value={igUsername}
                            onChange={(e) => setIgUsername(e.target.value)}
                            placeholder="Masukkan username target"
                            style={{ height: '36px', fontSize: '0.8rem', flex: 1 }}
                            disabled={scrapingIg}
                          />
                          <button
                            type="button"
                            onClick={handleAnalyzeInstagram}
                            className="btn btn-secondary"
                            style={{ height: '36px', padding: '0 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            disabled={scrapingIg}
                          >
                            {scrapingIg ? (
                              <><div className="loading-spinner" style={{ width: '12px', height: '12px' }}></div> Menganalisis...</>
                            ) : (
                              'Analisis & Isi Niche'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', borderLeft: '2px solid #818cf8' }}>
                          <strong>Cara menggunakan:</strong>
                          <ol style={{ margin: '4px 0 0 0', paddingLeft: '1.2rem' }}>
                            <li>Buka profil Instagram target di browser Anda (misal: instagram.com/username)</li>
                            <li>Tekan <strong>Ctrl + U</strong> (atau klik kanan &gt; Lihat Sumber Halaman)</li>
                            <li>Pilih semua (Ctrl+A), Salin (Ctrl+C), dan tempelkan kodenya di bawah.</li>
                          </ol>
                        </div>
                        <input 
                          type="text" 
                          className="input-text" 
                          value={igUsername}
                          onChange={(e) => setIgUsername(e.target.value)}
                          placeholder="Masukkan username target"
                          style={{ height: '36px', fontSize: '0.8rem' }}
                          disabled={scrapingIg}
                        />
                        <textarea 
                          className="textarea-input"
                          value={igHtml}
                          onChange={(e) => setIgHtml(e.target.value)}
                          placeholder="Tempelkan (Paste) kode HTML halaman Instagram di sini..."
                          style={{ minHeight: '80px', fontSize: '0.75rem', fontFamily: 'monospace' }}
                          disabled={scrapingIg}
                        />
                        <button
                          type="button"
                          onClick={handleAnalyzeInstagram}
                          className="btn btn-secondary"
                          style={{ height: '36px', width: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                          disabled={scrapingIg || !igUsername.trim() || !igHtml.trim()}
                        >
                          {scrapingIg ? (
                            <><div className="loading-spinner" style={{ width: '12px', height: '12px' }}></div> Mengekstrak...</>
                          ) : (
                            'Ekstrak Niche dari HTML'
                          )}
                        </button>
                      </div>
                    )}

                    {/* Show Scraped Post Captions info */}
                    {showScrapedPosts && scrapedPosts.length > 0 && (
                      <div style={{ 
                        marginTop: '0.25rem', 
                        paddingTop: '0.5rem', 
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ color: '#818cf8', fontWeight: '600' }}>
                            📸 @{igUsername || 'username'} {igAccountInfo?.fullName ? `(${igAccountInfo.fullName})` : ''}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setShowScrapedPosts(false)}
                            style={{ background: 'none', border: 'none', color: '#c7d2fe', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            Sembunyikan 10 Post Terakhir
                          </button>
                        </div>
                        {igAccountInfo?.bio && <p style={{ fontStyle: 'italic', margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Bio: "{igAccountInfo.bio}"</p>}
                        
                        {igAccountInfo?.isRealData && (
                          <div style={{ 
                            background: 'rgba(34, 197, 94, 0.08)', 
                            border: '1px solid rgba(34, 197, 94, 0.25)', 
                            borderRadius: '6px', 
                            padding: '0.6rem 0.8rem', 
                            color: '#4ade80', 
                            fontSize: '0.72rem', 
                            marginBottom: '0.5rem',
                            lineHeight: '1.4'
                          }}>
                            ✅ <strong>Data Asli:</strong> Caption ini di-scrape secara real dari Instagram @{igUsername || 'username'}. Niche terdeteksi dari konten postingan aktual.
                          </div>
                        )}

                        {igAccountInfo?.isSimulated && (
                          <div style={{ 
                            background: 'rgba(245, 158, 11, 0.08)', 
                            border: '1px solid rgba(245, 158, 11, 0.25)', 
                            borderRadius: '6px', 
                            padding: '0.6rem 0.8rem', 
                            color: '#fbbf24', 
                            fontSize: '0.72rem', 
                            marginBottom: '0.5rem',
                            lineHeight: '1.4'
                          }}>
                            ⚠️ <strong>Estimasi AI:</strong> Server scraper tidak aktif. Jalankan <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px' }}>npm run dev:server</code> di terminal untuk scraping data asli.
                          </div>
                        )}

                        <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingRight: '0.25rem' }}>
                          {scrapedPosts.map((caption, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: '4px', borderLeft: '2px solid #e1306c', fontSize: '0.7rem', lineHeight: '1.4' }}>
                              <strong>Post {idx + 1}:</strong> {caption.substring(0, 100)}...
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button 
                type="button" 
                onClick={handleAutopilot} 
                className="btn btn-primary"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                  border: 'none', 
                  height: '38px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  marginTop: '0.25rem'
                }}
                disabled={automationLoading || !niche.trim()}
              >
                {automationLoading ? 'Menjalankan Autopilot...' : '⚡ Jalankan Autopilot AI (One-Click)'}
              </button>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Niche Utama</label>
                <textarea 
                  className="textarea-input" 
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Misal: Edukasi Finansial Anak Muda"
                  style={{ minHeight: '60px' }}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Spesifik Niche</label>
                <textarea 
                  className="textarea-input" 
                  value={specificNiche}
                  onChange={(e) => setSpecificNiche(e.target.value)}
                  placeholder="Misal: Investasi saham pemula & budgeting kuliahan"
                  style={{ minHeight: '60px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Super Spesifik Niche</label>
              <textarea 
                className="textarea-input" 
                value={superSpecificNiche}
                onChange={(e) => setSuperSpecificNiche(e.target.value)}
                placeholder="Misal: Tips frugal living & investasi reksa dana mahasiswa beasiswa"
                style={{ minHeight: '60px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Positioning (Kamu Ingin Dikenal Sebagai Siapa)</label>
              <textarea 
                className="textarea-input" 
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="Misal: Sumber peluang, insight, dan guidance paling relevan untuk anak muda ambis"
                style={{ minHeight: '60px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brand Archetype</label>
              <div className="archetype-grid">
                {ARCHETYPES.map((arch) => (
                  <div 
                    key={arch.name} 
                    className={`archetype-option ${archetype === arch.name ? 'selected' : ''}`}
                    onClick={() => setArchetype(arch.name)}
                    title={arch.desc}
                  >
                    <div className="archetype-name">{arch.name}</div>
                    <div className="archetype-desc">{arch.desc.substring(0, 40)}...</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tone of Voice (Gaya Bicara)</label>
                <select 
                  className="select-input" 
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Tone of Voice --</option>
                  {['Friendly', 'Professional', 'Confident', 'Playful', 'Calm', 'Fun & Energetic', 'Elegant', 'Warm', 'Bold', 'Empathetic', 'Inspirational', 'Witty', 'Serious'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {toneOfVoice && !['Friendly', 'Professional', 'Confident', 'Playful', 'Calm', 'Fun & Energetic', 'Elegant', 'Warm', 'Bold', 'Empathetic', 'Inspirational', 'Witty', 'Serious'].includes(toneOfVoice) && (
                    <option value={toneOfVoice}>{toneOfVoice}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi Gaya Komunikasi</label>
                <textarea 
                  className="textarea-input" 
                  value={communicationDesc}
                  onChange={(e) => setCommunicationDesc(e.target.value)}
                  placeholder="Misal: Informatif, suportif, dan to the point. Kontennya harus bikin audiens ngerasa..."
                  style={{ minHeight: '60px' }}
                  required
                />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Target Audiens</label>
                <textarea 
                  className="textarea-input" 
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Misal: Pelajar SMA, mahasiswa, dan fresh graduate usia 15-25 tahun..."
                  style={{ minHeight: '60px' }}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Segmentasi Audiens</label>
                <textarea 
                  className="textarea-input" 
                  value={segmentations}
                  onChange={(e) => setSegmentations(e.target.value)}
                  placeholder="Misal: Opportunity seeker, scholarship hunter, future leader..."
                  style={{ minHeight: '60px' }}
                  required
                />
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <Trash2 size={16} /> <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                type="button" 
                onClick={handleClearBrandProfile} 
                className="btn btn-outline" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <Trash2 size={16} /> Hapus Teks
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }} 
                disabled={loading}
              >
                {loading ? (
                  <><div className="loading-spinner"></div> Mengonsep...</>
                ) : (
                  <><Sparkles size={16} /> Generate Strategi Content Pillars</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: Pillars List */}
        <div className="glass-card">
          <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>Content Pillars ({pillars.length})</span>
            {pillars.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleClearAllPillars} 
                  className="btn btn-outline" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Trash2 size={12} /> Hapus Semua
                </button>
                <button onClick={onNavigateToScripts} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Lanjut ke Scripting <ArrowRight size={14} />
                </button>
              </div>
            )}
          </h2>

          {pillars.length === 0 ? (
            <div className="empty-state">
              <Compass size={40} />
              <h3>Belum Ada Pilar Konten</h3>
              <p>Isi profil strategis brand Anda di atas dan klik generate, atau tambahkan pilar manual di bawah.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {pillars.map((pillar, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(165,180,252,0.12)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  transition: 'border-color 0.2s ease',
                }}>
                  {editingIndex === idx ? (
                    <div>
                      <input 
                        type="text" 
                        className="input-text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <textarea 
                        className="textarea-input" 
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        style={{ marginBottom: '0.5rem', minHeight: '80px' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => saveEditPillar(idx)} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                          <Check size={14} /> Simpan
                        </button>
                        <button onClick={() => setEditingIndex(-1)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            flexShrink: 0,
                          }}>{idx + 1}</span>
                          <h3 style={{ fontSize: '0.95rem', color: '#a5b4fc', fontWeight: '700', margin: 0 }}>{pillar.name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button onClick={() => startEditPillar(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Edit Pilar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeletePillar(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }} title="Hapus Pilar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.5rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        paddingLeft: 'calc(28px + 0.75rem)',
                      }}>{pillar.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Manual Pillar — inline below the list */}
          <div style={{ 
            marginTop: '1.25rem', 
            paddingTop: '1.25rem', 
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
              <Plus size={16} /> Tambah Pilar Manual
            </h3>
            <form onSubmit={handleAddManualPillar} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                <input 
                  type="text" 
                  className="input-text" 
                  value={newPillarName}
                  onChange={(e) => setNewPillarName(e.target.value)}
                  placeholder="Nama Pilar Konten Baru"
                  required
                />
              </div>
              <div style={{ flex: '2 1 300px', minWidth: '250px' }}>
                <textarea 
                  className="textarea-input" 
                  value={newPillarDesc}
                  onChange={(e) => setNewPillarDesc(e.target.value)}
                  placeholder="Deskripsi pilar, sub-topik, dan manfaatnya bagi audiens."
                  style={{ minHeight: '40px' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-outline" style={{ padding: '0.5rem 1rem', flexShrink: 0 }}>
                <Plus size={14} /> Tambah
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Autopilot Progress Modal */}
      {automationStep > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(165, 180, 252, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c7d2fe',
                animation: 'pulse 2s infinite'
              }}>
                <Bot size={32} />
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff', marginBottom: '0.5rem' }}>Autopilot AI Sedang Bekerja</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Membangun seluruh ekosistem konten untuk niche <strong>"{niche}"</strong></p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left', background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { step: 1, text: 'Menganalisis Niche & Merancang DNA Brand' },
                { step: 2, text: 'Memetakan 7-10 Pilar Strategi Konten' },
                { step: 3, text: 'Menggali 10 Ide Topik Konten Viral' },
                { step: 4, text: 'Menyusun Naskah (Script) & Visual Cues' },
                { step: 5, text: 'Meracik Hook Pembuka (Lisan/Audio/Visual)' },
                { step: 6, text: 'Menulis Caption Copywriting & Hashtags' }
              ].map((item) => {
                const isCompleted = automationStep > item.step;
                const isActive = automationStep === item.step;
                return (
                  <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: isCompleted ? 1 : isActive ? 1 : 0.4 }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isCompleted ? 'none' : '1px solid var(--border-color)',
                      background: isCompleted ? 'linear-gradient(135deg, #10b981, #059669)' : isActive ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      color: isCompleted || isActive ? '#fff' : 'var(--text-muted)'
                    }}>
                      {isCompleted ? '✓' : item.step}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: isActive ? '600' : '400', color: isActive ? '#c7d2fe' : isCompleted ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {item.text}
                      {isActive && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#818cf8' }}>(Sedang diproses...)</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            {automationStep === 7 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: '600' }}>
                  🎉 Sukses! Semua tahapan AI Autopilot telah selesai!
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => {
                      setAutomationStep(0);
                    }} 
                    className="btn btn-outline" 
                    style={{ flex: 1, padding: '0.6rem 0' }}
                  >
                    Tutup
                  </button>
                  <button 
                    onClick={() => {
                      setAutomationStep(0);
                      onNavigateToScripts();
                    }} 
                    className="btn btn-primary" 
                    style={{ flex: 1.5, padding: '0.6rem 0', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none' }}
                  >
                    Buka Workspace Naskah
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                <span>AI sedang memproses, mohon tunggu sebentar...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
