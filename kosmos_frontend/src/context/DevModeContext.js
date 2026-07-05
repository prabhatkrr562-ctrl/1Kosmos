import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function DevModeProvider({ children }) {
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('kosmos-dev-mode') === '1');
  const [inspected, setInspected] = useState(null);

  useEffect(() => {
    localStorage.setItem('kosmos-dev-mode', isDevMode ? '1' : '0');
  }, [isDevMode]);

  const toggleDevMode = useCallback(() => {
    setIsDevMode(prev => {
      if (prev) setInspected(null);
      return !prev;
    });
  }, []);

  return (
    <Ctx.Provider value={{ isDevMode, toggleDevMode, inspected, setInspected }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDevMode() {
  return useContext(Ctx);
}
