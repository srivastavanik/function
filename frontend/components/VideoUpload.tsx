'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle } from 'lucide-react';
import { uploadVideo, formatFileSize } from '@/lib/api';
import { useRouter } from 'next/navigation';

const MAX_FILE_SIZE = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE) || 104857600;
const ALLOWED_EXTENSIONS = (process.env.NEXT_PUBLIC_ALLOWED_EXTENSIONS || 'mp4,avi,mov,mkv').split(',');

export default function VideoUpload() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const uploadFile = acceptedFiles[0];
      
      // Validate file size
      if (uploadFile.size > MAX_FILE_SIZE) {
        setError(`File size exceeds maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`);
        return;
      }

      // Validate file extension
      const extension = uploadFile.name.split('.').pop()?.toLowerCase();
      if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
        setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
        return;
      }

      setError(null);
      setFile(uploadFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ALLOWED_EXTENSIONS.map(ext => `.${ext}`)
    },
    maxFiles: 1,
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadVideo(file);
      router.push(`/session/${result.sessionId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'}
          ${file ? 'bg-gray-50' : 'bg-white'}`}
      >
        <input {...getInputProps()} />
        
        {!file ? (
          <>
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              {isDragActive ? 'Drop the video here...' : 'Drag & drop a video file here'}
            </p>
            <p className="text-sm text-gray-500">
              or click to select a file
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Max size: {formatFileSize(MAX_FILE_SIZE)} | Formats: {ALLOWED_EXTENSIONS.join(', ')}
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded">
                  <Upload className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-all
            ${uploading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'gradient-bg hover:opacity-90 card-shadow'}`}
        >
          {uploading ? 'Uploading...' : 'Analyze Video'}
        </button>
      )}
    </div>
  );
}
