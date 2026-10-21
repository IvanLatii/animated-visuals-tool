import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { applyTheme, loadTheme } from './theme';

applyTheme(loadTheme()); // до першого малювання, щоб не блимала не та тема

createRoot(document.getElementById('root')!).render(<App />);
