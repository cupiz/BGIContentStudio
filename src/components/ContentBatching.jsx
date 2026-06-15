import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  Edit3, 
  Check, 
  Download,
  AlertCircle
} from 'lucide-react';

const STATUSES = ['Dalam Proses', 'Butuh Persetujuan', 'Siap Posting', 'Sudah Posting'];
const PLATFORMS = ['Instagram', 'TikTok', 'Threads/X', 'YouTube', 'LinkedIn'];
const FORMATS = ['Reels', 'Carousel', 'Single Image', 'Text Threads/X', 'Video Panjang', 'Video Pendek'];

export default function ContentBatching() {
  const [batchItems, setBatchItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Form States for manual addition
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState('Instagram');
  const [newFormat, setNewFormat] = useState('Carousel');
  const [newPillar, setNewPillar] = useState('General');
  const [newBrief, setNewBrief] = useState('');
  const [newScript, setNewScript] = useState('');
  const [newStatus, setNewStatus] = useState('Dalam Proses');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit card state
  const [editingItem, setEditingItem] = useState(null); // The item object currently being edited in details
  
  // Pillars list for select menu
  const [pillarsList, setPillarsList] = useState([]);

  useEffect(() => {
    // Load batching list
    const savedBatch = localStorage.getItem('bgi_batching_list');
    if (savedBatch) {
      try {
        setBatchItems(JSON.parse(savedBatch));
      } catch (e) {}
    }

    // Load pillars for options
    const savedPillars = localStorage.getItem('bgi_pillars_list');
    if (savedPillars) {
      try {
        setPillarsList(JSON.parse(savedPillars));
        if (JSON.parse(savedPillars).length > 0) {
          setNewPillar(JSON.parse(savedPillars)[0].name);
        }
      } catch (e) {}
    }
  }, []);

  const saveToLocalStorage = (updatedItems) => {
    localStorage.setItem('bgi_batching_list', JSON.stringify(updatedItems));
  };

  const handleAddNewItem = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      platform: newPlatform,
      format: newFormat,
      pillar: newPillar,
      brief: newBrief.trim(),
      script: newScript.trim(),
      status: newStatus,
      scheduledDate: newDate,
    };

    const updated = [newItem, ...batchItems];
    setBatchItems(updated);
    saveToLocalStorage(updated);
    
    // Reset Form
    setNewTitle('');
    setNewBrief('');
    setNewScript('');
    setNewStatus('Dalam Proses');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(false);
  };

  const handleUpdateStatus = (id, newStatusVal) => {
    const updated = batchItems.map(item => {
      if (item.id === id) {
        return { ...item, status: newStatusVal };
      }
      return item;
    });
    setBatchItems(updated);
    saveToLocalStorage(updated);
  };

  const handleUpdateItemDetails = (e) => {
    e.preventDefault();
    if (!editingItem.title.trim()) return;

    const updated = batchItems.map(item => {
      if (item.id === editingItem.id) {
        return editingItem;
      }
      return item;
    });
    setBatchItems(updated);
    saveToLocalStorage(updated);
    setEditingItem(null);
  };

  const handleDeleteItem = (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus konten ini dari pelacak?")) {
      const updated = batchItems.filter(item => item.id !== id);
      setBatchItems(updated);
      saveToLocalStorage(updated);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (batchItems.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    // Header row
    const headers = ['Judul', 'Pillar', 'Platform', 'Format', 'Brief', 'Naskah', 'Status', 'Tanggal Rencana Tayang'];
    
    const rows = batchItems.map(item => [
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.pillar.replace(/"/g, '""')}"`,
      item.platform,
      item.format,
      `"${(item.brief || '').replace(/"/g, '""')}"`,
      `"${(item.script || '').replace(/"/g, '""')}"`,
      item.status,
      item.scheduledDate
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bgi_content_batching_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items based on search
  const filteredItems = batchItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pillar.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="content-batching-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Dashboard Tracker</h1>
          <p>Kelola proses produksi konten Anda (Batching) dari konsep hingga diposting di media sosial.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <Plus size={16} /> Tambah Konten Manual
          </button>
          <button onClick={handleExportCSV} className="btn btn-outline">
            <Download size={16} /> Ekspor CSV
          </button>
        </div>
      </div>

      {/* Filter and Stats Panel */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}><Search size={18} /></span>
            <input 
              type="text" 
              className="input-text" 
              placeholder="Cari berdasarkan judul, pilar, atau platform..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Mini Stats */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              Total Konten: <strong style={{ color: '#a5b4fc' }}>{batchItems.length}</strong>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem', color: '#34d399' }}>
              Selesai Tayang: <strong>{batchItems.filter(item => item.status === 'Sudah Posting').length}</strong>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem', color: '#fbbf24' }}>
              Dalam Produksi: <strong>{batchItems.filter(item => item.status !== 'Sudah Posting').length}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="kanban-board">
        {STATUSES.map((status) => {
          const itemsInStatus = filteredItems.filter(item => item.status === status);
          
          return (
            <div key={status} className="kanban-column">
              <div className="kanban-column-header">
                <span className="kanban-column-title">{status}</span>
                <span className="kanban-column-count">{itemsInStatus.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, maxHeight: '600px', paddingRight: '0.15rem' }}>
                {itemsInStatus.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Seret/Pindahkan konten ke sini
                  </div>
                ) : (
                  itemsInStatus.map(item => (
                    <div key={item.id} className="kanban-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{item.platform}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => setEditingItem(item)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Edit Konten">
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} title="Hapus Konten">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="kanban-card-title">{item.title}</div>
                      
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Pilar: <span style={{ color: '#c7d2fe' }}>{item.pillar}</span>
                      </div>

                      <div className="kanban-card-meta">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={12} /> {item.scheduledDate}
                        </span>
                        
                        <select 
                          value={item.status} 
                          onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.65rem',
                            padding: '0.1rem'
                          }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Addition Form Modal Overlay */}
      {showAddForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '550px', background: 'var(--bg-app)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>Tambah Konten Baru ke Tracker</h2>
            <form onSubmit={handleAddNewItem}>
              
              <div className="form-group">
                <label className="form-label">Judul Konten</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  placeholder="Misal: 5 Kesalahan Fatal Saat Daftar Lomba"
                  required 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select className="select-input" value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select className="select-input" value={newFormat} onChange={(e) => setNewFormat(e.target.value)}>
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Pilar Konten</label>
                  <select className="select-input" value={newPillar} onChange={(e) => setNewPillar(e.target.value)}>
                    {pillarsList.length > 0 ? (
                      pillarsList.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rencana Tanggal Tayang</label>
                  <input 
                    type="date" 
                    className="input-text" 
                    value={newDate} 
                    onChange={(e) => setNewDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status Awal</label>
                <select className="select-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Gambaran Singkat / Brief</label>
                <textarea 
                  className="textarea-input" 
                  value={newBrief} 
                  onChange={(e) => setNewBrief(e.target.value)} 
                  placeholder="Konteks brief ide konten..."
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-outline">Batal</button>
                <button type="submit" className="btn btn-primary">Tambahkan Konten</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Form Modal Overlay */}
      {editingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '650px', background: 'var(--bg-app)', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>Edit Detail Konten</h2>
            <form onSubmit={handleUpdateItemDetails}>
              
              <div className="form-group">
                <label className="form-label">Judul Konten</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={editingItem.title} 
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} 
                  required 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select className="select-input" value={editingItem.platform} onChange={(e) => setEditingItem({ ...editingItem, platform: e.target.value })}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select className="select-input" value={editingItem.format} onChange={(e) => setEditingItem({ ...editingItem, format: e.target.value })}>
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Pilar Konten</label>
                  <select className="select-input" value={editingItem.pillar} onChange={(e) => setEditingItem({ ...editingItem, pillar: e.target.value })}>
                    {pillarsList.length > 0 ? (
                      pillarsList.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rencana Tanggal Tayang</label>
                  <input 
                    type="date" 
                    className="input-text" 
                    value={editingItem.scheduledDate} 
                    onChange={(e) => setEditingItem({ ...editingItem, scheduledDate: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status Produksi</label>
                <select className="select-input" value={editingItem.status} onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Gambaran Singkat / Brief</label>
                <textarea 
                  className="textarea-input" 
                  value={editingItem.brief || ''} 
                  onChange={(e) => setEditingItem({ ...editingItem, brief: e.target.value })} 
                  placeholder="Konteks brief ide konten..."
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Naskah Lengkap (Script)</label>
                <textarea 
                  className="textarea-input" 
                  value={editingItem.script || ''} 
                  onChange={(e) => setEditingItem({ ...editingItem, script: e.target.value })} 
                  placeholder="Draf naskah visual dan dialog..."
                  style={{ minHeight: '150px', fontFamily: 'monospace' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Saran Visual</label>
                <textarea 
                  className="textarea-input" 
                  value={editingItem.visual || ''} 
                  onChange={(e) => setEditingItem({ ...editingItem, visual: e.target.value })} 
                  placeholder="Ide visual, warna, dll..."
                  style={{ minHeight: '100px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Caption Postingan</label>
                <textarea 
                  className="textarea-input" 
                  value={editingItem.caption || ''} 
                  onChange={(e) => setEditingItem({ ...editingItem, caption: e.target.value })} 
                  placeholder="Caption postingan lengkap..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setEditingItem(null)} className="btn btn-outline">Batal</button>
                <button type="submit" className="btn btn-primary"><Check size={16} /> Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
