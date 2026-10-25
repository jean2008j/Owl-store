import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";

export function QrMark({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
    void toDataURL(value || "OWL STORE", {
      margin: 1,
      width: 280,
      color: { dark: "#0c0c0c", light: "#f4f1ea" },
    }).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [value]);

  if (!src) {
    return <div className="aspect-square w-full bg-fg" aria-hidden />;
  }

  return <img src={src} alt={`Sham Cash code for ${value}`} className="aspect-square w-full" />;
}
