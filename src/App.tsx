import React from 'react';
import { LidactaProvider, useLidacta } from './context/LidactaContext';
import { Navbar } from './components/Navbar';
import { LeaderView } from './components/LeaderView';
import { HRView } from './components/HRView';
import { AdminView } from './components/AdminView';
import { EmailSimulatorDrawer } from './components/EmailSimulatorDrawer';
import { NewUserModal } from './components/NewUserModal';
import { WelcomeModal } from './components/WelcomeModal';

const AppContent: React.FC = () => {
  const { currentUser } = useLidacta();

  return (
    <div className="min-h-screen bg-[#FFF7EF] flex flex-col font-sans text-[#4A3F55] selection:bg-[#FFD3BF] selection:text-[#2D1B4E]">
      <Navbar />

      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
        {currentUser.role === 'leader' && <LeaderView />}
        {currentUser.role === 'hr' && <HRView />}
        {currentUser.role === 'admin' && <AdminView />}
      </main>

      <EmailSimulatorDrawer />
      <NewUserModal />
      <WelcomeModal />
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
