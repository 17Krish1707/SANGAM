import TopBar from '../components/TopBar';
import Panel from '../components/ui/Panel';

interface StubPageProps {
  title: string;
  phase?: string;
}

export default function StubPage({ title, phase }: StubPageProps) {
  return (
    <>
      <TopBar title={title} />
      <main className="flex-1 overflow-y-auto bg-panel p-6">
        <Panel>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{title}</span> will be built
            {phase ? ` in ${phase}` : ' in a future phase'}.
          </p>
        </Panel>
      </main>
    </>
  );
}
