"use client";

import { useEffect, useRef, useState } from "react";

// Live camera barcode scanner for food packaging (EAN and UPC codes).
// Calls onCode once with the digits, then stops the camera.
export default function Scanner({ onCode }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let controls = null;
    let stopped = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (result && !stopped) {
              stopped = true;
              ctrl.stop();
              onCode(result.getText());
            }
          }
        );
        if (stopped) controls.stop();
      } catch (e) {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your phone's Settings, or type the barcode below."
            : "Couldn't start the camera. Type the barcode below instead."
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onCode]);

  return (
    <div className="scanner">
      {!error && (
        <div className="scan-box">
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="scan-line" />
        </div>
      )}
      {!error && <p className="muted">Point the camera at the barcode.</p>}
      {error && <p className="error">{error}</p>}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.length >= 8) onCode(typed);
        }}
      >
        <input
          inputMode="numeric"
          placeholder="Or type the barcode number"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn small-btn" disabled={typed.length < 8}>Look up</button>
      </form>
    </div>
  );
}
