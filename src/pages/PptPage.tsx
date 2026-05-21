import { useParams, Navigate } from "react-router"

export default function PptPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/articles" replace />

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000" }}>
      <iframe
        src={`/ppt/${id}.html`}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="演示文稿"
      />
    </div>
  )
}
