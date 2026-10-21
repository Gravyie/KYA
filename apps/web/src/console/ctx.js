import {createContext, useContext} from 'react';
export const ConsoleCtx = createContext(null);
export const useConsole = () => useContext(ConsoleCtx);
