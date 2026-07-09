'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../api';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const { url } = await apiClient.uploadImage(file);
      return url;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading };
}
