import { supabase, isSupabaseConfigured } from '../supabase';

const LOCAL_STORAGE_KEY = 'offline_audio_recordings_cache_v3';

function getLocalRecordings() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalRecordings(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Storage full or error saving to localStorage', e);
  }
}

/**
 * Real-time listener for all shared recordings across all users worldwide.
 */
export function subscribeToRecordings(callback) {
  if (isSupabaseConfigured && supabase) {
    const fetchRecordings = async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        callback(getLocalRecordings());
      } else if (data) {
        const formatted = data.map(normalizeRecord);
        callback(formatted);
      }
    };

    fetchRecordings();

    const channel = supabase
      .channel('public_global_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recordings' },
        () => {
          fetchRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } else {
    const local = getLocalRecordings();
    callback(local);
    const interval = setInterval(() => {
      callback(getLocalRecordings());
    }, 1500);
    return () => clearInterval(interval);
  }
}

function normalizeRecord(item) {
  return {
    id: item.id,
    name: item.name,
    author: item.author,
    duration: item.duration || 0,
    size: item.size || 0,
    audioUrl: item.audio_url || item.audioUrl,
    storagePath: item.storage_path || item.storagePath,
    isDeleted: Boolean(item.is_deleted ?? item.isDeleted),
    deletedAt: item.deleted_at || item.deletedAt,
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

/**
 * Helper to upload a file with real-time XMLHttpRequest progress (0% - 100%)
 */
function uploadToSupabaseWithProgress({ supabaseUrl, anonKey, bucket, path, fileBlob, contentType, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('Content-Type', contentType || 'audio/mpeg');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText || '{}'));
      } else {
        reject(new Error(`Storage upload error (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fileBlob);
  });
}

/**
 * Upload audio blob to Supabase Storage and insert metadata with live progress callback
 */
export async function createRecording({ audioBlob, name, author, duration, size, onProgress = null }) {
  // Determine file extension
  let ext = 'mp3';
  if (audioBlob.type.includes('m4a') || audioBlob.type.includes('mp4')) ext = 'm4a';
  else if (audioBlob.type.includes('wav')) ext = 'wav';
  else if (audioBlob.type.includes('ogg')) ext = 'ogg';
  else if (audioBlob.type.includes('webm')) ext = 'webm';

  const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  if (isSupabaseConfigured && supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // 1. Upload with real-time progress
    await uploadToSupabaseWithProgress({
      supabaseUrl,
      anonKey,
      bucket: 'recordings',
      path: fileName,
      fileBlob: audioBlob,
      contentType: audioBlob.type || 'audio/mpeg',
      onProgress: (percent) => {
        if (onProgress) onProgress({ stage: 'upload', percent });
      }
    });

    // 2. Get Public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName);

    const publicAudioUrl = urlData.publicUrl;

    if (onProgress) onProgress({ stage: 'saving', percent: 100 });

    // 3. Insert metadata into PostgreSQL
    const { data, error: insertError } = await supabase
      .from('recordings')
      .insert([
        {
          name,
          author,
          duration: Math.round(duration),
          size: size || audioBlob.size,
          audio_url: publicAudioUrl,
          storage_path: fileName,
          is_deleted: false,
          deleted_at: null,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(`Database save error: ${insertError.message}`);

    return normalizeRecord(data);
  } else {
    // Offline local fallback
    if (onProgress) {
      onProgress({ stage: 'upload', percent: 50 });
      setTimeout(() => onProgress({ stage: 'saving', percent: 100 }), 300);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const audioUrl = reader.result;
        const newDoc = {
          id: `local_${Date.now()}`,
          name,
          author,
          duration: Math.round(duration),
          size: size || audioBlob.size,
          audioUrl,
          storagePath: fileName,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date().toISOString(),
        };

        const existing = getLocalRecordings();
        const updated = [newDoc, ...existing];
        saveLocalRecordings(updated);
        resolve(newDoc);
      };
      reader.readAsDataURL(audioBlob);
    });
  }
}

export async function renameRecording(id, newName) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('recordings').update({ name: newName }).eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.map((item) => (item.id === id ? { ...item, name: newName } : item));
    saveLocalRecordings(updated);
  }
}

export async function softDeleteRecording(id) {
  if (isSupabaseConfigured && supabase) {
    await supabase
      .from('recordings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.map((item) =>
      item.id === id ? { ...item, isDeleted: true, deletedAt: new Date().toISOString() } : item
    );
    saveLocalRecordings(updated);
  }
}

export async function restoreRecording(id) {
  if (isSupabaseConfigured && supabase) {
    await supabase
      .from('recordings')
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.map((item) =>
      item.id === id ? { ...item, isDeleted: false, deletedAt: null } : item
    );
    saveLocalRecordings(updated);
  }
}

export async function permanentlyDeleteRecording(id, storagePath) {
  if (isSupabaseConfigured && supabase) {
    if (storagePath) {
      try {
        await supabase.storage.from('recordings').remove([storagePath]);
      } catch (err) {
        console.warn('Supabase storage delete warning:', err);
      }
    }
    await supabase.from('recordings').delete().eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.filter((item) => item.id !== id);
    saveLocalRecordings(updated);
  }
}
