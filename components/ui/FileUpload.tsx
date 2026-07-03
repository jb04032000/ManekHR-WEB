'use client';

import React, { useState, useRef, useEffect, useId, startTransition } from 'react';
import {
  UploadOutlined,
  CloseOutlined,
  FileTextOutlined,
  FileImageOutlined,
} from '@ant-design/icons';
import { uploadService, UploadOptions } from '@/lib/services/upload.service';
import { message } from 'antd';

interface FileUploadProps {
  category: UploadOptions['category'];
  value?: string | File; // Can be URL (existing) or File (pending upload)
  onChange?: (value: string | File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

export function FileUpload({
  category,
  value,
  onChange,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
  disabled = false,
  className = '',
  variant = 'default',
}: FileUploadProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Update preview when value prop changes
  useEffect(() => {
    if (!value) {
      startTransition(() => {
        setPreview(null);
      });
    } else if (typeof value === 'string') {
      // Existing URL
      startTransition(() => {
        setPreview(value);
      });
    } else if (value instanceof File) {
      // New file - create preview
      const previewUrl = uploadService.getFilePreviewUrl(value);
      startTransition(() => {
        setPreview(previewUrl);
      });
      return () => uploadService.revokePreviewUrl(previewUrl);
    }
  }, [value]);

  const handleFileSelect = async (file: File) => {
    // Convert accept string to array of MIME types
    const allowedTypes = accept.split(',').map((t) => t.trim());
    const validation = uploadService.validateFile(file, allowedTypes);

    if (!validation.valid) {
      messageApi.error(validation.error);
      return;
    }

    // Show preview
    const previewUrl = uploadService.getFilePreviewUrl(file);
    setPreview(previewUrl);

    // Pass File object to parent (upload will happen on form submit)
    onChange?.(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleRemove = async () => {
    // If it's an existing R2 URL, delete it
    if (typeof value === 'string' && value.startsWith('https://')) {
      await uploadService.deleteFile(value);
    }

    setPreview(null);
    onChange?.('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImage =
    preview &&
    (preview.includes('image') ||
      /\.(jpg|jpeg|png|webp)$/i.test(preview) ||
      preview.startsWith('blob:'));
  const isPdf = preview && preview.includes('pdf');

  // Compact variant for profile photos
  if (variant === 'compact') {
    return (
      <div className={className}>
        {contextHolder}

        {preview ? (
          <div className="relative inline-block">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200">
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            )}
          </div>
        ) : (
          <div
            className="relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={accept}
              onChange={handleFileInputChange}
              className="absolute h-0 w-0 overflow-hidden opacity-0"
              disabled={disabled}
              tabIndex={-1}
            />
            <label
              htmlFor={inputId}
              onClick={() => fileInputRef.current?.click()}
              className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-dashed bg-gray-50 transition-colors ${isDragging ? 'border-blue-500 bg-blue-100' : 'border-gray-300 hover:bg-gray-100'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
            >
              <UploadOutlined style={{ fontSize: 20, color: 'var(--cr-text-5)' }} />
              <span className="mt-1 text-[10px] text-gray-700">Upload</span>
            </label>
          </div>
        )}
      </div>
    );
  }

  // Default variant for documents
  return (
    <div className={className}>
      {contextHolder}

      {preview ? (
        <div className="relative rounded-lg border-2 border-gray-200 p-4">
          {isImage ? (
            <img src={preview} alt="Preview" className="h-48 w-full rounded object-cover" />
          ) : isPdf ? (
            <div className="flex h-48 items-center justify-center rounded bg-gray-50">
              <FileTextOutlined style={{ fontSize: 64, color: 'var(--cr-text-5)' }} />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded bg-gray-50">
              <FileImageOutlined style={{ fontSize: 64, color: 'var(--cr-text-5)' }} />
            </div>
          )}

          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <CloseOutlined style={{ fontSize: 10 }} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="absolute h-0 w-0 overflow-hidden opacity-0"
            disabled={disabled}
            tabIndex={-1}
          />
          <label
            htmlFor={inputId}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`block flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'cursor-not-allowed opacity-50' : ''} `}
          >
            <UploadOutlined style={{ fontSize: 32, color: 'var(--cr-text-5)', marginBottom: 8 }} />

            <div>
              <p className="mb-1 text-sm text-gray-600">
                Drag and drop a file here, or click to select
              </p>
              <p className="text-xs text-faint">
                Max size: 5MB • Formats:{' '}
                {accept.includes('pdf') ? 'JPEG, PNG, WebP, PDF' : 'JPEG, PNG, WebP'}
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
