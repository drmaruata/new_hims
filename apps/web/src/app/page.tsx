import { CommandCenterDashboard } from '@/components/command-center-dashboard';

/**
 * The dashboard is a Client Component because the session is a browser-held
 * Supabase token; see the note there. This page stays a Server Component so the
 * shell, fonts and layout still render on the server.
 */
export default function CommandCenterPage() {
  return <CommandCenterDashboard />;
}
