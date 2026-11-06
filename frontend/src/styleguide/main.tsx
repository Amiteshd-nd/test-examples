import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../design/tokens.css';
import '../design/ui.css';
import { startUiScale } from '../design/ui-scale.ts';
import './styleguide.css';
import { StyleGuide } from './StyleGuide.tsx';

startUiScale();
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <StyleGuide />
  </StrictMode>,
);
