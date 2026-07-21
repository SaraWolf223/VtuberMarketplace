import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ImageCropModal } from '@/components/media/ImageCropModal';
import { registerImageCropHandler } from '@/lib/image-crop-session';
import type { CropAspect } from '@/lib/image-crop-pick';

type CropSession = {
  uri: string;
  aspect: CropAspect;
  title?: string;
};

export function ImageCropProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<CropSession | null>(null);
  const [resolver, setResolver] = useState<((uri: string | null) => void) | null>(null);

  const requestCrop = useCallback((uri: string, aspect: CropAspect, title?: string) => {
    return new Promise<string | null>((resolve) => {
      setSession({ uri, aspect, title });
      setResolver(() => resolve);
    });
  }, []);

  useEffect(() => {
    registerImageCropHandler((uri, aspect, title) => requestCrop(uri, aspect, title));
    return () => registerImageCropHandler(null);
  }, [requestCrop]);

  const finish = (uri: string | null) => {
    resolver?.(uri);
    setResolver(null);
    setSession(null);
  };

  return (
    <>
      {children}
      {session ? (
        <ImageCropModal
          visible
          imageUri={session.uri}
          aspect={session.aspect}
          title={session.title}
          onDone={(uri) => finish(uri)}
          onCancel={() => finish(null)}
        />
      ) : null}
    </>
  );
}
