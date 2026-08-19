import './assets/base.css'
import './assets/app.css'

function App(): React.JSX.Element {
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Connections</span>
          <button className="sidebar-add" title="Add Connection">+</button>
        </div>
        <div className="sidebar-empty">
          <p>No connections yet</p>
          <p className="sidebar-hint">Click + to add a database connection</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-area">
        {/* Welcome state */}
        <div className="welcome">
          <div className="welcome-icon">🦦</div>
          <h1 className="welcome-title">Ferret</h1>
          <p className="welcome-subtitle">Connect to a database to get started</p>
          <div className="welcome-shortcuts">
            <div className="shortcut">
              <kbd>⌘</kbd><kbd>N</kbd>
              <span>New Connection</span>
            </div>
            <div className="shortcut">
              <kbd>⌘</kbd><kbd>T</kbd>
              <span>New Query Tab</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
