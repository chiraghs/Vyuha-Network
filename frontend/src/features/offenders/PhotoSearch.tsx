import { ImageUp, ScanFace, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/states';
import { fileToDataUri, hashImageSource, hashSimilarity } from '../../lib/imageHash';
import type { ImageSignature } from '../../lib/imageHash';
import { CATALYST_AI } from '../../api/client';
import { IntelAPI } from '../../api/endpoints';
import { mugshotDataUri } from '../../lib/mugshot';
import type { Criminal } from '../../types';

interface Match {
  criminal: Criminal;
  similarity: number;
}

interface PhotoSearchProps {
  criminals: Criminal[];
  onClose: () => void;
}

/**
 * Upload a photograph and rank the registry by perceptual similarity.
 * Registry photo hashes are computed once and cached for the session.
 */
const registryHashes = new Map<string, ImageSignature>();

export function PhotoSearch({ criminals, onClose }: PhotoSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [engine, setEngine] = useState<'catalyst' | 'local'>('local');

  const runSearch = async (file: File) => {
    setSearching(true);
    setError(null);
    setMatches(null);
    try {
      const uploaded = await fileToDataUri(file);
      setPreview(uploaded);

      // Prefer Catalyst Zia facial comparison (real biometric matching against
      // enrolled booking photos) when the deployment has it wired up. Fall
      // back to the in-browser perceptual hash otherwise, or when the backend
      // reports no enrolled photos.
      if (CATALYST_AI) {
        try {
          const res = await IntelAPI.faceSearch(file, 5);
          if (res.available && res.matches.length > 0) {
            const byId = new Map(criminals.map((c) => [c.id, c]));
            const mapped = res.matches
              .map((m) => {
                const criminal = byId.get(m.id);
                return criminal ? { criminal, similarity: m.confidence } : null;
              })
              .filter((x): x is Match => x !== null);
            setEngine('catalyst');
            setMatches(mapped);
            return;
          }
        } catch {
          // fall through to local matching
        }
      }

      const queryHash = await hashImageSource(uploaded);
      const results: Match[] = [];
      for (const criminal of criminals) {
        let hash = registryHashes.get(criminal.id);
        if (!hash) {
          hash = await hashImageSource(mugshotDataUri(criminal.id));
          registryHashes.set(criminal.id, hash);
        }
        results.push({ criminal, similarity: hashSimilarity(queryHash, hash) });
      }
      results.sort((a, b) => b.similarity - a.similarity);
      setEngine('local');
      setMatches(results.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the image.');
    } finally {
      setSearching(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) void runSearch(file);
  };

  return (
    <Card
      title="Photo search"
      subtitle={
        matches
          ? engine === 'catalyst'
            ? 'Ranked by Catalyst Zia facial comparison'
            : 'Ranked by in-browser perceptual similarity'
          : 'Rank the registry by visual similarity to an uploaded photograph'
      }
      actions={
        <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close photo search">
          <X size={15} />
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void runSearch(file);
              e.target.value = '';
            }}
          />
          {preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <img
                src={preview}
                alt="Uploaded query"
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border-strong)' }}
              />
              <button className="btn btn--secondary btn--sm" onClick={() => inputRef.current?.click()}>
                <ImageUp size={13} />
                Different photo
              </button>
            </div>
          ) : (
            <div
              className={`photo-search__drop ${dragOver ? 'is-over' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <ScanFace size={26} />
              <span>Drop a photograph here or click to upload</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
          {searching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13 }}>
              <Spinner /> Matching against {criminals.length} registry photographs…
            </div>
          )}
          {error && <div className="alert-banner alert-banner--error">{error}</div>}
          {!searching && !matches && !error && (
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
              The uploaded image is hashed locally and compared against registry photographs by
              perceptual similarity. Results are indicative leads — not biometric identification.
              Photographs exported from a dossier will match exactly.
            </p>
          )}
          {matches?.map(({ criminal, similarity }, index) => (
            <div
              key={criminal.id}
              className="photo-match"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/offenders/${criminal.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/offenders/${criminal.id}`)}
            >
              <img
                src={mugshotDataUri(criminal.id)}
                alt=""
                style={{ width: 38, height: 50, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)' }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {index === 0 && similarity > 0.97 && <Badge tone="good">Match</Badge>}{' '}
                  {criminal.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {criminal.alias ? `“${criminal.alias}” · ` : ''}
                  {criminal.status}
                </div>
                <div className="meter" style={{ marginTop: 5 }}>
                  <div
                    className="meter__fill"
                    style={{
                      width: `${Math.max(3, similarity * 100)}%`,
                      background: similarity > 0.9 ? 'var(--status-good)' : 'var(--seq-400)',
                    }}
                  />
                </div>
              </div>
              <span className="photo-match__similarity">{(similarity * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
