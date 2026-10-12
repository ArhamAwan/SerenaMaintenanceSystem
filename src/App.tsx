import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Layout';
import { Toaster } from './components/ui';
import { runScheduler, useCurrentUser } from './lib/store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import NewWorkOrder from './pages/NewWorkOrder';
import Execute from './pages/Execute';
import Review from './pages/Review';
import Approvals from './pages/Approvals';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Schedules from './pages/Schedules';
import ReportFault from './pages/ReportFault';
import MyRequests from './pages/MyRequests';
import Templates from './pages/Templates';
import Team from './pages/Team';
import Locations from './pages/Locations';
import Notifications from './pages/Notifications';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import Scan from './pages/Scan';
import PrintReport from './pages/PrintReport';

export default function App() {
  const user = useCurrentUser();

  // Background worker stand-in: generates scheduled work orders and overdue escalations.
  useEffect(() => {
    runScheduler();
    const t = setInterval(() => runScheduler(), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <HashRouter>
      <Toaster />
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/work-orders/:id/print" element={<PrintReport />} />
          <Route
            path="*"
            element={
              <Shell>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tasks" element={<MyTasks />} />
                  <Route path="/work-orders" element={<WorkOrders />} />
                  <Route path="/work-orders/new" element={<NewWorkOrder />} />
                  <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                  <Route path="/work-orders/:id/execute" element={<Execute />} />
                  <Route path="/work-orders/:id/review" element={<Review />} />
                  <Route path="/approvals" element={<Approvals />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/assets/:id" element={<AssetDetail />} />
                  <Route path="/schedules" element={<Schedules />} />
                  <Route path="/report-fault" element={<ReportFault />} />
                  <Route path="/requests" element={<MyRequests />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/locations" element={<Locations />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/audit" element={<Audit />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/scan" element={<Scan />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            }
          />
        </Routes>
      )}
    </HashRouter>
  );
}
