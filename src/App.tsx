import { ComplianceModal } from '@/components/compliance/ComplianceModal'
import { CatalogSidebar } from '@/components/layout/CatalogSidebar'
import { Header } from '@/components/layout/Header'
import { GlobeViewport } from '@/components/globe/GlobeViewport'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'
import { ManeuverTimeline } from '@/components/timeline/ManeuverTimeline'
import { useMissionClock } from '@/hooks/useMissionClock'
import { useApplyTheme } from '@/store/themeStore'

export default function App() {
  useMissionClock()
  useApplyTheme()
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <CatalogSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <GlobeViewport />
          <ManeuverTimeline />
        </div>
        <InspectorPanel />
      </div>
      <ComplianceModal />
    </div>
  )
}
