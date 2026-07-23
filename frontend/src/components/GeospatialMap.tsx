import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CrimeRecord } from '../types';

interface MapProps {
  crimes: CrimeRecord[];
  onSelectCrime?: (crime: CrimeRecord) => void;
}

export const GeospatialMap: React.FC<MapProps> = ({ crimes, onSelectCrime }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map instance directly on container
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Centered around Karnataka state center
    const map = L.map(mapContainerRef.current).setView([13.9716, 75.5946], 7);
    mapRef.current = map;

    // Dark-themed premium map layer matching our dark styling
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when crimes payload changes
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markersRef.current;
    if (!map || !markerGroup) return;

    // Clear previous markers
    markerGroup.clearLayers();

    if (crimes.length === 0) return;

    // Color definitions for crime categories
    const getCategoryColor = (cat: string) => {
      switch (cat) {
        case 'Homicide': return '#ef4444'; // Red
        case 'Narcotics': return '#a855f7'; // Purple
        case 'Cybercrime': return '#3b82f6'; // Blue
        case 'Assault': return '#f97316'; // Orange
        case 'Theft': case 'Burglary': return '#fbbf24'; // Gold/Yellow
        default: return '#10b981'; // Green
      }
    };

    crimes.forEach((crime) => {
      const { latitude, longitude, FIR_number, crime_category, station_name, description, status } = crime;

      // Render hotspot circles with custom category colors and glowing borders
      const marker = L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: getCategoryColor(crime_category),
        fillOpacity: 0.8,
        color: '#ffffff',
        weight: 1.5,
      });

      const popupContent = `
        <div style="font-family: Inter, sans-serif; color: #111; min-width: 200px; padding: 6px;">
          <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 4px; color: #0f172a;">${FIR_number}</h4>
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">
            ${crime_category}
          </span>
          <p style="font-size: 11px; margin-top: 8px; color: #475569;"><b>Station:</b> ${station_name}</p>
          <p style="font-size: 11px; margin-top: 4px; color: #475569;"><b>Status:</b> <span style="color: ${status === 'Open' ? '#ef4444' : '#16a34a'}">${status}</span></p>
          <p style="font-size: 11px; margin-top: 6px; color: #334155; line-height: 1.4;">${description}</p>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (onSelectCrime) {
          onSelectCrime(crime);
        }
      });

      marker.addTo(markerGroup);
    });

    // Auto-adjust view boundary to encompass markers
    if (crimes.length > 0) {
      const points = crimes.map(c => L.latLng(c.latitude, c.longitude));
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }

  }, [crimes, onSelectCrime]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
      
      {/* Dynamic legend box overlay */}
      <div className="glass-card" style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(3, 7, 18, 0.85)',
        border: '1px solid var(--border-glass)',
        padding: '12px',
        pointerEvents: 'none'
      }}>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px' }}>
          Crime Category Legend
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span>Homicide</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7' }} />
            <span>Narcotics</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
            <span>Cybercrime</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316' }} />
            <span>Assault</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
            <span>Theft / Burglary</span>
          </div>
        </div>
      </div>
    </div>
  );
};
