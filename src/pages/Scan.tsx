import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ScanLine } from 'lucide-react';
import { useDb } from '../lib/store';
import { Button, Card, Input, PageHeader, toast } from '../components/ui';

export default function Scan() {
  const db = useDb();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const go = (c: string) => {
    const a = db.assets.find((x) => x.code.toLowerCase() === c.trim().toLowerCase() || x.serial.toLowerCase() === c.trim().toLowerCase());
    if (!a) return toast(`No asset found for "${c}"`, 'error');
    nav(`/assets/${a.id}`);
  };
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={<>Scan <em>equipment</em></>} subtitle="Point your phone camera at the QR label on the machine — it opens the asset page directly." />
      <Card>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-2xl border-2 border-dashed border-forest-300 bg-forest-50">
            <QrCode size={64} className="text-forest-700" />
            <ScanLine size={150} className="absolute text-gold-400/50" />
          </div>
          <p className="mt-4 text-sm text-ink-600">Use your phone's camera app to scan the label. The in-app scanner requires HTTPS hosting (production).</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); go(code); }} className="flex gap-2 border-t border-ivory-200 pt-4">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type asset ID / serial, e.g. GEN-001" />
          <Button variant="primary">Open</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {db.assets.slice(0, 10).map((a) => <button key={a.id} onClick={() => go(a.code)} className="rounded-full bg-ivory-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ivory-300">{a.code}</button>)}
        </div>
      </Card>
    </div>
  );
}
