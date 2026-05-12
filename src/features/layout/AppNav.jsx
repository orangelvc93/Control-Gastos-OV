import { tabMeta, tabs } from '../../shared/lib/navigation';

export function AppNav({ activeTab, setActiveTab }) {
  return (
    <nav className="app-nav" aria-label="Secciones" data-tour="nav">
      {tabs.map((tab) => (
        <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
          <strong>{tab}</strong>
          <span>{tabMeta[tab]}</span>
        </button>
      ))}
    </nav>
  );
}
