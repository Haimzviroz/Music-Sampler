import Grid from './components/Grid';
import { usePattern } from './hooks/usePattern';
import './App.css';

function App() {
  const { pattern, toggle } = usePattern();

  return (
    <div className="app">
      <h1>Music Sampler</h1>
      <Grid pattern={pattern} onToggle={toggle} />
    </div>
  );
}

export default App;
