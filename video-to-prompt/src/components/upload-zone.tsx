"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  onUpload?: (file: File) => void;
  onSelect?: (file: File) => void;
  showActionButton?: boolean;
};

const ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
};

export function UploadZone({ onUpload, onSelect, showActionButton = true }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const previewUrl = useMemo(() => (selected ? URL.createObjectURL(selected) : null), [selected]);

  const onDrop = useCallback((files: File[]) => {
    setError(null);
    if (!files.length) return;
    const file = files[0];
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large. Max 500MB.");
      return;
    }
    setSelected(file);
    if (onSelect) onSelect(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    multiple: false,
  });

  useEffect(() => {
    if (!previewUrl) return;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = previewUrl;
    const onLoaded = () => {
      if (!isNaN(video.duration)) setDuration(video.duration);
      URL.revokeObjectURL(previewUrl);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [previewUrl]);

  return (
    <div className="w-full">
      <Card
        className="p-6 border-dashed border-2 cursor-pointer hover:bg-muted/50"
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop the video here..." : "Drag & drop a video (MP4, MOV, WebM) or click to browse (max 500MB)"}
          </p>
          {selected && (
            <div className="mt-3 space-y-2">
              <div className="text-sm">
                Selected: <span className="font-medium">{selected.name}</span> ({(selected.size / (1024 * 1024)).toFixed(1)} MB)
                {duration !== null && (
                  <span className="ml-2 text-muted-foreground">• {(duration).toFixed(1)}s</span>
                )}
              </div>
              {previewUrl && (
                <div className="flex justify-center">
                  <video src={previewUrl} className="rounded border max-h-48" muted controls={false} />
                </div>
              )}
            </div>
          )}
          {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
        </div>
      </Card>
      {showActionButton && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => selected && onUpload && onUpload(selected)} disabled={!selected || !onUpload}>
            Upload & Analyze
          </Button>
        </div>
      )}
    </div>
  );
}


