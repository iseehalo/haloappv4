import { supabase } from '../supabaseClient';

export async function fetchPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      image_url,
      media_url,
      media_type,
      caption,
      created_at,
      user:users (
        id,
        username,
        profile_picture
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  // Backward compatibility: if media_url is missing, fall back to image_url
  const normalized = data.map(post => ({
    ...post,
    media_url: post.media_url || post.image_url || null,
    media_type: post.media_type || (post.image_url ? 'image' : null),
  }));

  return normalized;
}
