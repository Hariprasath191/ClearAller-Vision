import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, ScanLine, Sparkles } from "lucide-react";
import Tesseract from "tesseract.js";

export function ImageCapturePanel({
  ingredientText,
  setIngredientText
}: {
  ingredientText: string;
  setIngredientText: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    async function attachStream() {
      if (!streaming || !videoRef.current || !streamRef.current) {
        return;
      }

      videoRef.current.srcObject = streamRef.current;

      try {
        await videoRef.current.play();
      } catch {
        setCameraError("Camera started, but the live preview could not play. Please try again.");
      }
    }

    attachStream();
  }, [streaming]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function runOcr(file: Blob) {
    setLoading(true);
    try {
      const result = await Tesseract.recognize(file, "eng");
      setIngredientText(result.data.text);
      setPreview(URL.createObjectURL(file));
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    setCameraError(null);

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setStreaming(true);
    } catch {
      setStreaming(false);
      setCameraError("Camera access was blocked or is unavailable in this browser. Please allow camera permission and try again.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }

  async function captureFrame() {
    if (!videoRef.current || !canvasRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      setCameraError("The camera preview is not ready yet. Wait a moment, then try capture again.");
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (blob) {
      await runOcr(blob);
      stopCamera();
    }
  }

  return (
    <div className="glass-card p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-title text-sm font-semibold uppercase text-ink/45">OCR capture</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">Capture a label with your camera or upload an ingredient image.</h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">Tesseract.js extracts text in the browser, then the backend normalizes and scores allergen risk profile by profile.</p>
        </div>
        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white md:flex">
          <Sparkles size={18} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="spotlight-card panel-outline rounded-[28px] p-5 text-center shadow-sm shadow-ink/5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sea/10 text-sea">
            <ImageUp />
          </div>
          <p className="mt-4 font-semibold">Upload ingredient label</p>
          <p className="mt-2 text-sm text-ink/55">PNG, JPG, or close-up packaging image</p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await runOcr(file);
              }
            }}
          />
        </label>

        <div className="mesh-panel rounded-[28px] p-5 text-white">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white">
            <Camera />
          </div>
          <p className="mt-4 font-semibold">Camera capture</p>
          <p className="mt-2 text-sm text-white/70">Use live capture when the ingredient list is only visible on-pack.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={startCamera} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink">
              {streaming ? "Restart camera" : "Start camera"}
            </button>
            <button onClick={captureFrame} className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!streaming || loading}>
              Capture and scan
            </button>
            {streaming ? (
              <button onClick={stopCamera} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Stop camera
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] bg-ink p-4 text-white shadow-lg shadow-ink/15">
        {preview ? (
          <img src={preview} alt="Captured label" className="h-64 w-full rounded-[22px] object-cover" />
        ) : (
          <div className="grid h-64 place-items-center rounded-[22px] border border-dashed border-white/15 text-center">
            <div>
              <ScanLine className="mx-auto" />
              <p className="mt-3 text-sm text-white/65">Label preview appears here after upload or capture</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] bg-black/85">
        {streaming ? (
          <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline autoPlay />
        ) : (
          <div className="grid h-56 place-items-center text-sm text-white/60">Start the camera to preview a live label here.</div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {cameraError ? <div className="mt-4 rounded-[22px] bg-coral/10 px-4 py-3 text-sm text-coral">{cameraError}</div> : null}
      <div className="panel-outline mt-4 rounded-[22px] bg-white/80 p-4 text-sm text-ink/65">
        {loading ? "Running OCR on the current image..." : ingredientText ? "OCR text is ready for analysis. You can review and edit it before sending." : "No OCR text extracted yet."}
      </div>
    </div>
  );
}
