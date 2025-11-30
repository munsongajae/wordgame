import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';
import { useUser } from '../contexts/UserContext';
import {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  Post,
  Comment,
} from '../services/boardService';
import { UserName } from '../types/ranking';
import './BoardPage.css';

export default function BoardPage() {
  const navigate = useNavigate();
  const { currentUserName } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postAuthor, setPostAuthor] = useState<string>(currentUserName);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentContents, setCommentContents] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    setPostAuthor(currentUserName);
  }, [currentUserName]);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const data = await getPosts();
      setPosts(data);
    } catch (error) {
      console.error('게시글 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const data = await getComments(postId);
      setComments(prev => ({ ...prev, [postId]: data }));
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (editingPost) {
      const author = postAuthor.trim() || editingPost.user_name;
      const success = await updatePost(editingPost.id, postTitle, postContent, author as UserName);
      if (success) {
        await loadPosts();
        setShowPostForm(false);
        setEditingPost(null);
        setPostTitle('');
        setPostContent('');
      }
    } else {
      const author = postAuthor.trim() || currentUserName;
      const newPost = await createPost(postTitle, postContent, author as UserName);
      if (newPost) {
        await loadPosts();
        setShowPostForm(false);
        setPostTitle('');
        setPostContent('');
      }
    }
  };

  const handlePostDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    const success = await deletePost(id);
    if (success) {
      await loadPosts();
      if (expandedPostId === id) {
        setExpandedPostId(null);
      }
    }
  };

  const handlePostEdit = (post: Post) => {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostAuthor(post.user_name);
    setShowPostForm(true);
  };

  const handleCommentSubmit = async (postId: string) => {
    const content = commentContents[postId] || '';
    if (!content.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    const author = (commentAuthors[postId] || currentUserName).trim() || currentUserName;
    const newComment = await createComment(postId, content, author as UserName);
    if (newComment) {
      await loadComments(postId);
      setCommentContents(prev => ({ ...prev, [postId]: '' }));
      setCommentAuthors(prev => ({ ...prev, [postId]: currentUserName }));
    }
  };

  const handleCommentEdit = async (commentId: string, postId: string) => {
    if (!editingCommentContent.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    const success = await updateComment(commentId, editingCommentContent);
    if (success) {
      await loadComments(postId);
      setEditingCommentId(null);
      setEditingCommentContent('');
    }
  };

  const handleCommentDelete = async (commentId: string, postId: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    const success = await deleteComment(commentId);
    if (success) {
      await loadComments(postId);
    }
  };

  const togglePostExpanded = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      if (!comments[postId]) {
        loadComments(postId);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app-container">
      <QuizHeader title="게시판" onBack={() => navigate('/')} timeLeft={0} score={0} />

      <div className="board-container">
        <div className="board-header">
          <button
            className="btn-primary"
            onClick={() => {
              setShowPostForm(!showPostForm);
              setEditingPost(null);
                    setPostTitle('');
                    setPostContent('');
                    setPostAuthor(currentUserName);
            }}
          >
            {showPostForm ? '취소' : '글쓰기'}
          </button>
        </div>

        {showPostForm && (
          <div className="post-form">
            <h3>{editingPost ? '게시글 수정' : '새 게시글 작성'}</h3>
            <form onSubmit={handlePostSubmit}>
              <div className="form-group">
                <label>작성자</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={postAuthor}
                    onChange={(e) => setPostAuthor(e.target.value)}
                    className="form-control"
                    style={{ flex: '0 0 120px' }}
                  >
                    <option value="열음이">열음이</option>
                    <option value="지음이">지음이</option>
                    <option value="규진이">규진이</option>
                    <option value="규선이">규선이</option>
                    <option value="">직접 입력</option>
                  </select>
                  <input
                    type="text"
                    value={postAuthor}
                    onChange={(e) => setPostAuthor(e.target.value)}
                    className="form-control"
                    placeholder="작성자 이름을 입력하세요"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>제목</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="form-control"
                  placeholder="제목을 입력하세요"
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label>내용</label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="form-control"
                  placeholder="내용을 입력하세요"
                  rows={6}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingPost ? '수정' : '작성'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowPostForm(false);
                    setEditingPost(null);
                    setPostTitle('');
                    setPostContent('');
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="loading">게시글을 불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <p>아직 게시글이 없습니다. 첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="post-meta">
                    <span className="post-author">{post.user_name}</span>
                    <span className="post-date">{formatDate(post.created_at)}</span>
                    {post.updated_at !== post.created_at && (
                      <span className="post-updated">(수정됨)</span>
                    )}
                  </div>
                  <div className="post-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handlePostEdit(post)}
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handlePostDelete(post.id)}
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <h3 className="post-title" onClick={() => togglePostExpanded(post.id)}>
                  {post.title}
                </h3>
                {expandedPostId === post.id && (
                  <div className="post-detail">
                    <div className="post-content">{post.content}</div>
                    <div className="comments-section">
                      <h4>댓글 ({comments[post.id]?.length || 0})</h4>
                      <div className="comments-list">
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="comment-item">
                            {editingCommentId === comment.id ? (
                              <div className="comment-edit">
                                <textarea
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  className="form-control"
                                  rows={2}
                                />
                                <div className="comment-actions">
                                  <button
                                    className="btn-small"
                                    onClick={() => handleCommentEdit(comment.id, post.id)}
                                  >
                                    저장
                                  </button>
                                  <button
                                    className="btn-small btn-secondary"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentContent('');
                                    }}
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="comment-header">
                                  <span className="comment-author">{comment.user_name}</span>
                                  <span className="comment-date">{formatDate(comment.created_at)}</span>
                                  <div className="comment-actions">
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentContent(comment.content);
                                      }}
                                      title="수정"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => handleCommentDelete(comment.id, post.id)}
                                      title="삭제"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                                <div className="comment-content">{comment.content}</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="comment-form">
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <select
                            value={commentAuthors[post.id] || currentUserName}
                            onChange={(e) =>
                              setCommentAuthors(prev => ({ ...prev, [post.id]: e.target.value }))
                            }
                            className="form-control"
                            style={{ flex: '0 0 120px' }}
                          >
                            <option value="열음이">열음이</option>
                            <option value="지음이">지음이</option>
                            <option value="규진이">규진이</option>
                            <option value="규선이">규선이</option>
                            <option value="">직접 입력</option>
                          </select>
                          <input
                            type="text"
                            value={commentAuthors[post.id] || currentUserName}
                            onChange={(e) =>
                              setCommentAuthors(prev => ({ ...prev, [post.id]: e.target.value }))
                            }
                            className="form-control"
                            placeholder="작성자 이름을 입력하세요"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <textarea
                          value={commentContents[post.id] || ''}
                          onChange={(e) =>
                            setCommentContents(prev => ({ ...prev, [post.id]: e.target.value }))
                          }
                          className="form-control"
                          placeholder="댓글을 입력하세요..."
                          rows={2}
                        />
                        <button
                          className="btn-small btn-primary"
                          onClick={() => handleCommentSubmit(post.id)}
                        >
                          댓글 작성
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

