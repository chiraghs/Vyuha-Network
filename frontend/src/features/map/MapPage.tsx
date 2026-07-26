import { Flame, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { AnalyticsAPI } from '../../api/endpoints';
import { Badge, SeriesChip } from '../../components/ui/Badge';
import { SearchField, Segmented, SelectField } from '../../components/ui/fields';
import { CenteredLoader, ErrorState } from '../../components/ui/states';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useTheme } from '../../context/ThemeContext';
import { CRIME_SUBHEADS, resolveStableColor } from '../../lib/categories';
import {
  DISTRICT_SHAPES,
  KARNATAKA_BOUNDS,
  KARNATAKA_MASK,
} from '../../lib/karnatakaGeo';
import type { LatLng } from '../../lib/karnatakaGeo';
import { formatDateTime, formatNumber } from '../../lib/format';
import type { CrimeRecord, MapPoint } from '../../types';

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MAX_BOUNDS: [LatLng, LatLng] = [
  [KARNATAKA_BOUNDS[0][0] - 1.5, KARNATAKA_BOUNDS[0][1] - 1.5],
  [KARNATAKA_BOUNDS[1][0] + 1.5, KARNATAKA_BOUNDS[1][1] + 1.5],
];

type ViewMode = 'incidents' | 'hotspots';

interface Hotspot {
  key: string;
  lat: number;
  lng: number;
  count: number;
  topCategory: string;
}

/** Cluster points into ~0.12° grid cells for density rendering. */
function computeHotspots(points: MapPoint[]): Hotspot[] {
  const CELL = 0.12;
  const cells = new Map<string, { latSum: number; lngSum: number; count: number; categories: Map<string, number> }>();
  for (const p of points) {
    const key = `${Math.round(p.lat / CELL)}:${Math.round(p.lng / CELL)}`;
    const cell = cells.get(key) ?? { latSum: 0, lngSum: 0, count: 0, categories: new Map() };
    cell.latSum += p.lat;
    cell.lngSum += p.lng;
    cell.count += 1;
    cell.categories.set(p.category, (cell.categories.get(p.category) ?? 0) + 1);
    cells.set(key, cell);
  }
  return [...cells.entries()].map(([key, cell]) => ({
    key,
    lat: cell.latSum / cell.count,
    lng: cell.lngSum / cell.count,
    count: cell.count,
    topCategory: [...cell.categories.entries()].sort((a, b) => b[1] - a[1])[0][0],
  }));
}

/** Smoothly refocuses the map when the target bounds change. */
function MapFocus({ bounds }: { bounds: [LatLng, LatLng] }) {
  const map = useMap();
  useEffect(() => {
    map.flyToBounds(bounds, { padding: [36, 36], duration: 0.8 });
  }, [bounds, map]);
  return null;
}

export function MapPage() {
  const { theme } = useTheme();
  const [districtId, setDistrictId] = useState('');
  const [stationId, setStationId] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('incidents');
  const [selectedCrime, setSelectedCrime] = useState<CrimeRecord | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  const districtsState = useApi(() => AnalyticsAPI.districts(), []);
  const stationsState = useApi(() => AnalyticsAPI.stations(), []);
  const pointsState = useApi(
    () =>
      AnalyticsAPI.mapPoints({
        district_id: districtId ? Number(districtId) : undefined,
        station_id: stationId ? Number(stationId) : undefined,
        category: category || undefined,
        search: debouncedSearch || undefined,
      }),
    [districtId, stationId, category, debouncedSearch],
  );

  const points = pointsState.data?.points ?? [];
  const totalPoints = pointsState.data?.total ?? 0;
  const capped = pointsState.data?.capped ?? false;
  const hotspots = useMemo(() => computeHotspots(points), [points]);

  const openCase = (id: string) => {
    setLoadingCase(true);
    AnalyticsAPI.case(id)
      .then((c) => setSelectedCrime(c))
      .catch(() => setSelectedCrime(null))
      .finally(() => setLoadingCase(false));
  };
  const maxHotspot = useMemo(() => Math.max(1, ...hotspots.map((h) => h.count)), [hotspots]);

  // Resolved hex per category present in the current point set — CSS variables
  // don't reach SVG presentation attributes.
  const categoryColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of points) if (!map.has(p.category)) map.set(p.category, resolveStableColor(p.category));
    // theme dependency re-resolves on flip
    void theme;
    return map;
  }, [points, theme]);
  const colorFor = (cat: string) => categoryColors.get(cat) ?? resolveStableColor(cat);

  const uiColors = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();
    return {
      page: read('--bg-page'),
      accent: read('--accent'),
      axis: read('--axis-line'),
      ink: read('--text-2'),
    };
  }, [theme]);

  const selectedDbName = useMemo(
    () => districtsState.data?.find((d) => String(d.id) === districtId)?.name ?? null,
    [districtsState.data, districtId],
  );

  const selectedShape = useMemo(
    () => DISTRICT_SHAPES.find((s) => s.dbName === selectedDbName) ?? null,
    [selectedDbName],
  );

  const focusBounds = selectedShape?.bounds ?? KARNATAKA_BOUNDS;

  const visibleStations = useMemo(
    () =>
      (stationsState.data ?? []).filter(
        (s) => !selectedDbName || s.district_name === selectedDbName,
      ),
    [stationsState.data, selectedDbName],
  );

  // Distinct categories present in the current (capped) point set, for the legend.
  const activeCategories = useMemo(
    () => [...new Set(points.map((p) => p.category))].sort().slice(0, 12),
    [points],
  );

  const selectDistrictByName = (dbName: string) => {
    const district = districtsState.data?.find((d) => d.name === dbName);
    if (!district) return;
    setStationId('');
    setDistrictId((current) => (current === String(district.id) ? '' : String(district.id)));
  };

  const hotspotColor = theme === 'dark' ? '#e66767' : '#d03b3b';

  return (
    <main className="page page--flush map-page">
      <div className="map-toolbar">
        <div className="filter-row">
          <SelectField
            label="District"
            value={districtId}
            onChange={(v) => {
              setDistrictId(v);
              setStationId('');
            }}
            placeholder="All districts"
            options={(districtsState.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <SelectField
            label="Police station"
            value={stationId}
            onChange={setStationId}
            placeholder="All stations"
            disabled={!districtId}
            options={visibleStations.map((s) => ({ value: String(s.id), label: s.name }))}
          />
          <SelectField
            label="Category"
            value={category}
            onChange={setCategory}
            placeholder="All categories"
            options={CRIME_SUBHEADS.map((c) => ({ value: c, label: c }))}
          />
          <div style={{ minWidth: 220 }}>
            <SearchField
              label="Keyword"
              value={search}
              onChange={setSearch}
              placeholder="FIR number, description…"
            />
          </div>
          <div className="filter-row__spacer" />
          <Segmented<ViewMode>
            ariaLabel="Map layer"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'incidents', label: 'Incidents', icon: <MapPin size={13} /> },
              { value: 'hotspots', label: 'Hotspots', icon: <Flame size={13} /> },
            ]}
          />
        </div>
      </div>

      <div className="map-stage">
        {pointsState.error ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <ErrorState message={pointsState.error} onRetry={pointsState.refetch} />
          </div>
        ) : (
          <>
            <MapContainer
              bounds={KARNATAKA_BOUNDS}
              maxBounds={MAX_BOUNDS}
              maxBoundsViscosity={0.9}
              minZoom={6}
              scrollWheelZoom
              style={{ height: '100%' }}
            >
              <TileLayer key={theme} url={TILE_URLS[theme]} attribution={TILE_ATTRIBUTION} />
              <MapFocus bounds={focusBounds} />

              {/* Dim everything outside Karnataka; the mask's holes are the districts. */}
              <Polygon
                positions={KARNATAKA_MASK}
                interactive={false}
                pathOptions={{
                  fillColor: uiColors.page,
                  fillOpacity: 0.82,
                  fillRule: 'evenodd',
                  color: uiColors.ink,
                  weight: 1.4,
                  opacity: 0.9,
                }}
              />

              {/* District boundaries: hover to preview, click to filter. */}
              {DISTRICT_SHAPES.map((shape) => {
                const isSelected = selectedShape?.geoName === shape.geoName;
                const isHovered = hoveredDistrict === shape.geoName;
                const dimmed = selectedShape !== null && !isSelected;
                const inDb = districtsState.data?.some((d) => d.name === shape.dbName) ?? false;
                return (
                  <Polygon
                    key={shape.geoName}
                    positions={shape.polygons}
                    pathOptions={{
                      color: isSelected || isHovered ? uiColors.accent : uiColors.axis,
                      weight: isSelected ? 2.2 : isHovered ? 1.8 : 1,
                      opacity: dimmed ? 0.5 : 0.9,
                      fillColor: dimmed ? uiColors.page : uiColors.accent,
                      fillOpacity: dimmed ? 0.55 : isSelected ? 0.05 : isHovered ? 0.1 : 0,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        e.target.closeTooltip();
                        if (inDb) selectDistrictByName(shape.dbName);
                      },
                      mouseover: () => setHoveredDistrict(shape.geoName),
                      mouseout: () =>
                        setHoveredDistrict((cur) => (cur === shape.geoName ? null : cur)),
                    }}
                  >
                    <Tooltip sticky opacity={1}>
                      <strong>{shape.dbName}</strong>
                      <br />
                      {inDb
                        ? isSelected
                          ? 'Selected · click to clear'
                          : 'Click to focus district'
                        : 'No registered incidents'}
                    </Tooltip>
                  </Polygon>
                );
              })}

              {viewMode === 'incidents' &&
                points.map((p) => {
                  const color = colorFor(p.category);
                  const isSelected = selectedCrime?.id === p.id;
                  return (
                    <CircleMarker
                      key={p.id}
                      center={[p.lat, p.lng]}
                      radius={isSelected ? 10 : 6}
                      pathOptions={{
                        color: isSelected ? color : 'transparent',
                        weight: 2,
                        fillColor: color,
                        fillOpacity: 0.85,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          e.target.closeTooltip();
                          openCase(p.id);
                        },
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                        <strong>{p.FIR_number}</strong> · {p.category}
                        <br />
                        {p.station}
                      </Tooltip>
                    </CircleMarker>
                  );
                })}

              {viewMode === 'hotspots' &&
                hotspots.map((spot) => (
                  <CircleMarker
                    key={spot.key}
                    center={[spot.lat, spot.lng]}
                    radius={10 + (spot.count / maxHotspot) * 26}
                    pathOptions={{
                      color: hotspotColor,
                      weight: 1.5,
                      fillColor: hotspotColor,
                      fillOpacity: 0.16 + (spot.count / maxHotspot) * 0.38,
                    }}
                  >
                    <Tooltip direction="top" opacity={1}>
                      <strong>{spot.count} incidents</strong>
                      <br />
                      Dominant: {spot.topCategory}
                    </Tooltip>
                  </CircleMarker>
                ))}
            </MapContainer>

            <div className="card map-count-pill">
              {pointsState.loading
                ? 'Loading incidents…'
                : capped
                  ? `Showing ${formatNumber(points.length)} of ${formatNumber(totalPoints)} · ${selectedDbName ?? 'Karnataka'}`
                  : `${formatNumber(totalPoints)} incidents · ${selectedDbName ?? 'Karnataka'}`}
            </div>

            {viewMode === 'incidents' && activeCategories.length > 0 && (
              <div className="card map-legend" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <div className="map-legend__title">Crime sub-heads</div>
                {activeCategories.map((c) => (
                  <SeriesChip key={c} color={colorFor(c)} label={c} />
                ))}
              </div>
            )}

            {viewMode === 'hotspots' && (
              <div className="card map-legend">
                <div className="map-legend__title">Density</div>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Circle size &amp; opacity scale with incident count per cell
                </span>
              </div>
            )}

            {(pointsState.loading || loadingCase) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1150,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--bg-overlay)',
                }}
              >
                <CenteredLoader label={loadingCase ? 'Loading case…' : 'Loading incident data…'} />
              </div>
            )}

            {selectedCrime && (
              <aside className="slide-panel" aria-label="Case details">
                <div className="slide-panel__header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 650, fontFamily: 'var(--font-mono)' }}>
                      {selectedCrime.FIR_number}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge tone="neutral" dotColor={colorFor(selectedCrime.crime_category)}>
                        {selectedCrime.crime_category}
                      </Badge>
                      {selectedCrime.gravity && (
                        <Badge tone={selectedCrime.gravity === 'Heinous' ? 'critical' : 'neutral'}>
                          {selectedCrime.gravity}
                        </Badge>
                      )}
                      {selectedCrime.case_category && (
                        <Badge tone="accent">{selectedCrime.case_category}</Badge>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost btn--icon"
                    onClick={() => setSelectedCrime(null)}
                    aria-label="Close case details"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="slide-panel__body">
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                    {selectedCrime.description}
                  </p>

                  <dl className="def-list">
                    <dt>Crime head</dt>
                    <dd>{selectedCrime.crime_head ?? '—'}</dd>
                    <dt>Status</dt>
                    <dd>{selectedCrime.status}</dd>
                    <dt>Registered</dt>
                    <dd>{formatDateTime(selectedCrime.occurrence_time)}</dd>
                    <dt>Station</dt>
                    <dd>{selectedCrime.station_name}</dd>
                    <dt>District</dt>
                    <dd>{selectedCrime.district_name}</dd>
                    {selectedCrime.io_officer && (
                      <>
                        <dt>Investigating officer</dt>
                        <dd>{selectedCrime.io_officer}</dd>
                      </>
                    )}
                    {selectedCrime.court_name && (
                      <>
                        <dt>Court</dt>
                        <dd>{selectedCrime.court_name}</dd>
                      </>
                    )}
                    <dt>Accused / Victims</dt>
                    <dd>
                      {selectedCrime.accused_count ?? 0} / {selectedCrime.victim_count ?? 0}
                    </dd>
                    {selectedCrime.chargesheet_type && (
                      <>
                        <dt>Final report</dt>
                        <dd>
                          {selectedCrime.chargesheet_type === 'A'
                            ? 'Chargesheet'
                            : selectedCrime.chargesheet_type === 'B'
                              ? 'False case'
                              : 'Undetected'}
                        </dd>
                      </>
                    )}
                  </dl>

                  {selectedCrime.acts_sections && selectedCrime.acts_sections.length > 0 && (
                    <div>
                      <div className="dossier__fact-label" style={{ marginBottom: 8 }}>
                        Acts &amp; sections invoked
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedCrime.acts_sections.map((as, i) => (
                          <span key={i} className="dossier__mark-chip" title={as.description ?? ''}>
                            {as.act} §{as.section}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCrime.socio_economic_factors && (
                    <div>
                      <div className="dossier__fact-label" style={{ marginBottom: 8 }}>
                        Complainant profile
                      </div>
                      <dl className="def-list">
                        {selectedCrime.socio_economic_factors.complainant_occupation && (
                          <>
                            <dt>Occupation</dt>
                            <dd>{selectedCrime.socio_economic_factors.complainant_occupation}</dd>
                          </>
                        )}
                        {selectedCrime.socio_economic_factors.complainant_religion && (
                          <>
                            <dt>Religion</dt>
                            <dd>{selectedCrime.socio_economic_factors.complainant_religion}</dd>
                          </>
                        )}
                        {selectedCrime.socio_economic_factors.complainant_caste && (
                          <>
                            <dt>Caste</dt>
                            <dd>{selectedCrime.socio_economic_factors.complainant_caste}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </>
        )}
      </div>
    </main>
  );
}
