import { useParams, Navigate } from "react-router"
import { lazy, Suspense } from "react"

const reactPPTs: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  "smart-customer-service": lazy(() => import("@/pages/ppt/SmartCustomerService")),
}

export default function PptPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/articles" replace />

  const Component = reactPPTs[id]

  if (Component) {
    return (
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0b] text-white/40 font-mono text-sm">
          Loading...
        </div>
      }>
        <Component />
      </Suspense>
    )
  }

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
