import { Camera } from "lucide-react";
import * as React from "react";
import { useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (base64: string, mimeType: string) => void | Promise<void>;
  buttonText?: string;
  className?: string;
}

export function CameraCapture({ onCapture, buttonText = "拍照", className = "" }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result as string;
      // Extract base64 and mime type
      const [prefix, base64] = result.split(",");
      const mimeType = prefix.match(/:(.*?);/)?.[1] || "image/jpeg";
      try {
        await onCapture(base64, mimeType);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={className}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 w-full shadow-lg"
      >
        {isProcessing
          ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            )
          : (
              <Camera className="w-5 h-5" />
            )}
        {isProcessing ? "处理中..." : buttonText}
      </button>
    </div>
  );
}
