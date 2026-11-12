/** Future storage adapters implement this boundary; first-version clients expose no upload UI. */
export type MediaKind = "image" | "video";
export type MediaReference = {
  id: string;
  kind: MediaKind;
  status: "pending" | "ready" | "deleted";
};
export type UploadIntent = {
  ownerId: string;
  communityId: string;
  kind: MediaKind;
  contentType: string;
  byteLength: number;
};
export interface MediaStorage {
  createUpload(intent: UploadIntent): Promise<{
    media: MediaReference;
    uploadUrl: string;
    expiresAt: string;
  }>;
  confirmUpload(ownerId: string, mediaId: string): Promise<MediaReference>;
  resolveForViewer(viewerId: string | null, mediaId: string): Promise<{
    url: string;
    expiresAt: string;
  }>;
  remove(ownerId: string, mediaId: string): Promise<void>;
}
// No adapter is instantiated and no upload/signing route is registered in version one.
