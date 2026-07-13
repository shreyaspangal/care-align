// Design-system bundle entry for claude.ai/design (/design-sync).
// Re-exports every storied component so the converter can assign them to
// window.<globalName>. Components import their server actions as props
// (Hard Rule 11), so nothing here pulls in Node-only server code.

// Primitives
export { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
export { EpisodeStatusBadge } from '@/components/primitives/EpisodeStatusBadge'
export { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
export { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'

// Composites
export { DocumentCard } from '@/components/composites/DocumentCard'
export { EpisodeStatusCard } from '@/components/composites/EpisodeStatusCard'
export { PendingTaskRow } from '@/components/composites/PendingTaskRow'

// Features
export { CoordinatorAccessList } from '@/components/features/CoordinatorAccessList'
export { CoordinatorSidebarNav } from '@/components/features/CoordinatorSidebarNav'
export { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
export { CreatePatientForm } from '@/components/features/CreatePatientForm'
export { DocumentClassificationEditor } from '@/components/features/DocumentClassificationEditor'
export { DocumentUploadZone } from '@/components/features/DocumentUploadZone'
export { DocumentsSection } from '@/components/features/DocumentsSection'
export { EpisodeSummaryPanel } from '@/components/features/EpisodeSummaryPanel'
export { EpisodeTimeline } from '@/components/features/EpisodeTimeline'
export { PatientInviteButton } from '@/components/features/PatientInviteButton'
export { PatientSummaryPanel } from '@/components/features/PatientSummaryPanel'
export { PatientTabNav } from '@/components/features/PatientTabNav'
export { RevokeAccessButton } from '@/components/features/RevokeAccessButton'
export { SelfRevokeCoordinatorButton } from '@/components/features/SelfRevokeCoordinatorButton'
export { TasksClient } from '@/components/features/TasksClient'
export { TranslationOutputPanel } from '@/components/features/TranslationOutputPanel'
export { UserProfileMenu } from '@/components/features/UserProfileMenu'
