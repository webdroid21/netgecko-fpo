import { toast } from 'sonner';
import { useState } from 'react';
import { ref, getStorage, uploadBytes, getDownloadURL } from 'firebase/storage';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { compressImage } from 'src/utils/compress-image';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { firebaseApp } from 'src/lib/firebase';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Attachment = {
  id: string;
  url: string;
  filename?: string;
  type?: string;
  thumbnails?: { small?: { url: string } };
};

type RecordAttachmentFieldProps = {
  /** API path of the record, e.g. `/api/v1/sales-orders/rec123`. */
  endpoint: string;
  /** Airtable attachment field name. */
  name: string;
  label: string;
  value?: Attachment[];
  /** Folder in Firebase Storage the file is uploaded to. */
  storageFolder: string;
  onSaved: () => void;
};

export function RecordAttachmentField({
  endpoint,
  name,
  label,
  value,
  storageFolder,
  onSaved,
}: RecordAttachmentFieldProps) {
  const { canEdit } = useAuthContext();
  const { t } = useTranslate('common');
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const attachments: Attachment[] = Array.isArray(value) ? value : [];

  const patchAttachments = async (next: { id?: string; url?: string; filename?: string }[]) => {
    await axios.patch(endpoint, { fields: { [name]: next } });
    onSaved();
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const upload = await compressImage(file);
      const storage = getStorage(firebaseApp);
      const fileRef = ref(storage, `${storageFolder}/${Date.now()}-${upload.name}`);
      await uploadBytes(fileRef, upload);
      const url = await getDownloadURL(fileRef);
      await patchAttachments([
        ...attachments.map((a) => ({ id: a.id })),
        { url, filename: upload.name },
      ]);
      toast.success(`${label} updated successfully`);
    } catch (error: any) {
      toast.error(error?.message || `Failed to upload ${label}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (attachment: Attachment) => {
    setRemovingId(attachment.id);
    try {
      await patchAttachments(
        attachments.filter((a) => a.id !== attachment.id).map((a) => ({ id: a.id }))
      );
      toast.success('Attachment removed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove attachment');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>

      {attachments.length === 0 ? (
        <Typography variant="body1" sx={{ color: 'text.disabled' }}>
          —
        </Typography>
      ) : (
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {attachments.map((attachment) => {
            const filename = attachment.filename || 'Attachment';
            const isImage =
              attachment.type?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|heic)$/i.test(filename);
            const thumb = attachment.thumbnails?.small?.url ?? (isImage ? attachment.url : null);

            return (
              <Stack key={attachment.id} direction="row" alignItems="center" spacing={1}>
                {thumb && (
                  <Box
                    component="img"
                    src={thumb}
                    alt={filename}
                    sx={{
                      width: 32,
                      height: 32,
                      objectFit: 'cover',
                      borderRadius: 0.5,
                      flexShrink: 0,
                    }}
                  />
                )}
                <MuiLink
                  href={attachment.url}
                  target="_blank"
                  rel="noopener"
                  variant="body2"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {filename}
                </MuiLink>
                {canEdit && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(attachment)}
                    disabled={Boolean(removingId)}
                  >
                    {removingId === attachment.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Iconify icon={'solar:trash-bin-trash-bold' as any} width={16} />
                    )}
                  </IconButton>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button
            size="small"
            component="label"
            startIcon={
              uploading ? (
                <CircularProgress size={14} />
              ) : (
                <Iconify icon={'solar:camera-bold' as any} width={16} />
              )
            }
            disabled={uploading}
          >
            {uploading ? t('uploading') : t('takePhoto')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </Button>
          <Button
            size="small"
            component="label"
            startIcon={<Iconify icon={'solar:upload-bold' as any} width={16} />}
            disabled={uploading}
          >
            {attachments.length ? t('addFile') : t('attachFile')}
            <input
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </Button>
        </Stack>
      )}
    </Box>
  );
}
