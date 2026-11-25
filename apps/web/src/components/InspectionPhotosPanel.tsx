import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, type HydratedQuote } from '../api/client';

export type InspectionAngle =
  | 'FRONT'
  | 'REAR'
  | 'LEFT'
  | 'RIGHT'
  | 'CHASSIS_VIN'
  | 'ENGINE_NO';

interface SlotConfig {
  angle: InspectionAngle;
  label: string;
  shortHint: string;
  category: 'EXTERIOR' | 'IDENTITY';
}

const PHOTO_SLOTS: SlotConfig[] = [
  {
    angle: 'FRONT',
    label: 'Front View',
    shortHint: 'Front bumper, headlights & registration plate',
    category: 'EXTERIOR',
  },
  {
    angle: 'REAR',
    label: 'Rear View',
    shortHint: 'Rear bumper, tail lights & registration plate',
    category: 'EXTERIOR',
  },
  {
    angle: 'LEFT',
    label: 'Left Side',
    shortHint: 'Full left body profile & doors',
    category: 'EXTERIOR',
  },
  {
    angle: 'RIGHT',
    label: 'Right Side',
    shortHint: 'Full right body profile & doors',
    category: 'EXTERIOR',
  },
  {
    angle: 'CHASSIS_VIN',
    label: 'Chassis / VIN Plate',
    shortHint: 'Stamped chassis number plate (firewall / door pillar)',
    category: 'IDENTITY',
  },
  {
    angle: 'ENGINE_NO',
    label: 'Engine Number',
    shortHint: 'Engraved engine block serial number',
    category: 'IDENTITY',
  },
];

interface InspectionPhotosPanelProps {
  quote: HydratedQuote;
  actionBusy: boolean;
  onQuoteUpdated: (quote: HydratedQuote, notice: string) => void;
  onError: (msg: string) => void;
}

/**
 * Resize & compress uploaded phone/desktop photos on the client so large
 * 6-12 MB camera photos upload rapidly (~120 KB JPEG) while keeping
 * stamped chassis & engine numbers legible.
 */
async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, HEIC, or WebP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Selected photo is over 15 MB. Please choose a smaller image.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  // Skip canvas re-encode for tiny SVGs or already tiny images (< 180 KB)
  if (file.type === 'image/svg+xml' || rawDataUrl.length < 240_000) {
    return rawDataUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 1280;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function makeSandboxSamplePhoto(plate: string, label: string, refLine?: string): string {
  const safeRef = (refLine ?? '').replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300"><rect width="520" height="300" fill="#0f172a"/><rect x="18" y="18" width="484" height="264" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/><text x="38" y="64" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold">COVERFLOW SANDBOX INSPECTION SAMPLE</text><text x="38" y="118" fill="#ffffff" font-family="monospace" font-size="28" font-weight="bold">${plate} · ${label}</text>${
    safeRef
      ? `<text x="38" y="158" fill="#fbbf24" font-family="monospace" font-size="16" font-weight="bold">${safeRef}</text>`
      : ''
  }<text x="38" y="205" fill="#94a3b8" font-family="sans-serif" font-size="13">Captured: ${new Date().toISOString()}</text><text x="38" y="240" fill="#34d399" font-family="sans-serif" font-size="12">UAT placeholder — replace with real vehicle photo in production</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function InspectionPhotosPanel({
  quote,
  actionBusy,
  onQuoteUpdated,
  onError,
}: InspectionPhotosPanelProps) {
  const items = quote.items;
  const [selectedPlate, setSelectedPlate] = useState<string>(
    items[0]?.vehicle.normalizedPlate ?? '',
  );
  const [uploadingAngle, setUploadingAngle] = useState<InspectionAngle | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fillingSamples, setFillingSamples] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{
    angle: string;
    label: string;
    plate: string;
    dataUrl: string;
    capturedAt: string;
    traRef?: string;
  } | null>(null);

  const previewDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (items.length > 0 && !items.some((i) => i.vehicle.normalizedPlate === selectedPlate)) {
      setSelectedPlate(items[0].vehicle.normalizedPlate);
    }
  }, [items, selectedPlate]);

  useEffect(() => {
    const dlg = previewDialogRef.current;
    if (!dlg) return;
    if (previewPhoto && !dlg.open) {
      dlg.showModal();
    } else if (!previewPhoto && dlg.open) {
      dlg.close();
    }
  }, [previewPhoto]);

  const activeItem =
    items.find((i) => i.vehicle.normalizedPlate === selectedPlate) ?? items[0];
  const plate = activeItem?.vehicle.normalizedPlate ?? '';
  const platePhotos = quote.preCoverPhotos.filter((p) => p.plate === plate);
  const capturedCount = new Set(platePhotos.map((p) => p.angle)).size;
  const requiresPhotos =
    Boolean(quote.insurer?.requiresPhotosForComprehensive) &&
    activeItem?.coverType === 'COMPREHENSIVE';

  const handleFileChange = async (angle: InspectionAngle, label: string, file: File | null) => {
    if (!file || !plate) return;
    setUploadingAngle(angle);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const updated = await api.uploadPhoto(quote.id, {
        plate,
        angle,
        dataUrl,
        consentGiven: true,
      });
      onQuoteUpdated(
        updated,
        `Uploaded ${label} inspection photo for ${plate} (saved with timestamp for ClaimFlow).`,
      );
    } catch (err) {
      onError((err as Error).message || 'Could not upload photo.');
    } finally {
      setUploadingAngle(null);
    }
  };

  const handleDelete = async (photoId: string, label: string) => {
    setDeletingId(photoId);
    try {
      const updated = await api.deletePhoto(quote.id, photoId);
      onQuoteUpdated(updated, `Removed ${label} photo for ${plate}.`);
    } catch (err) {
      onError((err as Error).message || 'Could not remove photo.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFillSandboxSamples = async () => {
    if (!plate) return;
    setFillingSamples(true);
    try {
      let latestQuote = quote;
      const missing = PHOTO_SLOTS.filter(
        (slot) => !platePhotos.some((p) => p.angle === slot.angle),
      );
      for (const slot of missing) {
        const refLine =
          slot.angle === 'CHASSIS_VIN'
            ? `VIN: ${activeItem?.vehicle.chassisNo ?? ''}`
            : slot.angle === 'ENGINE_NO'
              ? `ENG: ${activeItem?.vehicle.engineNo ?? ''}`
              : undefined;
        latestQuote = await api.uploadPhoto(quote.id, {
          plate,
          angle: slot.angle,
          dataUrl: makeSandboxSamplePhoto(plate, slot.label, refLine),
          consentGiven: true,
        });
      }
      onQuoteUpdated(
        latestQuote,
        `Added ${missing.length} sandbox sample inspection photo(s) for ${plate}.`,
      );
    } catch (err) {
      onError((err as Error).message || 'Could not attach sample photos.');
    } finally {
      setFillingSamples(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Camera className="h-5 w-5 text-sky-600" aria-hidden="true" />
            Vehicle Inspection Photos (4 Views + Chassis &amp; Engine No.)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload real photos from your camera, gallery, or WhatsApp. Compressed automatically and
            stored timestamped with consent for underwriting &amp; ClaimFlow FNOL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              capturedCount >= 6
                ? 'bg-emerald-100 text-emerald-800'
                : capturedCount >= 4
                  ? 'bg-sky-100 text-sky-800'
                  : requiresPhotos
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-700'
            }`}
          >
            {capturedCount} / 6 captured
          </span>
        </div>
      </div>

      {/* Multi-vehicle plate tabs */}
      {items.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => {
            const count = new Set(
              quote.preCoverPhotos
                .filter((p) => p.plate === item.vehicle.normalizedPlate)
                .map((p) => p.angle),
            ).size;
            const active = item.vehicle.normalizedPlate === plate;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedPlate(item.vehicle.normalizedPlate)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'border-sky-600 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono-code">{item.vehicle.normalizedPlate}</span>
                <span className="ml-1.5 text-[11px] font-semibold opacity-75">({count}/6)</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Requirement / Verification Banner */}
      <div
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs ${
          requiresPhotos && capturedCount < 4
            ? 'border border-amber-200 bg-amber-50 text-amber-950'
            : 'border border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck
            className={`h-4 w-4 shrink-0 ${
              requiresPhotos && capturedCount < 4 ? 'text-amber-600' : 'text-sky-600'
            }`}
            aria-hidden="true"
          />
          <span>
            {requiresPhotos
              ? `${quote.insurer?.name} requires at least 4 inspection photos for Comprehensive bind.`
              : `Recommended for Comprehensive & theft verification.`}
            {' '}
            Include <strong>Chassis/VIN</strong> &amp; <strong>Engine No.</strong> to prevent TIRA402
            mismatches.
          </span>
        </div>
        {capturedCount < 6 && (
          <button
            type="button"
            disabled={actionBusy || fillingSamples || Boolean(uploadingAngle)}
            onClick={handleFillSandboxSamples}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            title="For quick desktop UAT only when you don't have real car photos handy"
          >
            {fillingSamples ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3 text-amber-500" aria-hidden="true" />
            )}
            Fill UAT Samples
          </button>
        )}
      </div>

      {/* 6 Real Upload Photo Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PHOTO_SLOTS.map((slot) => {
          const existing = platePhotos.find((p) => p.angle === slot.angle);
          const isUploading = uploadingAngle === slot.angle;
          const isDeleting = existing && deletingId === existing.id;
          const inputId = `photo-upload-${plate}-${slot.angle}`;

          const traRef =
            slot.angle === 'CHASSIS_VIN' && activeItem?.vehicle.chassisNo
              ? `TRA Chassis: ${activeItem.vehicle.chassisNo}`
              : slot.angle === 'ENGINE_NO' && activeItem?.vehicle.engineNo
                ? `TRA Engine: ${activeItem.vehicle.engineNo}`
                : undefined;

          return (
            <div
              key={slot.angle}
              className={`flex flex-col overflow-hidden rounded-xl border transition ${
                existing
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : slot.category === 'IDENTITY'
                    ? 'border-dashed border-sky-300 bg-sky-50/30 hover:border-sky-500'
                    : 'border-dashed border-slate-300 bg-slate-50/70 hover:border-sky-400'
              }`}
            >
              <input
                id={inputId}
                type="file"
                accept="image/*"
                disabled={actionBusy || isUploading || fillingSamples}
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  void handleFileChange(slot.angle, slot.label, picked);
                }}
                className="visually-hidden"
              />

              {existing ? (
                <>
                  <div className="relative h-32 w-full bg-slate-900">
                    <img
                      src={existing.dataUrl}
                      alt={`${plate} ${slot.label}`}
                      onClick={() =>
                        setPreviewPhoto({
                          angle: slot.angle,
                          label: slot.label,
                          plate,
                          dataUrl: existing.dataUrl,
                          capturedAt: existing.capturedAt,
                          traRef,
                        })
                      }
                      className="h-full w-full cursor-zoom-in object-cover"
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Captured
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({
                          angle: slot.angle,
                          label: slot.label,
                          plate,
                          dataUrl: existing.dataUrl,
                          capturedAt: existing.capturedAt,
                          traRef,
                        })
                      }
                      aria-label={`Inspect ${slot.label} photo`}
                      className="absolute right-2 top-2 rounded-lg bg-slate-950/75 p-1.5 text-white hover:bg-slate-950"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-slate-900">{slot.label}</span>
                        {slot.category === 'IDENTITY' && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                            ID Plate
                          </span>
                        )}
                      </div>
                      {traRef && (
                        <div className="mt-0.5 truncate font-mono-code text-[10px] font-semibold text-sky-900">
                          {traRef}
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {new Date(existing.capturedAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5">
                      <label
                        htmlFor={inputId}
                        className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        )}
                        Replace
                      </label>
                      <button
                        type="button"
                        disabled={Boolean(isDeleting) || actionBusy}
                        onClick={() => handleDelete(existing.id, slot.label)}
                        aria-label={`Remove ${slot.label} photo`}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <label
                  htmlFor={inputId}
                  className="flex min-h-[176px] flex-1 cursor-pointer flex-col items-center justify-center p-4 text-center"
                >
                  <div
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
                      slot.category === 'IDENTITY'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
                    ) : (
                      <Upload className="h-5 w-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                    {slot.label}
                    {slot.category === 'IDENTITY' && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                        VIN / Serial
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{slot.shortHint}</p>
                  {traRef && (
                    <div className="mt-1.5 max-w-full truncate rounded bg-white px-2 py-0.5 font-mono-code text-[10px] font-bold text-sky-900 ring-1 ring-sky-200">
                      {traRef}
                    </div>
                  )}
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-sky-700 shadow-sm ring-1 ring-slate-200">
                    <Camera className="h-3 w-3" aria-hidden="true" />
                    {isUploading ? 'Uploading…' : 'Upload / Take Photo'}
                  </span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Native Accessible Lightbox Preview Dialog */}
      <dialog
        ref={previewDialogRef}
        onCancel={() => setPreviewPhoto(null)}
        onClick={(e) => {
          if (e.target === previewDialogRef.current) setPreviewPhoto(null);
        }}
        className="m-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/75"
      >
        {previewPhoto && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  {previewPhoto.plate} · {previewPhoto.label}
                </div>
                <div className="text-xs text-slate-500">
                  Captured {new Date(previewPhoto.capturedAt).toLocaleString()}
                  {previewPhoto.traRef ? ` · ${previewPhoto.traRef}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                aria-label="Close photo preview"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="bg-slate-950 p-4">
              <img
                src={previewPhoto.dataUrl}
                alt={`${previewPhoto.plate} ${previewPhoto.label}`}
                className="mx-auto max-h-[70vh] rounded-lg object-contain"
              />
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
