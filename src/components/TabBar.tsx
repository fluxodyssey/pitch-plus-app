interface Tab {
  key: string;
  label: string;
  badge?: string | number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div role="tablist" style={{
      display: 'flex',
      gap: 0,
      borderBottom: '2px solid #1e1e2e',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map(tab => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 500,
              color: active ? '#4a9eff' : '#606080',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -2,
              transition: 'color 0.15s, border-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              borderBottomColor: active ? '#4a9eff' : 'transparent',
            }}
          >
            {tab.label}
            {tab.badge != null && (
              <span style={{
                fontSize: 10,
                background: active ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.04)',
                color: active ? '#4a9eff' : '#606080',
                borderRadius: 8,
                padding: '0 5px',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
