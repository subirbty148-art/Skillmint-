import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

async function compressImageToDataUrl(file: File, maxDim = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 180000) {
          resolve(canvas.toDataURL('image/jpeg', 0.48));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface UploadImageResult {
  url: string;
  usedFallback: boolean;
}

export async function uploadImageAsset(
  file: File,
  storagePath: string
): Promise<UploadImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a valid PNG, JPG, or WebP image file.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size must be under 5 MB.');
  }

  try {
    const storageRef = ref(storage, storagePath);
    const uploadPromise = uploadBytes(storageRef, file, {
      contentType: file.type,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timed out')), 9000)
    );

    const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
    const url = await getDownloadURL(snapshot.ref);
    return { url, usedFallback: false };
  } catch (err) {
    // Fallback to compressed inline proof if Firebase Storage bucket has not been initialized in Console yet
    console.warn('Firebase Storage unavailable, compressing image fallback:', err);
    const compressed = await compressImageToDataUrl(file);
    if (compressed.length > 195000) {
      throw new Error(
        'Firebase Storage is not enabled yet and compressed image exceeded 195KB. Please enable Firebase Storage in Console or choose a smaller screenshot.'
      );
    }
    return { url: compressed, usedFallback: true };
  }
}
