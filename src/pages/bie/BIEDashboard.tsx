import { useAuth } from '@/hooks/useAuth';
import BIEManagerDashboard from './BIEManagerDashboard';
import BIEStaffDashboard from './BIEStaffDashboard';

export default function BIEDashboard() {
  const { isBIEManager } = useAuth();
  return isBIEManager ? <BIEManagerDashboard /> : <BIEStaffDashboard />;
}
