import React from 'react';
import { LidactaProvider, useLidacta } from './context/LidactaContext';
import { Navbar } from './components/Navbar';
import { LeaderView } from './components/LeaderView';
import { HRView } from './components/HRView';
import { AdminView } from './components/AdminView';
import { LoginView } from './components/LoginView';
import { CompleteProfileView } from './components/CompleteProfileView';
import { EmailSimulatorDrawer } from './components/EmailSimulatorDrawer';
import { NewUserModal } from './components/NewUserModal';
import { WelcomeModal } from './components/WelcomeModal';
import { AdminProfileModal } from './components/AdminProfileModal';
import { LeaderProfileModal } from './components/LeaderProfileModal';
import { GlobalToast } from './components/GlobalToast';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isProfileComplete } = useLidacta();

  // If user is not authenticated, show the login portal in Ciruela Noche (#2D1B4E)
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <GlobalToast />
        <LoginView />
      </ErrorBoundary>
    );
  }

  // Safe fallback role
  const userRole = (currentUser && currentUser.role) || 'leader';

  // Mandatory Onboarding Flow: block access to panel if HR or Leader has not completed profile
  if ((userRole === 'leader' || userRole === 'hr') && !isProfileComplete) {
    return (
      <ErrorBoundary>
        <GlobalToast />
        <CompleteProfileView />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FFF7EF] flex flex-col font-sans text-[#4A3F55] selection:bg-[#FFD3BF] selection:text-[#2D1B4E] animate-in fade-in duration-300 overflow-x-hidden w-full max-w-full relative">
        <GlobalToast />
        <Navbar />

        <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden overflow-y-hidden">
          {userRole === 'admin' ? (
            <AdminView />
          ) : userRole === 'hr' ? (
            <HRView />
          ) : (
            <LeaderView />
          )}
        </main>

        <EmailSimulatorDrawer />
        <NewUserModal />
        <WelcomeModal />
        <AdminProfileModal />
        <LeaderProfileModal />
      </div>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LidactaProvider>
        <AppContent />
      </LidactaProvider>
    </ErrorBoundary>
  );
}

