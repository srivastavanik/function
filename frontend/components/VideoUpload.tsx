'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadVideo } from '@/lib/api';

interface VideoUploadProps {
  onUploadComplete: (sessionId: string) => void;
}

export default function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv']
    },
    maxSize: 104857600, // 100MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const response = await uploadVideo(file);
      setUploadProgress(100);
      setTimeout(() => {
        onUploadComplete(response.sessionId);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      clearInterval(progressInterval);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          {...getRootProps()}
          className={`upload-area ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-[#F5F1EA] rounded-full mb-4"></div>
            
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop your video here' : 'Drag & drop your video here'}
            </p>
            <p className="text-sm text-[#666666]">
              or <button type="button" className="text-[#111111] underline">browse files</button>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#EEEEEE]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-[#666666] mt-1">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {!uploading && (
                <button
                  onClick={removeFile}
                  className="text-[#999999] hover:text-[#111111] ml-4"
                >
                  ✕
                </button>
              )}
            </div>

            {uploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[#EEEEEE] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#111111] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-[#C62828] text-sm p-3 bg-[#FFEBEE] rounded">
              {error}
            </div>
          )}

          {!uploading && (
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                className="btn btn-primary flex-1"
              >
                Upload Video
              </button>
              <button
                onClick={removeFile}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}