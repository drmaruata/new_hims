import { OpdQueueBoard } from '@/components/opd-queue-board';

/**
 * Client Component: the register is behind an authenticated endpoint and the
 * session is a browser-held token. See the note in `opd-queue-board.tsx`.
 */
export default function OpdPage() {
  return <OpdQueueBoard />;
}
