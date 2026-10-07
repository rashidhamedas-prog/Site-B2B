'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../api';
import { prepareProductUploadFile } from '../prepare-product-image';
import { clientUploadImageRejection, MAX_UPLOAD_IMAGE_BYTES } from '../upload-image';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File): Promise<string> => {
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error('حجم عکس بیشتر از ۲۰ مگابایت است.');
    }
    setUploading(true);
    try {
      const prepared = await prepareProductUploadFile(file);
      const rejection = clientUploadImageRejection(prepared);
      if (rejection) throw new Error(rejection);
      const { url } = await apiClient.uploadImage(prepared);
      return url;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading };
}
