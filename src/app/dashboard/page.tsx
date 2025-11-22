// src/app/dashboard/page.tsx
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileExplorer from '@/components/dashboard/FileExplorer';
import Workspace from '@/components/dashboard/Workspace';

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardLayout
        sidebar={<FileExplorer />}
        main={<Workspace />}
      />
    </ProtectedRoute>
  );
}
