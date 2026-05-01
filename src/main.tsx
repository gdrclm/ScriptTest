import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameScreen } from './presentation/GameScreen';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameScreen />
  </StrictMode>,
);
