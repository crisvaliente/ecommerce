// pages/posts.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Post = {
  id: number
  title: string
  content: string
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase.from('posts').select('*')

      if (error) {
        console.error('Error fetching posts:', error)
      } else {
        setPosts(data as Post[])
      }

      setLoading(false)
    }

    fetchPosts()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>📄 Lista de Posts</h1>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <strong>{post.title}</strong>: {post.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
