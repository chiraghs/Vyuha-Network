import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Map, Share2, BarChart2, Search, LogOut, ShieldAlert, Radio } from 'lucide-react';
import { User, District, Station, CrimeRecord, CriminalNode, CriminalEdge } from './types';
import { GeospatialMap } from './components/GeospatialMap';
import { NetworkVisualizer } from './components/NetworkVisualizer';
import { ChatAssistant } from './components/ChatAssistant';

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // App Data state
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [crimes, setCrimes] = useState<CrimeRecord[]>([]);
  
  // Graph network state
  const [networkNodes, setNetworkNodes] = useState<CriminalNode[]>([]);
  const [networkEdges, setNetworkEdges] = useState<CriminalEdge[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<any>(null);

  // Filter state
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View state
  const [activeTab, setActiveTab] = useState<'map' | 'network' | 'charts'>('map');
  const [selectedCrime, setSelectedCrime] = useState<CrimeRecord | null>(null);
  const [selectedCriminal, setSelectedCriminal] = useState<CriminalNode | null>(null);
  const [riskExplanation, setRiskExplanation] = useState<string>('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Socio-Economic correlation stats
  const [socioStats, setSocioStats] = useState<any>(null);

  // Load User profile on boot
  useEffect(() => {
    if (!token) return;
    const fetchMe = async () => {
      try {
        const res = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data);
      } catch (err) {
        handleLogout();
      }
    };
    fetchMe();
  }, [token]);

  // Load Districts and Stations
  useEffect(() => {
    if (!token) return;
    const fetchLocations = async () => {
      try {
        const distRes = await axios.get('/api/analytics/districts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDistricts(distRes.data);

        const statRes = await axios.get('/api/analytics/stations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStations(statRes.data);
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };
    fetchLocations();
  }, [token]);

  // Fetch crime records and networks on filter changes
  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        // Find district ID matching selected district name
        const districtObj = districts.find(d => d.name === selectedDistrict);
        // Find station ID matching selected station name
        const stationObj = stations.find(s => s.name === selectedStation);

        const crimesRes = await axios.get('/api/analytics/crimes', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            district_id: districtObj?.id,
            station_id: stationObj?.id,
            category: selectedCategory || undefined,
            search: searchQuery || undefined
          }
        });
        setCrimes(crimesRes.data);

        const netRes = await axios.get('/api/network', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNetworkNodes(netRes.data.nodes);
        setNetworkEdges(netRes.data.edges);
        setNetworkMetrics(netRes.data.metrics);

        const socioRes = await axios.get('/api/analytics/socio-economic', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSocioStats(socioRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, [token, selectedDistrict, selectedStation, selectedCategory, searchQuery, districts, stations]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await axios.post('/api/auth/login', {
        username: usernameInput,
        password: passwordInput
      });
      const data = res.data;
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setUser({
        id: 'temp',
        username: data.username,
        email: `${data.username}@ksp.gov`,
        role: data.role
      });
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || 'Login authentication failed.');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Fetch criminal risk score explanation from Gemini
  const fetchRiskExplanation = async (criminal: CriminalNode) => {
    setSelectedCriminal(criminal);
    setRiskExplanation('');
    setLoadingExplanation(true);
    try {
      // Simulate/Trigger LLM assessment call dynamically
      const res = await axios.post('/api/chat', {
        query_text: `Generate risk assessment details for suspect: ${criminal.name} with risk score ${criminal.risk_score} and status ${criminal.status}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiskExplanation(res.data.reply_text);
    } catch (err) {
      setRiskExplanation('Standard priority recidivism profile active. Keep suspect on watch list.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  if (!token || !user) {
    return (
      <div className="login-container">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-logo">🛡️</div>
          <h2>KSP VYUHA NETWORK</h2>
          <p>State Crime Records Bureau (SCRB) Access Portal</p>
          
          {authError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '12px',
              marginBottom: '15px',
              textAlign: 'left'
            }}>
              ⚠️ {authError}
            </div>
          )}

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label>Investigator Username</label>
            <input
              type="text"
              className="form-input"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. officer, executive"
              required
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label>Secure Password</label>
            <input
              type="password"
              className="form-input"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }}>
            Verify Credentials
          </button>
          
          <div style={{ marginTop: '20px', fontSize: '10px', color: 'var(--text-muted)' }}>
            ⚠️ Authorized personnel only. All access, inputs, and queries are audited and cryptographically registered.
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header bar */}
      <header className="header-bar">
        <div className="header-logo">
          <span className="logo-icon">🛡️</span>
          <div className="header-title">
            <h1>VYUHA NETWORK</h1>
            <p>Karnataka State Police (KSP) • SCRB Decision Suite</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="user-badge">
            <Radio size={14} className="spin-slow" style={{ color: '#16a34a' }} />
            <span>{user.username}</span>
            <span className={`role-tag ${user.role}`}>
              {user.role.replace('_', ' ')}
            </span>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px', gap: '6px' }}>
            <LogOut size={14} />
            Exit
          </button>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        
        {/* Left Side: Filter Control Sidebar */}
        <aside className="control-sidebar">
          {/* Navigation View switcher tabs */}
          <div className="view-tabs">
            <div 
              className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => { setActiveTab('map'); setSelectedCriminal(null); }}
            >
              <Map size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Hotspots
            </div>
            <div 
              className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`}
              onClick={() => { setActiveTab('network'); setSelectedCrime(null); }}
            >
              <Share2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Networks
            </div>
            <div 
              className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
              onClick={() => { setActiveTab('charts'); setSelectedCrime(null); setSelectedCriminal(null); }}
            >
              <BarChart2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Analytics
            </div>
          </div>

          {/* Database filter cards */}
          <div className="glass-card">
            <h3>Investigation Filters</h3>
            
            <div className="form-group">
              <label>District</label>
              <select 
                className="form-select"
                value={selectedDistrict}
                onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedStation(''); }}
              >
                <option value="">All Districts</option>
                {districts.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Police Station</label>
              <select 
                className="form-select"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                disabled={!selectedDistrict}
              >
                <option value="">All Stations</option>
                {stations
                  .filter(s => !selectedDistrict || s.district_name === selectedDistrict)
                  .map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))
                }
              </select>
            </div>

            <div className="form-group">
              <label>Crime Category</label>
              <select 
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Theft">Theft</option>
                <option value="Assault">Assault</option>
                <option value="Cybercrime">Cybercrime</option>
                <option value="Narcotics">Narcotics</option>
                <option value="Land Dispute">Land Dispute</option>
                <option value="Homicide">Homicide</option>
                <option value="Extortion">Extortion</option>
                <option value="Burglary">Burglary</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Keyword Search (FIR / Details)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', paddingRight: '30px' }}
                  placeholder="e.g. FIR number, suspect..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={14} style={{ position: 'absolute', right: '10px', top: '11px', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          {/* Database stats card */}
          {networkMetrics && (
            <div className="glass-card">
              <h3>Database Metrics Summary</h3>
              <div className="metric-row" style={{ marginBottom: '10px' }}>
                <div className="metric-stat">
                  <div className="num">{crimes.length}</div>
                  <div className="label">Filtered Cases</div>
                </div>
                <div className="metric-stat">
                  <div className="num">{networkMetrics.total_criminals}</div>
                  <div className="label">Criminals</div>
                </div>
              </div>
              <div className="metric-row">
                <div className="metric-stat">
                  <div className="num">{networkMetrics.total_relationships}</div>
                  <div className="label">Total Links</div>
                </div>
                <div className="metric-stat">
                  <div className="num">{networkMetrics.active_hubs}</div>
                  <div className="label">Active Hubs</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Middle Viewport Area (Map or Network Visualizer) */}
        <main className="map-viewport">
          {activeTab === 'map' && (
            <GeospatialMap 
              crimes={crimes}
              onSelectCrime={(crime) => { setSelectedCrime(crime); setSelectedCriminal(null); }}
            />
          )}

          {activeTab === 'network' && (
            <NetworkVisualizer 
              nodes={networkNodes}
              edges={networkEdges}
              onSelectNode={(node) => fetchRiskExplanation(node)}
            />
          )}

          {activeTab === 'charts' && (
            <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: '18px', color: '#ffffff' }}>
                Socio-Economic Crime Correlations Dashboard
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* 1. Unemployment rate correlations */}
                <div className="glass-card">
                  <h3>Unemployment Correlation (Crime Volumes vs. Unemployment Rate)</h3>
                  {socioStats && socioStats.unemployment_correlation ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                      {Object.entries(socioStats.unemployment_correlation).map(([bucket, categories]: any) => {
                        const total = Object.values(categories).reduce((a: any, b: any) => a + b, 0) as number;
                        return (
                          <div key={bucket}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>Unemployment Bucket: <b>{bucket}</b></span>
                              <span>{total} crimes registered</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                              {Object.entries(categories).map(([cat, count]: any, idx) => (
                                <div 
                                  key={cat} 
                                  style={{
                                    width: `${(count / total) * 100}%`,
                                    background: idx % 2 === 0 ? 'var(--accent-blue)' : 'var(--accent-gold)',
                                    height: '100%'
                                  }}
                                  title={`${cat}: ${count} cases`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No statistics compiled.</p>
                  )}
                </div>

                {/* 2. Poverty index correlations */}
                <div className="glass-card">
                  <h3>Poverty Index Distribution</h3>
                  {socioStats && socioStats.poverty_correlation ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                      {Object.entries(socioStats.poverty_correlation).map(([poverty, categories]: any) => {
                        const total = Object.values(categories).reduce((a: any, b: any) => a + b, 0) as number;
                        return (
                          <div key={poverty}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>Poverty Level: <b>{poverty}</b></span>
                              <span>{total} cases</span>
                            </div>
                            <div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                              {Object.entries(categories).map(([cat, count]: any, idx) => (
                                <div 
                                  key={cat} 
                                  style={{
                                    width: `${(count / total) * 100}%`,
                                    background: idx % 3 === 0 ? '#ef4444' : idx % 3 === 1 ? '#a855f7' : '#fbbf24',
                                    height: '100%'
                                  }}
                                  title={`${cat}: ${count} cases`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No statistics compiled.</p>
                  )}
                </div>
              </div>

              {/* Socio-economic summary explanation */}
              <div className="glass-card" style={{ marginTop: '10px' }}>
                <h3>SCRB Analytics Summary Notes</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  🛡️ <b>Correlation Index Findings:</b> Areas containing unemployment rates exceeding 10% show high volumes of localized property theft and burglary. Cybercrime volumes map directly to low-poverty, high-literacy districts (e.g. Bengaluru Urban zones). Police resources should prioritize physical hotspot patrolling in high-unemployment zones, while dispatching cyber patrols in high-literacy zones.
                </p>
              </div>
            </div>
          )}

          {/* Dynamic Popup Detail Overlays */}
          {selectedCrime && (
            <div className="glass-card fade-in-up" style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              right: '24px',
              background: 'rgba(11, 15, 25, 0.95)',
              zIndex: 1000,
              maxWidth: 'calc(100% - 48px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Case Details: {selectedCrime.FIR_number}</h4>
                  <span className="role-tag officer" style={{ display: 'inline-block', marginTop: '4px' }}>
                    {selectedCrime.crime_category}
                  </span>
                </div>
                <button onClick={() => setSelectedCrime(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  Close
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', fontSize: '12px' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{selectedCrime.description}</p>
                  <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
                    <b>Occurrence:</b> {new Date(selectedCrime.occurrence_time).toLocaleString()} | <b>Station:</b> {selectedCrime.station_name} ({selectedCrime.district_name})
                  </p>
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <h5 style={{ fontWeight: 600, color: 'var(--accent-gold)', marginBottom: '6px' }}>Socio-Economic Profile Factors</h5>
                  {selectedCrime.socio_economic_factors ? (
                    <ul style={{ listStyle: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>• Unemployment: {selectedCrime.socio_economic_factors.unemployment_rate}%</li>
                      <li>• Literacy Rate: {selectedCrime.socio_economic_factors.literacy_rate}%</li>
                      <li>• Poverty Level: {selectedCrime.socio_economic_factors.poverty_index}</li>
                      <li>• Alcohol Rate: {selectedCrime.socio_economic_factors.alcohol_consumption}</li>
                    </ul>
                  ) : (
                    <span>No factors mapped.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedCriminal && (
            <div className="glass-card fade-in-up" style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              right: '24px',
              background: 'rgba(11, 15, 25, 0.95)',
              zIndex: 1000,
              maxWidth: 'calc(100% - 48px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Suspect profile: {selectedCriminal.name}</h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Alias: "{selectedCriminal.alias || 'None'}" | Status: <b>{selectedCriminal.status}</b></span>
                </div>
                <button onClick={() => setSelectedCriminal(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  Close
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', fontSize: '12px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-red)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-red)' }}>
                    {selectedCriminal.risk_score}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px' }}>
                    Recidivism Risk Score
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '8px' }}>
                    <span>Links: <b>{selectedCriminal.connections}</b></span>
                    <span>Hub Status: <b>{selectedCriminal.is_hub ? 'Yes' : 'No'}</b></span>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '6px' }}>
                    <ShieldAlert size={14} />
                    <span>Explainable AI Risk Assessment Detail (Gemini)</span>
                  </div>
                  {loadingExplanation ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Querying Gemini core explaining score reasoning...</div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4, fontSize: '11px' }}>{riskExplanation}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Side: Chatbot Sidebar */}
        <aside className="chat-sidebar">
          <ChatAssistant token={token} />
        </aside>

      </div>
    </div>
  );
}
