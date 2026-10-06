import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/** Reads a local image URI (from the image picker) into bytes for upload. */
export async function readImageBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' || uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')) {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

export function isLocalUri(uri: string) {
  return !/^https?:\/\//.test(uri);
}
