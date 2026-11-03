import { supabase, isSupabaseConfigured } from '../supabase';

const LOCAL_STORAGE_KEY = 'offline_audio_recordings_cache_v3';
const COMMENTS_STORAGE_KEY = 'offline_comments_cache_v1';

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

function getLocalComments() {
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalComments(items) {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Storage full or error saving comments', e);
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
    likes: Array.isArray(item.likes) ? item.likes : [],
    playCount: item.play_count || item.playCount || 0,
    parentId: item.parent_id || item.parentId || null,
  };
}

/**
 * Upload MP3 and publish to the global social feed
 */
export async function createRecording({ audioBlob, name, author, duration, size, parentId = null }) {
  const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`;

  if (isSupabaseConfigured && supabase) {
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(fileName, audioBlob, {
        contentType: 'audio/mp3',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName);

    const publicAudioUrl = urlData.publicUrl;

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
          likes: [],
          play_count: 0,
          parent_id: parentId,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(`Publish failed: ${insertError.message}`);

    return normalizeRecord(data);
  } else {
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
          likes: [],
          playCount: 0,
          parentId,
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

/**
 * Toggle Like on a recording (Social interaction)
 */
export async function toggleLikeRecording(id, username) {
  if (isSupabaseConfigured && supabase) {
    const { data: current } = await supabase
      .from('recordings')
      .select('likes')
      .eq('id', id)
      .single();

    let currentLikes = current?.likes || [];
    if (currentLikes.includes(username)) {
      currentLikes = currentLikes.filter((u) => u !== username);
    } else {
      currentLikes = [...currentLikes, username];
    }

    await supabase
      .from('recordings')
      .update({ likes: currentLikes })
      .eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.map((item) => {
      if (item.id === id) {
        const currentLikes = item.likes || [];
        const newLikes = currentLikes.includes(username)
          ? currentLikes.filter((u) => u !== username)
          : [...currentLikes, username];
        return { ...item, likes: newLikes };
      }
      return item;
    });
    saveLocalRecordings(updated);
  }
}

/**
 * Increment play count
 */
export async function incrementPlayCount(id) {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('recordings').select('play_count').eq('id', id).single();
    const newCount = (data?.play_count || 0) + 1;
    await supabase.from('recordings').update({ play_count: newCount }).eq('id', id);
  } else {
    const list = getLocalRecordings();
    const updated = list.map((item) =>
      item.id === id ? { ...item, playCount: (item.playCount || 0) + 1 } : item
    );
    saveLocalRecordings(updated);
  }
}

/**
 * Subscribe to comments for a recording
 */
export function subscribeToComments(recordingId, callback) {
  if (isSupabaseConfigured && supabase) {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('recording_comments')
        .select('*')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: true });

      callback(data || []);
    };

    fetchComments();

    const channel = supabase
      .channel(`comments_${recordingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recording_comments', filter: `recording_id=eq.${recordingId}` },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } else {
    const all = getLocalComments();
    const filtered = all.filter((c) => c.recording_id === recordingId);
    callback(filtered);
    return () => {};
  }
}

/**
 * Post a comment
 */
export async function addComment(recordingId, author, text) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('recording_comments').insert([
      {
        recording_id: recordingId,
        author,
        text,
      },
    ]);
  } else {
    const all = getLocalComments();
    const newComment = {
      id: `comment_${Date.now()}`,
      recording_id: recordingId,
      author,
      text,
      created_at: new Date().toISOString(),
    };
    saveLocalComments([...all, newComment]);
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
