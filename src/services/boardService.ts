import { getSupabase, getCurrentUserName } from './supabaseClient';
import { UserName } from '../types/ranking';

export interface Post {
  id: string;
  user_name: UserName;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_name: UserName;
  content: string;
  created_at: string;
  updated_at: string;
}

// 게시글 목록 조회
export async function getPosts(): Promise<Post[]> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('게시글 조회 실패:', error);
      return [];
    }

    return (data || []) as Post[];
  } catch (error) {
    console.error('게시글 조회 중 오류:', error);
    return [];
  }
}

// 게시글 작성
export async function createPost(
  title: string,
  content: string,
  userName?: UserName
): Promise<Post | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return null;
  }

  const author = userName || getCurrentUserName();

  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_name: author,
        title: title.trim(),
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('게시글 작성 실패:', error);
      return null;
    }

    return data as Post;
  } catch (error) {
    console.error('게시글 작성 중 오류:', error);
    return null;
  }
}

// 게시글 수정
export async function updatePost(
  id: string,
  title: string,
  content: string,
  userName?: UserName
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return false;
  }

  try {
    const updateData: { title: string; content: string; user_name?: UserName } = {
      title: title.trim(),
      content: content.trim(),
    };
    
    if (userName) {
      updateData.user_name = userName;
    }

    const { error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('게시글 수정 실패:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('게시글 수정 중 오류:', error);
    return false;
  }
}

// 게시글 삭제
export async function deletePost(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('게시글 삭제 실패:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('게시글 삭제 중 오류:', error);
    return false;
  }
}

// 댓글 목록 조회
export async function getComments(postId: string): Promise<Comment[]> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('댓글 조회 실패:', error);
      return [];
    }

    return (data || []) as Comment[];
  } catch (error) {
    console.error('댓글 조회 중 오류:', error);
    return [];
  }
}

// 댓글 작성
export async function createComment(
  postId: string,
  content: string,
  userName?: UserName
): Promise<Comment | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return null;
  }

  const author = userName || getCurrentUserName();

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_name: author,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('댓글 작성 실패:', error);
      return null;
    }

    return data as Comment;
  } catch (error) {
    console.error('댓글 작성 중 오류:', error);
    return null;
  }
}

// 댓글 수정
export async function updateComment(
  id: string,
  content: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('comments')
      .update({
        content: content.trim(),
      })
      .eq('id', id);

    if (error) {
      console.error('댓글 수정 실패:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('댓글 수정 중 오류:', error);
    return false;
  }
}

// 댓글 삭제
export async function deleteComment(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않았습니다.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('댓글 삭제 실패:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('댓글 삭제 중 오류:', error);
    return false;
  }
}

