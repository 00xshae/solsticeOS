import { ComplianceModal } from '@/components/compliance/ComplianceModal'
import { ThreatRatingModal } from '@/components/threat/ThreatRatingModal'
import { CatalogSidebar } from '@/components/layout/CatalogSidebar'
import { Header } from '@/components/layout/Header'
import { GlobeViewport } from '@/components/globe/GlobeViewport'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'
import { RsoListsPage } from '@/components/lists/RsoListsPage'
import { TimelineDock } from '@/components/timeline/TimelineDock'
import { useMissionClock } from '@/hooks/useMissionClock'
import { useMissionStore } from '@/store/missionStore'
import { useApplyTheme } from '@/store/themeStore'

export default function App() {
  useMissionClock()
  useApplyTheme()
  const view = useMissionStore((s) => s.view)
  return (
    <div className="flex h-full flex-col">
      <Header />
      {/* The lists page overlays the globe so it keeps its state and WebGL context. */}
      <div className="relative flex min-h-0 flex-1">
        {view === 'lists' && (
          <div className="absolute inset-0 z-20">
            <RsoListsPage />
          </div>
        )}
        <CatalogSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <GlobeViewport />
          <TimelineDock />
        </div>
        <InspectorPanel />
      </div>
      <ComplianceModal />
      <ThreatRatingModal />
    </div>
  )
}
