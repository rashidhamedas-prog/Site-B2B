'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../api';
import { clientUploadImageRejection } from '../upload-image';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File): Promise<string> => {
    const rejection = clientUploadImageRejection(file);
    if (rejection) throw new Error(rejection);
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
