import { CatalogSidebar } from '@/components/layout/CatalogSidebar'
import { Header } from '@/components/layout/Header'
import { GlobeViewport } from '@/components/globe/GlobeViewport'
import { useMissionClock } from '@/hooks/useMissionClock'

export default function App() {
  useMissionClock()
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <CatalogSidebar />
        <GlobeViewport />
      </div>
    </div>
  )
}
