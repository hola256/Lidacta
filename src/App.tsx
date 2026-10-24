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
import { GlobalToast } from './components/GlobalToast';

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isProfileComplete } = useLidacta();

  // If user is not authenticated, show the login portal in Ciruela Noche (#2D1B4E)
  if (!isAuthenticated) {
    return (
      <>
        <GlobalToast />
        <LoginView />
      </>
    );
  }

  // Mandatory Onboarding Flow: block access to panel if HR or Leader has not completed profile
  if ((currentUser.role === 'leader' || currentUser.role === 'hr') && !isProfileComplete) {
    return (
      <>
        <GlobalToast />
        <CompleteProfileView />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF7EF] flex flex-col font-sans text-[#4A3F55] selection:bg-[#FFD3BF] selection:text-[#2D1B4E] animate-in fade-in duration-300">
      <GlobalToast />
      <Navbar />

      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
        {currentUser.role === 'leader' && <LeaderView />}
        {currentUser.role === 'hr' && <HRView />}
        {currentUser.role === 'admin' && <AdminView />}
      </main>

      <EmailSimulatorDrawer />
      <NewUserModal />
      <WelcomeModal />
      <AdminProfileModal />
    </div>
  );
};

export default function App() {
  return (
    <LidactaProvider>
      <AppContent />
    </LidactaProvider>
  );
}
