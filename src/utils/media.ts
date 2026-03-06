import type { Asset } from 'react-native-image-picker';

export type PickedFile = { uri: string; name: string; type: string };

const normalizeUri = (uri: string) => {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `file://${uri}`;
};

export const assetToPickedFile = (asset: Asset | null | undefined, fallbackName: string): PickedFile | null => {
  if (!asset) return null;
  const uri = normalizeUri(asset.fileCopyUri || asset.uri || '');
  if (!uri) return null;
  return {
    uri,
    name: asset.fileName || fallbackName,
    type: asset.type || 'image/jpeg',
  };
};
