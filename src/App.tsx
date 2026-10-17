import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewView } from './components/dashboard/OverviewView';
import { IncidentsView } from './components/incidents/IncidentsView';
import { IncidentDetailModal } from './components/incidents/IncidentDetailModal';
import { SimilarSearchView } from './components/similarity/SimilarSearchView';
import { IncidentComparisonView } from './components/comparison/IncidentComparisonView';
import { LogExplorerView } from './components/logs/LogExplorerView';
import { EscalationQueueView } from './components/escalations/EscalationQueueView';
import { RecommendationsView } from './components/recommendations/RecommendationsView';
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { TeamView } from './components/team/TeamView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { AuditTrailView } from './components/audit/AuditTrailView';
import { WorkflowVisualization } from './components/workflow/WorkflowVisualization';
import { ArchitectureGuideView } from './components/guide/ArchitectureGuideView';

// Modals & Floating Drawers
import { RegisterIncidentModal } from './components/modals/RegisterIncidentModal';
import { RecordActionModal } from './components/modals/RecordActionModal';
import { ResolveIncidentModal } from './components/modals/ResolveIncidentModal';
import { RequestEscalationModal } from './components/modals/RequestEscalationModal';
import { ReviewEscalationModal } from './components/modals/ReviewEscalationModal';
import { GuidedDemoModal } from './components/demo/GuidedDemoModal';
import { AssistantChatDrawer } from './components/chat/AssistantChatDrawer';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';

import { User, Incident, AnalyticsOverview, NotificationItem, IncidentAnalyticsFilter, AIAvailability } from './types';
import { api } from './services/api';

const DEFAULT_USERS: User[] = [
  {
    id: 'USR-SEC-01',
    username: 'analyst.elena',
    name: 'Elena Rostova',
    role: 'analyst',
    email: 'e.rostova@zenvora.ibmz.internal',
    avatar: 'ER'
  },
  {
    id: 'USR-SEC-02',
    username: 'analyst.marcus',
    name: 'Marcus Chen',
    role: 'analyst',
    email: 'm.chen@zenvora.ibmz.internal',
    avatar: 'MC'
  },
  {
    id: 'USR-MGR-01',
    username: 'manager.sarah',
    name: 'Sarah Vance',
    role: 'manager',
    email: 's.vance@zenvora.ibmz.internal',
    avatar: 'SV'
  },
  {
    id: 'USR-REP-01',
    username: 'reporter.alex',
    name: 'Alex Rivera',
    role: 'reporter',
    email: 'a.rivera@zenvora.ibmz.internal',
    avatar: 'AR'
  }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USERS[0]);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [aiStatus, setAIStatus] = useState<AIAvailability>({ state: 'checking' });
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [analyticsFilter, setAnalyticsFilter] = useState<IncidentAnalyticsFilter | null>(null);

  // Selected incident for detail view
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Modals state
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [isRecordActionOpen, setIsRecordActionOpen] = useState(false);
  const [actionIncidentId, setActionIncidentId] = useState<string | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(null);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [escalateIncidentId, setEscalateIncidentId] = useState<string | null>(null);
  const [isReviewEscalationOpen, setIsReviewEscalationOpen] = useState(false);
  const [reviewEscalationId, setReviewEscalationId] = useState<string | null>(null);
  const [reviewIncidentId, setReviewIncidentId] = useState<string | null>(null);
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Fetch Core Data
  const refreshData = async () => {
    try {
      setDataError(null);
      // Users & AI status
      const authRes = await api.getUsers();
      if (authRes.users?.length > 0) setUsers(authRes.users);
      try {
        const statusRes = await api.getStatus();
        setAIStatus(statusRes.aiStatus);
      } catch (err) {
        setAIStatus({
          state: 'configured-unverified',
          message: err instanceof Error ? err.message : 'AI availability could not be checked.'
        });
      }

      // Incidents
      const incRes = await api.getIncidents();
      setIncidents(incRes.incidents);

      // Analytics
      const anRes = await api.getOverview();
      setAnalytics(anRes);

      // Notifications
      const notifRes = await api.getNotifications({
        user_id: currentUser.id,
        role: currentUser.role
      });
      setNotifications(notifRes.notifications);
      setUnreadNotifCount(notifRes.unread_count);
    } catch (err) {
      console.error('Data refresh error:', err);
      setDataError(err instanceof Error ? err.message : 'Unable to load application data.');
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser]);

  const handleResetDemoData = async () => {
    try {
      setIsResetting(true);
      await api.resetDemoData();
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleMarkNotifRead = async (id: string) => {
    await api.markNotificationRead(id);
    refreshData();
  };

  const handleMarkAllNotifRead = async () => {
    await api.markNotificationRead('all');
    refreshData();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b1120] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Role-Aware Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        userRole={currentUser.role}
        pendingEscalationsCount={analytics?.metrics?.pending_escalation_reviews || 0}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Compact Top Header */}
        <Header
          currentTab={currentTab}
          currentUser={currentUser}
          users={users}
          onSwitchUser={(user) => {
            setCurrentUser(user);
            // If reporter, ensure not on manager-only view
            if (user.role === 'reporter' && ['escalations', 'team', 'analytics', 'audit'].includes(currentTab)) {
              setCurrentTab('overview');
            }
          }}
          onOpenNewIncidentModal={() => setIsNewIncidentOpen(true)}
          onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)}
          onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          unreadNotificationsCount={unreadNotifCount}
          aiStatus={aiStatus}
          onResetDemoData={handleResetDemoData}
          isResetting={isResetting}
        />

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0b1120]">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && (
              <OverviewView
                analytics={analytics}
                recentIncidents={incidents}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onNavigateTab={setCurrentTab}
                userRole={currentUser.role}
              />
            )}

            {currentTab === 'incidents' && (
              <IncidentsView
                incidents={incidents}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onOpenNewIncidentModal={() => setIsNewIncidentOpen(true)}
                userRole={currentUser.role}
                currentUser={currentUser}
                users={users}
                onRefresh={refreshData}
                analyticsFilter={analyticsFilter}
                onClearAnalyticsFilter={() => setAnalyticsFilter(null)}
              />
            )}

            {currentTab === 'similarity' && (
              <SimilarSearchView
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                userRole={currentUser.role}
              />
            )}

            {currentTab === 'comparison' && (
              <IncidentComparisonView
                incidents={incidents}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
              />
            )}

            {currentTab === 'actions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                      Investigation Action Timeline
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Chronological outcome actions recorded across incidents to preserve both successful and failed techniques.
                    </p>
                  </div>
                </div>
                {/* Select incident to inspect */}
                <div className="p-4 bg-[#0f172a] rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Select Incident:</span>
                    <select
                      value={selectedIncidentId || incidents[0]?.id || ''}
                      onChange={(e) => setSelectedIncidentId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      {incidents.map(i => (
                        <option key={i.id} value={i.id}>{i.id} - {i.title}</option>
                      ))}
                    </select>
                  </div>
                  {selectedIncidentId && (
                    <button
                      onClick={() => setSelectedIncidentId(selectedIncidentId)}
                      className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800 rounded-lg hover:bg-cyan-900/60"
                    >
                      Open Full Timeline Drawer
                    </button>
                  )}
                </div>
              </div>
            )}

            {currentTab === 'recommendations' && (
              <RecommendationsView
                incidents={incidents}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
              />
            )}

            {currentTab === 'logs' && (
              <LogExplorerView
                incidents={incidents}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                currentUser={currentUser}
              />
            )}

            {currentTab === 'knowledge' && (
              <KnowledgeBaseView />
            )}

            {currentTab === 'escalations' && (
              <EscalationQueueView
                currentUser={currentUser}
                onOpenReviewModal={(escId, incId) => {
                  setReviewEscalationId(escId);
                  setReviewIncidentId(incId);
                  setIsReviewEscalationOpen(true);
                }}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
              />
            )}

            {currentTab === 'team' && (
              <TeamView
                incidents={incidents}
                users={users}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                onRefresh={refreshData}
                currentUser={currentUser}
              />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsView
                analytics={analytics}
                incidents={incidents}
                error={dataError}
                onFilterIncidents={(filter) => {
                  setAnalyticsFilter(filter);
                  setCurrentTab('incidents');
                }}
              />
            )}

            {currentTab === 'workflow' && (
              <WorkflowVisualization />
            )}

            {currentTab === 'audit' && (
              <AuditTrailView />
            )}

            {currentTab === 'guide' && (
              <ArchitectureGuideView />
            )}
          </div>
        </main>
      </div>

      {/* Incident Detail Modal */}
      {selectedIncidentId && (
        <IncidentDetailModal
          incidentId={selectedIncidentId}
          onClose={() => setSelectedIncidentId(null)}
          currentUser={currentUser}
          onRefreshIncidents={refreshData}
          onOpenRecordActionModal={(id) => {
            setActionIncidentId(id);
            setIsRecordActionOpen(true);
          }}
          onOpenResolveModal={(id) => {
            setResolveIncidentId(id);
            setIsResolveOpen(true);
          }}
          onOpenEscalateModal={(id) => {
            setEscalateIncidentId(id);
            setIsEscalateOpen(true);
          }}
          onOpenReviewEscalationModal={(escId, incId) => {
            setReviewEscalationId(escId);
            setReviewIncidentId(incId);
            setIsReviewEscalationOpen(true);
          }}
          onNavigateTab={setCurrentTab}
        />
      )}

      {/* Register Incident Modal */}
      <RegisterIncidentModal
        isOpen={isNewIncidentOpen}
        onClose={() => setIsNewIncidentOpen(false)}
        currentUser={currentUser}
        onIncidentCreated={(newId) => {
          refreshData();
          setSelectedIncidentId(newId);
        }}
      />

      {/* Record Action Modal */}
      <RecordActionModal
        isOpen={isRecordActionOpen}
        onClose={() => {
          setIsRecordActionOpen(false);
          setActionIncidentId(null);
        }}
        incidentId={actionIncidentId}
        currentUser={currentUser}
        onActionRecorded={() => {
          refreshData();
          // re-fetch detail modal if open
          if (selectedIncidentId) {
            setSelectedIncidentId(selectedIncidentId);
          }
        }}
      />

      {/* Resolve Incident Modal */}
      <ResolveIncidentModal
        isOpen={isResolveOpen}
        onClose={() => {
          setIsResolveOpen(false);
          setResolveIncidentId(null);
        }}
        incidentId={resolveIncidentId}
        currentUser={currentUser}
        onIncidentResolved={() => {
          refreshData();
        }}
      />

      {/* Request Escalation Modal */}
      <RequestEscalationModal
        isOpen={isEscalateOpen}
        onClose={() => {
          setIsEscalateOpen(false);
          setEscalateIncidentId(null);
        }}
        incidentId={escalateIncidentId}
        currentUser={currentUser}
        onEscalationSubmitted={() => {
          refreshData();
        }}
      />

      {/* Review Escalation Modal */}
      <ReviewEscalationModal
        isOpen={isReviewEscalationOpen}
        onClose={() => {
          setIsReviewEscalationOpen(false);
          setReviewEscalationId(null);
          setReviewIncidentId(null);
        }}
        escalationId={reviewEscalationId}
        incidentId={reviewIncidentId}
        currentUser={currentUser}
        onReviewed={() => {
          refreshData();
        }}
      />

      {/* Interactive Guided Demo Modal */}
      <GuidedDemoModal
        isOpen={isGuidedDemoOpen}
        onClose={() => setIsGuidedDemoOpen(false)}
        onNavigateTab={setCurrentTab}
        onSelectIncident={(id) => setSelectedIncidentId(id)}
      />

      {/* Assistant Chatbot Floating Drawer */}
      <AssistantChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        userRole={currentUser.role}
        userId={currentUser.id}
        onSelectIncident={(id) => setSelectedIncidentId(id)}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifRead}
        onSelectIncident={(id) => setSelectedIncidentId(id)}
      />
    </div>
  );
}
